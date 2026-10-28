import { guessCategory } from './categorize';
import type { Ingredient } from './types';

const UNITS = [
  'g', 'gr', 'gram', 'grams', 'kg', 'kilo', 'mg', 'ml', 'cl', 'dl', 'l', 'liter', 'litre', 'liters',
  'el', 'eetlepel', 'eetlepels', 'tl', 'theelepel', 'theelepels', 'tbsp', 'tablespoon', 'tablespoons',
  'tsp', 'teaspoon', 'teaspoons', 'cup', 'cups', 'oz', 'lb', 'lbs', 'stuk', 'stuks', 'st', 'teen',
  'teentje', 'teentjes', 'tenen', 'clove', 'cloves', 'blik', 'blikje', 'blikken', 'can', 'cans',
  'pak', 'pakje', 'pakken', 'zak', 'zakje', 'zakjes', 'snufje', 'snuf', 'pinch', 'bos', 'bosje',
  'bunch', 'takje', 'takjes', 'sprig', 'sprigs', 'plak', 'plakken', 'plakjes', 'slice', 'slices',
  'scheutje', 'scheut', 'dash', 'handje', 'handvol', 'handful', 'pot', 'potje', 'bakje', 'bakjes',
  'fles', 'bottle', 'krop', 'kropje', 'stengel', 'stengels', 'stalk', 'stalks', 'blokje', 'blokjes',
  'cube', 'cubes', 'portie', 'porties',
];
const UNIT_SET = new Set(UNITS);

const FRACTIONS: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125,
};

/** Parse "1½", "1 1/2", "0,5", "2-3", "1/2 to 3/4" (ranges take the upper bound) into a number. */
export function parseQuantity(raw: string): number | null {
  let s = raw.trim().replace(',', '.');
  if (!s) return null;
  const range = s.split(/\s*(?:[-–]|\bto\b)\s*/);
  if (range.length === 2) s = range[1];
  let total = 0;
  for (const [ch, val] of Object.entries(FRACTIONS)) {
    if (s.includes(ch)) {
      total += val;
      s = s.replace(ch, '').trim();
    }
  }
  if (!s) return total || null;
  const parts = s.split(/\s+/);
  for (const p of parts) {
    if (/^\d+\/\d+$/.test(p)) {
      const [a, b] = p.split('/').map(Number);
      if (!b) return null;
      total += a / b;
    } else if (/^\d+(\.\d+)?$/.test(p)) {
      total += Number(p);
    } else {
      return null;
    }
  }
  return total;
}

// One amount: "1 1/2", "1/4", "1½", "½", "0,5". Fractions are tried first so
// "1/4" isn't read as "1" followed by "/4".
const AMOUNT = String.raw`(?:\d+\s+)?\d+\/\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛]`;
// A leading amount, optionally a range: "2-3", "1/2–3/4", "2 to 3".
const QTY_RE = new RegExp(String.raw`^(${AMOUNT})((?:\s*(?:[-–]|to)\s*(?:${AMOUNT}))?)\s*`);

// Words that describe how much or how to use, not what to buy.
const TRAILING_NOTE_RE = /\s+(to taste|for garnish|for serving|for topping|divided|optional|as needed|or more)$/i;

/** Parse a free-text ingredient line like "500 g rundergehakt" or "2 tbsp olive oil, divided". */
export function parseIngredientLine(line: string): Ingredient {
  const notes: string[] = [];
  // Some recipe plugins leave HTML in ingredient lines; also drop list bullets.
  let s = line
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-•*▢☐]\s*/, '');
  const optional = s.match(/^\(?optional\)?\s*[:\-–]?\s*/i);
  if (optional) {
    notes.push('optional');
    s = s.slice(optional[0].length);
  }
  const cleaned = s;
  let quantity: number | null = null;
  let unit = '';
  const m = s.match(QTY_RE);
  if (m && m[1].trim()) {
    quantity = parseQuantity(m[1] + m[2]);
    s = s.slice(m[0].length);
  }
  // "500g" style glued units
  const glued = s.match(/^([a-zA-Z]+)\.?\s+(.*)$/);
  if (quantity !== null && glued && UNIT_SET.has(glued[1].toLowerCase())) {
    unit = glued[1].toLowerCase();
    s = glued[2];
  } else if (quantity === null) {
    const g2 = cleaned.match(/^(\d+(?:[.,]\d+)?)([a-zA-Z]+)\s+(.*)$/);
    if (g2 && UNIT_SET.has(g2[2].toLowerCase())) {
      quantity = parseQuantity(g2[1]);
      unit = g2[2].toLowerCase();
      s = g2[3];
    }
  }
  // "1 (14 oz) can coconut milk", "2 cups (480 ml) broth": sizes in brackets go to the note.
  const lead = s.match(/^\(([^)]*)\)\s*/);
  if (lead) {
    notes.push(lead[1].trim());
    s = s.slice(lead[0].length);
    const u = s.match(/^([a-zA-Z]+)\.?\s+(.*)$/);
    if (!unit && quantity !== null && u && UNIT_SET.has(u[1].toLowerCase())) {
      unit = u[1].toLowerCase();
      s = u[2];
    }
  }
  s = s.replace(/^(of|van)\s+/i, '');
  const comma = s.indexOf(',');
  if (comma > 0) {
    notes.push(s.slice(comma + 1).trim());
    s = s.slice(0, comma).trim();
  }
  // Remaining brackets ("chicken thighs (boneless)") and "salt to taste" style endings.
  s = s.replace(/\s*\(([^)]*)\)\s*/g, (_, inner: string) => {
    notes.push(inner.trim());
    return ' ';
  }).trim();
  const trailing = s.match(TRAILING_NOTE_RE);
  if (trailing) {
    notes.push(trailing[1].toLowerCase());
    s = s.slice(0, trailing.index).trim();
  }
  const name = s || cleaned;
  const note = notes.filter(Boolean).join(', ');
  return { name, quantity, unit, category: guessCategory(name), ...(note ? { note } : {}) };
}

export function formatQuantity(q: number | null, unit: string): string {
  if (q === null) return unit;
  const rounded = Math.round(q * 100) / 100;
  const nice = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, '');
  return unit ? `${nice} ${unit}` : nice;
}

export function formatIngredient(i: Pick<Ingredient, 'name' | 'quantity' | 'unit'>, scale = 1): string {
  const q = i.quantity === null ? null : i.quantity * scale;
  const qty = formatQuantity(q, i.unit);
  return qty ? `${qty} ${i.name}` : i.name;
}
