import { normalizeName } from './shopping';

const STOP = new Set(['de', 'het', 'een', 'en', 'met', 'van', 'the', 'a', 'an', 'and', 'with', 'of', 'met']);

function words(s: string): string[] {
  return normalizeName(s)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}

/**
 * Recipes ordered by how well their title matches a note's text ("Tacos"
 * → "Chicken tacos" before "Lasagne"). Recipes that share no word are left out.
 */
export function rankRecipesForText<T extends { title: string }>(recipes: T[], text: string): T[] {
  const want = words(text);
  if (!want.length) return [];
  const scored = recipes
    .map((r) => {
      const have = words(r.title);
      let score = 0;
      for (const w of want) {
        if (have.includes(w)) score += 2;
        else if (have.some((h) => h.startsWith(w) || w.startsWith(h))) score += 1;
      }
      if (normalizeName(r.title) === normalizeName(text)) score += 5;
      return { r, score };
    })
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.r.title.localeCompare(b.r.title));
  return scored.map((x) => x.r);
}
