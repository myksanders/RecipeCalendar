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
