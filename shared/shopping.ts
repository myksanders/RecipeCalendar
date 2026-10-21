import { formatQuantity } from './ingredients';
import { CATEGORIES, type Category, type ShoppingItem, type ShoppingList } from './types';

export interface PlannedMeal {
  entryId: number;
  date: string;
  title: string;
  scale: number;
  ingredients: { id: number; name: string; quantity: number | null; unit: string; category: Category }[];
  have: Set<number>; // ingredient ids marked "have it" for this meal
}

export interface ExtraLike {
  id: number;
  name: string;
  category: Category;
  done: boolean;
}

const UNIT_ALIASES: Record<string, string> = {
  gr: 'g', gram: 'g', grams: 'g', kilo: 'kg', liter: 'l', litre: 'l', liters: 'l',
  eetlepel: 'el', eetlepels: 'el', tbsp: 'el', tablespoon: 'el', tablespoons: 'el',
  theelepel: 'tl', theelepels: 'tl', tsp: 'tl', teaspoon: 'tl', teaspoons: 'tl',
  stuks: 'stuk', st: 'stuk', teentje: 'teen', teentjes: 'teen', tenen: 'teen', clove: 'teen',
  cloves: 'teen', blikje: 'blik', blikken: 'blik', can: 'blik', cans: 'blik', cups: 'cup',
};

// Convert to a base unit so 500 g + 1 kg merge into 1.5 kg.
const CONVERT: Record<string, { base: string; factor: number }> = {
  kg: { base: 'g', factor: 1000 },
  mg: { base: 'g', factor: 0.001 },
  l: { base: 'ml', factor: 1000 },
  dl: { base: 'ml', factor: 100 },
  cl: { base: 'ml', factor: 10 },
  // English recipes: Dutch shops sell by the gram
  lb: { base: 'g', factor: 453.6 },
  lbs: { base: 'g', factor: 453.6 },
  oz: { base: 'g', factor: 28.35 },
};

export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\.$/, '');
  return UNIT_ALIASES[u] ?? u;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toBase(q: number | null, unit: string) {
  const c = CONVERT[unit];
  if (!c || q === null) return { q, unit };
  return { q: q * c.factor, unit: c.base };
}

function prettify(q: number | null, unit: string) {
  if (q === null) return { q, unit };
  // Converted pounds/ounces give odd decimals; nobody buys 453.6 g.
  if ((unit === 'g' || unit === 'ml') && q >= 10) q = Math.round(q);
  if (unit === 'g' && q >= 1000) return { q: q / 1000, unit: 'kg' };
  if (unit === 'ml' && q >= 1000) return { q: q / 1000, unit: 'l' };
  return { q, unit };
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(date: string) {
  const d = new Date(date + 'T12:00:00');
  return DAY[d.getDay()];
}

/**
 * Build the shopping list from planned meals: only ingredients not marked as
 * "have it", merged by name + unit, grouped by shop category.
 */
export function buildShoppingList(
  from: string,
  to: string,
  meals: PlannedMeal[],
  extras: ExtraLike[] = [],
  toDutch: (name: string) => string | null = () => null,
): ShoppingList {
  const items = new Map<string, ShoppingItem>();
  let haveCount = 0;

  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      if (meal.have.has(ing.id)) {
        haveCount++;
        continue;
      }
      const base = toBase(ing.quantity === null ? null : ing.quantity * meal.scale, normalizeUnit(ing.unit));
      // Merge on the Dutch name when known, so "scallions" and "bosui" become one line.
      const dutch = toDutch(ing.name);
      const key = `${normalizeName(dutch ?? ing.name)}|${base.unit}`;
      const usedIn = `${meal.title} (${dayLabel(meal.date)})`;
      const existing = items.get(key);
      if (existing) {
        if (existing.quantity !== null && base.q !== null) existing.quantity += base.q;
        else if (existing.quantity === null && base.q !== null) existing.quantity = base.q;
        if (!existing.usedIn.includes(usedIn)) existing.usedIn.push(usedIn);
        existing.refs.push({ entryId: meal.entryId, ingredientId: ing.id });
      } else {
        items.set(key, {
          key,
          name: ing.name,
          dutch,
          quantity: base.q,
          unit: base.unit,
          category: ing.category,
          usedIn: [usedIn],
          refs: [{ entryId: meal.entryId, ingredientId: ing.id }],
        });
      }
    }
  }

  for (const it of items.values()) {
    const p = prettify(it.quantity, it.unit);
    it.quantity = p.q === null ? null : Math.round(p.q * 100) / 100;
    it.unit = p.unit;
  }

  for (const ex of extras) {
    if (ex.done) continue;
    items.set(`extra:${ex.id}`, {
      key: `extra:${ex.id}`,
      name: ex.name,
      quantity: null,
      unit: '',
      category: ex.category,
      usedIn: [],
      refs: [],
      extraId: ex.id,
      dutch: toDutch(ex.name),
    });
  }

  const groups = CATEGORIES.map((category) => ({
    category,
    items: [...items.values()]
      .filter((i) => i.category === category)
      .sort((a, b) => (a.dutch ?? a.name).localeCompare(b.dutch ?? b.name)),
  })).filter((g) => g.items.length > 0);

  return { from, to, groups, haveCount };
}

/** Plain-text version for copy/share and the Apple Notes shortcut. */
export function shoppingListToText(list: ShoppingList, opts: { withSources?: boolean } = {}): string {
  const lines: string[] = [];
  lines.push(`Shopping list ${list.from} → ${list.to}`);
  if (list.groups.length === 0) {
    lines.push('', 'Nothing to buy 🎉');
    return lines.join('\n');
  }
  for (const g of list.groups) {
    lines.push('', g.category.toUpperCase());
    for (const it of g.items) {
      const qty = formatQuantity(it.quantity, it.unit);
      // Dutch first (what you type in the AH app), English in brackets when different.
      const nl = it.dutch && normalizeName(it.dutch) !== normalizeName(it.name) ? it.dutch : null;
      let line = `- ${qty ? qty + ' ' : ''}${nl ?? it.name}${nl ? ` (${it.name})` : ''}`;
      if (opts.withSources && it.usedIn.length) line += `  (${it.usedIn.join(', ')})`;
      lines.push(line);
    }
  }
  return lines.join('\n');
}
