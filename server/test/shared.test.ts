import { describe, expect, it } from 'vitest';
import { guessCategory } from '../../shared/categorize';
import { parseIngredientLine, parseQuantity, formatIngredient } from '../../shared/ingredients';
import { buildShoppingList, shoppingListToText } from '../../shared/shopping';
import { addDays, startOfWeek } from '../../shared/dates';
import { leftoverSlot, visibleSlots } from '../../shared/types';
import { differsFromName, dutchKey, guessCategoryWithDutch, resolveDutch } from '../../shared/dutch';

describe('guessCategory', () => {
  it.each([
    ['rundergehakt', 'Meat & Fish'],
    ['kipfilet', 'Meat & Fish'],
    ['champignons', 'Vegetables & Fruit'],
    ['mushrooms', 'Vegetables & Fruit'],
    ['tomatenpuree', 'Pantry'],
    ['tomaten', 'Vegetables & Fruit'],
    ['kokosmelk', 'Pantry'],
    ['volle melk', 'Dairy & Eggs'],
    ['geitenkaas', 'Dairy & Eggs'],
    ['2 eieren', 'Dairy & Eggs'],
    ['aardappelen', 'Vegetables & Fruit'],
    ['bloemkool', 'Vegetables & Fruit'],
    ['bloem', 'Pantry'],
    ['toiletpapier', 'Household'],
    ['sinaasappelsap', 'Drinks'],
    ['tortilla wraps', 'Bakery'],
    ['something odd', 'Other'],
  ])('%s -> %s', (name, cat) => expect(guessCategory(name)).toBe(cat));
});

describe('ingredient parsing', () => {
  it('parses quantities', () => {
    expect(parseQuantity('1½')).toBe(1.5);
    expect(parseQuantity('1 1/2')).toBe(1.5);
    expect(parseQuantity('0,5')).toBe(0.5);
    expect(parseQuantity('2-3')).toBe(3);
  });
  it.each([
    ['500 g rundergehakt', 500, 'g', 'rundergehakt'],
    ['500g rundergehakt', 500, 'g', 'rundergehakt'],
    ['2 el olijfolie', 2, 'el', 'olijfolie'],
    ['2 teentjes knoflook', 2, 'teentjes', 'knoflook'],
    ['1 ui', 1, '', 'ui'],
    ['½ bosje koriander', 0.5, 'bosje', 'koriander'],
    ['zout en peper', null, '', 'zout en peper'],
  ])('%s', (line, q, unit, name) => {
    const i = parseIngredientLine(line);
    expect(i.quantity).toBe(q);
    expect(i.unit).toBe(unit);
    expect(i.name).toBe(name);
  });
  it('keeps text after a comma as a note', () => {
    expect(parseIngredientLine('1 onion, finely chopped')).toMatchObject({ name: 'onion', note: 'finely chopped' });
  });
  it('formats scaled ingredients', () => {
    expect(formatIngredient({ name: 'gehakt', quantity: 500, unit: 'g' }, 1.5)).toBe('750 g gehakt');
    expect(formatIngredient({ name: 'zout', quantity: null, unit: '' })).toBe('zout');
  });
});

describe('buildShoppingList', () => {
  const meal = (entryId: number, date: string, title: string, ings: [number, string, number | null, string][], have: number[] = [], scale = 1) => ({
    entryId,
    date,
    title,
    scale,
    have: new Set(have),
    ingredients: ings.map(([id, name, quantity, unit]) => ({ id, name, quantity, unit, category: guessCategory(name) })),
  });

  it('merges, converts units, excludes checked items and groups by category', () => {
    const list = buildShoppingList('2026-10-26', '2026-11-01', [
      meal(1, '2026-10-26', 'Lasagne', [[1, 'Gehakt', 500, 'g'], [2, 'ui', 1, ''], [3, 'melk', 500, 'ml']], [3]),
      meal(2, '2026-10-28', 'Chili', [[4, 'gehakt', 1, 'kg'], [5, 'Ui', 2, ''], [6, 'zout', null, '']]),
    ], [{ id: 9, name: 'toiletpapier', category: 'Household', done: false }, { id: 10, name: 'old', category: 'Other', done: true }]);

    expect(list.haveCount).toBe(1);
    const meat = list.groups.find((g) => g.category === 'Meat & Fish')!;
    expect(meat.items).toHaveLength(1);
    expect(meat.items[0]).toMatchObject({ quantity: 1.5, unit: 'kg', usedIn: ['Lasagne (Mon)', 'Chili (Wed)'] });
    expect(meat.items[0].refs).toEqual([{ entryId: 1, ingredientId: 1 }, { entryId: 2, ingredientId: 4 }]);
    const veg = list.groups.find((g) => g.category === 'Vegetables & Fruit')!;
    expect(veg.items[0].quantity).toBe(3);
    expect(list.groups.find((g) => g.category === 'Dairy & Eggs')).toBeUndefined();
    expect(list.groups.map((g) => g.category)).toEqual(['Meat & Fish', 'Vegetables & Fruit', 'Pantry', 'Household']);

    const text = shoppingListToText(list);
    expect(text).toContain('MEAT & FISH\n- 1.5 kg Gehakt');
    expect(text).toContain('HOUSEHOLD\n- toiletpapier');
    expect(text).not.toContain('old');
  });

  it('converts pounds so English and Dutch amounts merge', () => {
    const list = buildShoppingList('a', 'b', [
      meal(1, '2026-10-26', 'Bowl', [[1, 'rundergehakt', 1, 'lb']]),
      meal(2, '2026-10-27', 'Lasagne', [[2, 'rundergehakt', 500, 'g']]),
    ]);
    expect(list.groups[0].items).toHaveLength(1);
    expect(list.groups[0].items[0]).toMatchObject({ quantity: 954, unit: 'g' });
  });

  it('scales by servings', () => {
    const list = buildShoppingList('a', 'b', [meal(1, '2026-10-26', 'X', [[1, 'rijst', 300, 'g']], [], 2)]);
    expect(list.groups[0].items[0].quantity).toBe(600);
  });
});

