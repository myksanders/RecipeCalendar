import { resolveDutch } from './dutch';
import { normalizeName } from './shopping';

// Rough check whether a recipe is written in Dutch, from common function words
// and cooking verbs. Good enough to list "recipes still in Dutch"; the user can
// still translate any recipe by hand.

const DUTCH = new Set([
  'de', 'het', 'een', 'en', 'met', 'van', 'voor', 'op', 'in', 'aan', 'tot', 'uit', 'je', 'ze', 'zijn', 'is', 'of',
  'snijd', 'bak', 'kook', 'verwarm', 'voeg', 'toe', 'roer', 'meng', 'laat', 'minuten', 'min', 'pan', 'oven',
  'ongeveer', 'tussendoor', 'goed', 'stukjes', 'blokjes', 'reepjes', 'fijn', 'gaar', 'serveer', 'verdeel', 'breng',
  'water', 'zout', 'peper', 'ui', 'knoflook', 'teentjes', 'el', 'tl', 'per', 'persoon', 'personen',
]);
const ENGLISH = new Set([
  'the', 'a', 'an', 'and', 'with', 'of', 'for', 'on', 'in', 'to', 'into', 'until', 'you', 'it', 'is', 'or',
  'cut', 'bake', 'cook', 'heat', 'add', 'stir', 'mix', 'let', 'minutes', 'pan', 'oven', 'about', 'well', 'pieces',
  'finely', 'serve', 'divide', 'bring', 'water', 'salt', 'pepper', 'onion', 'garlic', 'cloves', 'tbsp', 'tsp', 'cup',
]);

export function looksDutch(r: { title: string; description?: string; steps: string[]; ingredients: { name: string }[] }): boolean {
  const text = [r.title, r.description ?? '', ...r.steps, ...r.ingredients.map((i) => i.name)].join(' ');
  let nl = 0;
  let en = 0;
  for (const w of normalizeName(text).split(' ')) {
    if (DUTCH.has(w)) nl++;
    if (ENGLISH.has(w)) en++;
  }
  if (nl >= 3 && nl > en * 1.5) return true;
  // English method but Dutch shopping words ("rundergehakt", "ui") still count.
  const named = r.ingredients.filter((i) => i.name.trim());
  const dutchNames = named.filter((i) => resolveDutch(i.name).source === 'dutch').length;
  return named.length > 0 && dutchNames * 2 >= named.length;
}
