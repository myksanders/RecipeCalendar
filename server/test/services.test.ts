import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildIcs, foldLine } from '../services/ical';
import { durationToMinutes, extractRecipeFromHtml } from '../services/importer';

describe('importer', () => {
  const html = readFileSync(join(__dirname, 'fixtures/allerhande-like.html'), 'utf8');

  it('extracts a schema.org recipe from @graph', () => {
    const r = extractRecipeFromHtml(html, 'https://www.ah.nl/allerhande/recept/R-123/curry')!;
    expect(r.title).toBe('Snelle kip-curry & rijst');
    expect(r.description).toBe('Een romige curry.');
    expect(r.servings).toBe(4);
    expect(r.prepMinutes).toBe(15);
    expect(r.cookMinutes).toBe(65);
    expect(r.imageUrl).toBe('https://cdn.example.com/img/large.jpg');
    expect(r.tags).toEqual(['hoofdgerecht', 'indiaas']);
    expect(r.steps).toEqual(['Snijd de kip in blokjes.', 'Bak de ui en de currypasta.', 'Voeg de kokosmelk toe & laat sudderen.']);
    expect(r.ingredients[0]).toMatchObject({ name: 'kipfilet', quantity: 400, unit: 'g', category: 'Meat & Fish' });
    expect(r.ingredients[3]).toMatchObject({ name: 'kokosmelk', category: 'Pantry' });
    expect(r.ingredients).toHaveLength(7);
  });

  it('returns null without recipe data', () => {
    expect(extractRecipeFromHtml('<html></html>', 'https://x')).toBeNull();
  });

  it('parses durations', () => {
    expect(durationToMinutes('PT1H30M')).toBe(90);
    expect(durationToMinutes('PT20M')).toBe(20);
    expect(durationToMinutes('nonsense')).toBeNull();
  });
});

describe('importer on other sites', () => {
  const load = (f: string) =>
    extractRecipeFromHtml(readFileSync(join(__dirname, `fixtures/${f}.html`), 'utf8'), 'https://example.com/recipe/')!;

  it('uses JSON-LD and borrows ingredient groups and notes from a WP Recipe Maker card', () => {
    const r = load('wprm-with-jsonld');
    expect(r.source).toBe('structured');
    expect(r.unclear).toEqual([]);
    expect(r.ingredients).toHaveLength(7);
    expect(r.ingredients[0]).toMatchObject({ quantity: 1.5, unit: 'lb', name: 'boneless skinless chicken thighs', note: 'cut into bite-size pieces, chicken & noodles' });
    expect(r.ingredients[3]).toMatchObject({ quantity: 0.25, unit: 'cup', name: 'honey', note: 'sauce' });
    expect(r.notes).toBe('Leftovers keep 4 days in the fridge.');
    expect(r.imageUrl).toBe('https://example.com/a.jpg');
  });

  it('reads a Tasty Recipes card when there is no structured data', () => {
    const r = load('tasty-card-only');
    expect(r.source).toBe('recipe-card');
    expect(r.title).toBe('Sesame Ground Chicken');
    expect(r.servings).toBe(4);
    expect(r.imageUrl).toBe('https://example.com/img/sesame-card.jpg');
    expect(r.steps).toEqual(['Brown the chicken in sesame oil.', 'Stir in the sauce.', 'Serve over rice.']);
    expect(r.ingredients.map((i) => [i.quantity, i.unit, i.name, i.note])).toEqual([
      [1, 'lb', 'ground chicken', 'for the chicken'],
      [1, 'tablespoon', 'sesame oil', 'divided, for the chicken'],
      [null, '', 'Salt and pepper', 'to taste, for the chicken'],
      [1 / 3, 'cup', 'soy sauce', 'for the sauce'],
      [2, 'tablespoons', 'rice vinegar', 'for the sauce'],
      [1, 'can', 'coconut milk', '14 oz, for the sauce'],
      [null, '', 'sesame seeds', 'optional, for the sauce'],
    ]);
    expect(r.notes).toBe('Use ground turkey if you prefer.');
  });

  it('reads schema.org microdata', () => {
    const r = load('microdata');
    expect(r.source).toBe('structured');
    expect(r.title).toBe('Pancakes');
    expect(r.servings).toBe(8);
    expect(r.ingredients.map((i) => i.name)).toEqual(['flour', 'eggs', 'milk']);
    expect(r.steps).toEqual(['Whisk everything.', 'Fry in butter.']);
  });

  it('falls back to the title and photo when the page has no recipe', () => {
    const r = load('no-recipe');
    expect(r).toMatchObject({ source: 'title-only', title: "My Grandma's Stew", imageUrl: 'https://cdn.example.com/stew.jpg', ingredients: [], steps: [] });
    expect(r.description).toBe('A cozy stew for cold nights.');
  });

  it('flags lines it could not read', () => {
    const html = `<script type="application/ld+json">{"@type":"Recipe","name":"X","recipeIngredient":["2 cups flour","3-4 x 200g packs of tofu"]}</script>`;
    expect(extractRecipeFromHtml(html, 'https://x/')!.unclear).toEqual(['3-4 x 200g packs of tofu']);
  });
});

describe('ical', () => {
  it('builds a valid-looking feed with escaping and folding', () => {
    const ics = buildIcs(
      [{
        id: 7, date: '2026-10-21', slot: 'dinner', kind: 'recipe', recipeId: 1, leftoverOfEntryId: null, title: '',
        who: 'Everyone', servings: null, notes: 'Use the big pan; it, works', sortOrder: 0, displayTitle: 'Lasagne, extra cheesy',
        photo: null, checkedCount: 0, ingredientCount: 0, ingredientsText: '• ' + 'x'.repeat(120),
      }],
      { baseUrl: 'http://pc:3000', now: new Date('2026-10-21T10:00:00Z') },
    );
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('DTSTART:20261021T180000');
    expect(ics).toContain('SUMMARY:🍽 Lasagne\\, extra cheesy');
    expect(ics).toContain(String.raw`Use the big pan\; it\, works`);
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it('folds multibyte text safely', () => {
    const folded = foldLine('SUMMARY:' + '🍽'.repeat(40));
    expect(folded.split('\r\n ').join('')).toBe('SUMMARY:' + '🍽'.repeat(40));
  });
});