describe('dates', () => {
  it('weeks start on Monday', () => {
    expect(startOfWeek('2026-10-21')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
  it('weeks can start on Sunday', () => {
    expect(startOfWeek('2026-10-21', 0)).toBe('2026-10-18');
    expect(startOfWeek('2026-10-24', 0)).toBe('2026-10-18');
    expect(startOfWeek('2026-10-25', 0)).toBe('2026-10-25');
  });
});

describe('meal slots', () => {
  it('always includes dinner, keeps day order, and shows slots in use', () => {
    expect(visibleSlots([])).toEqual(['dinner']);
    expect(visibleSlots(['dinner', 'breakfast'])).toEqual(['breakfast', 'dinner']);
    expect(visibleSlots(['dinner'], ['lunch', 'other'])).toEqual(['lunch', 'dinner', 'other']);
  });
  it('puts leftovers at lunch only when lunch is planned', () => {
    expect(leftoverSlot(['dinner'])).toBe('dinner');
    expect(leftoverSlot(['lunch', 'dinner'])).toBe('lunch');
  });
});

describe('Dutch names', () => {
  it.each([
    ['lean ground beef', 'rundergehakt'],
    ['green onions', 'bosui'],
    ['scallions', 'bosui'],
    ['garlic cloves', 'knoflook'],
    ['toasted sesame oil', 'sesamolie'],
    ['toasted sesame seeds', 'sesamzaad'],
    ['cooked short grain rice', 'sushirijst'],
    ['eggs', 'eieren'],
    ['potatoes', 'aardappelen'],
    ['red pepper flakes', 'chilivlokken'],
    ['red bell pepper', 'paprika'],
    ['ground black pepper', 'zwarte peper'],
    ['coconut milk', 'kokosmelk'],
    ['peanut butter', 'pindakaas'],
    ['gochujang', 'gochujang'],
  ])('%s -> %s', (en, nl) => expect(resolveDutch(en)).toEqual({ nl, source: 'dictionary' }));

  it('recognises names that are already Dutch', () => {
    expect(resolveDutch('rundergehakt')).toEqual({ nl: 'rundergehakt', source: 'dutch' });
    expect(resolveDutch('pandanrijst').source).toBe('dutch');
    expect(resolveDutch('geraspte kaas').source).toBe('dutch');
    expect(resolveDutch('something odd')).toEqual({ nl: null, source: null });
  });

  it('prefers what the household taught', () => {
    const learned = new Map([[dutchKey('Fresh scallions'), 'lente-ui']]);
    expect(resolveDutch('2 large scallions', learned)).toEqual({ nl: 'lente-ui', source: 'learned' });
    expect(dutchKey('Finely chopped Green Onions')).toBe('green onion');
  });

  it('uses the Dutch name to guess a missing shop category', () => {
    expect(guessCategory('scallions')).toBe('Other');
    expect(guessCategoryWithDutch('scallions')).toBe('Vegetables & Fruit');
    expect(guessCategoryWithDutch('toasted sesame seeds')).toBe('Pantry');
  });

  it('knows when the Dutch name adds something', () => {
    expect(differsFromName('scallions', 'bosui')).toBe(true);
    expect(differsFromName('Broccoli', 'broccoli')).toBe(false);
    expect(differsFromName('x', null)).toBe(false);
  });

  it('merges English and Dutch names for the same thing on the shopping list', () => {
    const toDutch = (n: string) => resolveDutch(n).nl;
    const meal = (entryId: number, title: string, name: string, quantity: number) => ({
      entryId, date: '2026-10-26', title, scale: 1, have: new Set<number>(),
      ingredients: [{ id: entryId, name, quantity, unit: '', category: guessCategory(name) }],
    });
    const list = buildShoppingList('a', 'b', [meal(1, 'Bibimbap', 'green onions', 2), meal(2, 'Stamppot', 'bosui', 1)], [], toDutch);
    const items = list.groups.flatMap((g) => g.items);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ dutch: 'bosui', quantity: 3, name: 'green onions' });
    expect(shoppingListToText(list)).toContain('- 3 bosui (green onions)');
  });
});

describe('ingredient fractions', () => {
  it.each([
    ['1/4 cup soy sauce', 0.25, 'cup', 'soy sauce'],
    ['1 1/2 cups rice', 1.5, 'cups', 'rice'],
    ['1 lb lean ground beef', 1, 'lb', 'lean ground beef'],
  ])('%s', (line, q, unit, name) => expect(parseIngredientLine(line)).toMatchObject({ quantity: q, unit, name }));
});
