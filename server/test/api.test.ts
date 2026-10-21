import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { openDb } from '../db';
import { createRepo } from '../repo';
import { createPhotoStore } from '../services/photos';

function setup() {
  const repo = createRepo(openDb(':memory:'));
  const photos = createPhotoStore(mkdtempSync(join(tmpdir(), 'mp-photos-')));
  return buildApp({ repo, photos });
}

const recipe = {
  title: 'Lasagne',
  servings: 4,
  ingredients: [
    { name: 'gehakt', quantity: 500, unit: 'g' },
    { name: 'melk', quantity: 500, unit: 'ml' },
  ],
  steps: ['Cook', 'Bake'],
};

describe('API', () => {
  let app: ReturnType<typeof setup>;
  beforeEach(() => {
    app = setup();
  });

  it('creates recipes, plans them, checks ingredients and builds a shopping list', async () => {
    let res = await app.inject({ method: 'POST', url: '/api/recipes', payload: recipe });
    expect(res.statusCode).toBe(201);
    const r = res.json();
    expect(r.ingredients.map((i: any) => i.category)).toEqual(['Meat & Fish', 'Dairy & Eggs']);

    res = await app.inject({ method: 'POST', url: '/api/entries', payload: { date: '2026-10-26', kind: 'recipe', recipeId: r.id, servings: 8 } });
    expect(res.statusCode).toBe(201);
    const entry = res.json();
    expect(entry.displayTitle).toBe('Lasagne');

    // leftovers the next day for the kid
    res = await app.inject({ method: 'POST', url: '/api/entries', payload: { date: '2026-10-27', slot: 'lunch', kind: 'leftovers', leftoverOfEntryId: entry.id, who: 'Kid' } });
    expect(res.json().displayTitle).toBe('Leftovers: Lasagne');
    await app.inject({ method: 'POST', url: '/api/entries', payload: { date: '2026-10-28', kind: 'dining_out' } });

    // have the milk already
    const milkId = r.ingredients[1].id;
    res = await app.inject({ method: 'PUT', url: `/api/entries/${entry.id}/checks/${milkId}`, payload: { have: true } });
    expect(res.statusCode).toBe(200);

    res = await app.inject({ method: 'GET', url: '/api/shopping-list?from=2026-10-26&to=2026-11-01' });
    const list = res.json();
    expect(list.haveCount).toBe(1);
    expect(list.groups).toHaveLength(1);
    expect(list.groups[0].items[0]).toMatchObject({ name: 'gehakt', quantity: 1, unit: 'kg' });

    res = await app.inject({ method: 'GET', url: '/api/shopping-list.txt?from=2026-10-26&to=2026-11-01' });
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('- 1 kg gehakt');

    res = await app.inject({ method: 'GET', url: '/api/entries?from=2026-10-26&to=2026-11-01' });
    expect(res.json().map((e: any) => e.displayTitle)).toEqual(['Lasagne', 'Leftovers: Lasagne', 'Dinner out']);

    const detail = (await app.inject({ method: 'GET', url: `/api/entries/${entry.id}` })).json();
    expect(detail.checks[milkId]).toBe(true);
    expect(detail.scale).toBe(2);
  });

  it('keeps checks when a recipe is edited', async () => {
    const r = (await app.inject({ method: 'POST', url: '/api/recipes', payload: recipe })).json();
    const e = (await app.inject({ method: 'POST', url: '/api/entries', payload: { date: '2026-10-26', kind: 'recipe', recipeId: r.id } })).json();
    await app.inject({ method: 'PUT', url: `/api/entries/${e.id}/checks/${r.ingredients[1].id}`, payload: { have: true } });
    const edited = { ...recipe, title: 'Lasagne 2', ingredients: [r.ingredients[1], { name: 'kaas', quantity: 100, unit: 'g' }] };
    const res = await app.inject({ method: 'PUT', url: `/api/recipes/${r.id}`, payload: edited });
    expect(res.json().ingredients).toHaveLength(2);
    const detail = (await app.inject({ method: 'GET', url: `/api/entries/${e.id}` })).json();
    expect(detail.checks[r.ingredients[1].id]).toBe(true);
    expect(detail.displayTitle).toBe('Lasagne 2');
  });

  it('reports variety conflicts', async () => {
    const r = (await app.inject({ method: 'POST', url: '/api/recipes', payload: recipe })).json();
    await app.inject({ method: 'POST', url: '/api/entries', payload: { date: '2026-10-20', kind: 'recipe', recipeId: r.id } });
    const v = (await app.inject({ method: 'GET', url: `/api/recipes/${r.id}/variety?date=2026-10-30` })).json();
    expect(v).toEqual({ weeks: 3, dates: ['2026-10-20'] });
    const far = (await app.inject({ method: 'GET', url: `/api/recipes/${r.id}/variety?date=2026-12-30` })).json();
    expect(far.dates).toEqual([]);
  });

  it('uploads photos and serves them', async () => {
    const r = (await app.inject({ method: 'POST', url: '/api/recipes', payload: recipe })).json();
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const res = await app.inject({ method: 'PUT', url: `/api/recipes/${r.id}/photo`, payload: png, headers: { 'content-type': 'image/png' } });
    expect(res.statusCode).toBe(200);
    const photo = res.json().photo;
    expect(photo).toMatch(/^\/photos\/\d+-.*\.png$/);
    const img = await app.inject({ method: 'GET', url: photo });
    expect(img.statusCode).toBe(200);
    expect(img.rawPayload.equals(png)).toBe(true);
  });

  it('validates input', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/recipes', payload: { title: '' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/entries', payload: { date: 'tomorrow', kind: 'fend' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/entries', payload: { date: '2026-10-26', kind: 'recipe', recipeId: 999 } })).statusCode).toBe(400);
  });

  it('stores the week start setting', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/settings' })).json().weekStart).toBe(1);
    const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: { weekStart: 0 } });
    expect(res.json()).toMatchObject({ weekStart: 0, varietyWeeks: 3 });
    expect((await app.inject({ method: 'PUT', url: '/api/settings', payload: { weekStart: 3 } })).statusCode).toBe(400);
  });

  it('stores which meals the household plans', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/settings' })).json().mealSlots).toEqual(['dinner']);
    const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: { mealSlots: ['breakfast'] } });
    expect(res.json().mealSlots).toEqual(['breakfast', 'dinner']);
    expect((await app.inject({ method: 'PUT', url: '/api/settings', payload: { mealSlots: ['brunch'] } })).statusCode).toBe(400);
  });

  it('serves an iCal feed', async () => {
    const res = await app.inject({ method: 'GET', url: '/calendar.ics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.body).toContain('BEGIN:VCALENDAR');
    // Calendar apps are strict: CRLF line endings only, and HEAD must work too.
    expect(res.body.endsWith('\r\n')).toBe(true);
    expect(res.body.replace(/\r\n/g, '')).not.toContain('\n');
    const head = await app.inject({ method: 'HEAD', url: '/calendar.ics' });
    expect(head.statusCode).toBe(200);
  });

  it('imports a recipe from a URL', async () => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(join(__dirname, 'fixtures/allerhande-like.html'), 'utf8');
    const fakeFetch = (async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
    const repo = createRepo(openDb(':memory:'));
    const a = buildApp({ repo, photos: createPhotoStore(mkdtempSync(join(tmpdir(), 'mp-'))), fetchImpl: fakeFetch });
    const res = await a.inject({ method: 'POST', url: '/api/recipes/import', payload: { url: 'https://www.ah.nl/allerhande/recept/x' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Snelle kip-curry & rijst');
  });
});
