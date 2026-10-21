import type { Category } from './types';

// Keywords (Dutch and English) mapped to Albert Heijn-ish shop categories.
// The longest matching keyword wins, so "mushroom" beats "room" and
// "tomatenpuree" beats "tomaat". Keywords of 3 letters or fewer only match
// whole words, so "ei" (egg) doesn't match "geitenkaas".
const KEYWORDS: Record<Category, string[]> = {
  'Meat & Fish': [
    'kip', 'kipfilet', 'kippendij', 'chicken', 'gehakt', 'mince', 'minced', 'beef', 'rund', 'rundvlees',
    'biefstuk', 'steak', 'varken', 'pork', 'spek', 'spekjes', 'bacon', 'ham', 'worst', 'rookworst',
    'sausage', 'chorizo', 'salami', 'lam', 'lamb', 'kalkoen', 'turkey', 'vis', 'fish', 'zalm',
    'salmon', 'kabeljauw', 'cod', 'garnalen', 'prawns', 'shrimp', 'mosselen', 'mussels', 'shoarma',
    'gyros', 'tofu', 'tempeh', 'vegetarische', 'schnitzel', 'hamburger', 'burger',
  ],
  'Vegetables & Fruit': [
    'ui', 'uien', 'onion', 'onions', 'rode ui', 'sjalot', 'shallot', 'knoflook', 'garlic', 'tomaat',
    'tomaten', 'tomato', 'tomatoes', 'cherrytomaten', 'paprika', 'bell pepper', 'red pepper',
    'green pepper', 'chilipeper', 'chili pepper', 'wortel', 'wortels', 'carrot', 'carrots',
    'aardappel', 'aardappelen', 'aardappels', 'potato', 'potatoes', 'krieltjes', 'zoete aardappel',
    'sweet potato', 'sla', 'lettuce', 'rucola', 'arugula', 'spinazie', 'spinach', 'courgette',
    'zucchini', 'aubergine', 'eggplant', 'broccoli', 'bloemkool', 'cauliflower', 'boerenkool',
    'kale', 'andijvie', 'witlof', 'prei', 'leek', 'selderij', 'celery', 'komkommer', 'cucumber',
    'champignon', 'champignons', 'mushroom', 'mushrooms', 'avocado', 'mais', 'corn', 'sperziebonen',
    'green beans', 'doperwten', 'peas', 'pompoen', 'pumpkin', 'gember', 'ginger', 'peterselie',
    'parsley', 'koriander', 'cilantro', 'basilicum', 'basil', 'bieslook', 'chives', 'munt', 'mint',
    'dille', 'dill', 'lente-ui', 'bosui', 'spring onion', 'appel', 'appels', 'apple', 'apples',
    'peer', 'pear', 'banaan', 'bananen', 'banana', 'bananas', 'citroen', 'lemon', 'limoen', 'lime',
    'sinaasappel', 'orange', 'aardbeien', 'strawberries', 'blauwe bessen', 'blueberries', 'druiven',
    'grapes', 'mango', 'ananas', 'pineapple', 'kiwi', 'groente', 'vegetables', 'fruit', 'salade',
  ],
  'Dairy & Eggs': [
    'melk', 'milk', 'kaas', 'cheese', 'geitenkaas', 'feta', 'mozzarella', 'parmezaan', 'parmesan',
    'cheddar', 'boter', 'butter', 'roomboter', 'yoghurt', 'yogurt', 'kwark', 'slagroom', 'kookroom',
    'room', 'cream', 'crème fraîche', 'creme fraiche', 'zure room', 'sour cream', 'mascarpone',
    'ricotta', 'ei', 'eieren', 'egg', 'eggs', 'vla', 'karnemelk', 'buttermilk', 'halloumi',
  ],
  Bakery: [
    'brood', 'bread', 'stokbrood', 'baguette', 'bolletjes', 'broodjes', 'buns', 'bun', 'tortilla',
    'tortillas', 'wraps', 'wrap', 'pita', 'naan', 'croissant', 'croissants', 'beschuit', 'crackers',
    'ciabatta', 'focaccia', 'pizzadeeg', 'bladerdeeg', 'puff pastry',
  ],
  Pantry: [
    'rijst', 'rice', 'pasta', 'spaghetti', 'penne', 'macaroni', 'lasagnebladen', 'lasagne sheets',
    'noedels', 'noodles', 'mie', 'couscous', 'bulgur', 'quinoa', 'meel', 'bloem', 'flour', 'suiker',
    'sugar', 'zout', 'salt', 'peper', 'pepper', 'black pepper', 'zwarte peper', 'olie', 'oil',
    'olijfolie', 'olive oil', 'azijn', 'vinegar', 'bouillon', 'bouillonblokje', 'stock', 'tomatenpuree',
    'tomato paste', 'passata', 'tomatenblokjes', 'chopped tomatoes', 'canned tomatoes', 'blik',
    'bonen', 'beans', 'kidneybonen', 'kikkererwten', 'chickpeas', 'linzen', 'lentils', 'kruiden',
    'spices', 'komijn', 'cumin', 'kerrie', 'curry', 'currypasta', 'curry paste', 'kokosmelk',
    'coconut milk', 'sojasaus', 'soy sauce', 'ketjap', 'sambal', 'honing', 'honey', 'noten', 'nuts',
    'pinda', 'peanut', 'pindakaas', 'peanut butter', 'mosterd', 'mustard', 'ketchup', 'mayonaise',
    'mayo', 'jam', 'hagelslag', 'havermout', 'oats', 'muesli', 'cornflakes', 'cereal', 'bakpoeder',
    'baking powder', 'gist', 'yeast', 'vanille', 'vanilla', 'kaneel', 'cinnamon', 'oregano', 'tijm',
    'thyme', 'rozemarijn', 'rosemary', 'paprikapoeder', 'paprika powder', 'chocolade', 'chocolate',
    'tonijn', 'tuna', 'maïzena', 'cornstarch', 'pesto', 'wok saus', 'saus', 'sauce', 'sesame seed', 'sesame seeds',
    'sesamzaad', 'zaden', 'seeds', 'gochujang', 'gochugaru', 'kimchi',
  ],
  Frozen: [
    'diepvries', 'frozen', 'ijs', 'ice cream', 'diepvriesspinazie', 'friet', 'patat', 'fries',
    'diepvriesgroente', 'frozen peas', 'pizza',
  ],
  Drinks: [
    'water', 'spa', 'sap', 'juice', 'sinaasappelsap', 'orange juice', 'appelsap', 'bier', 'beer',
    'wijn', 'wine', 'cola', 'frisdrank', 'soda', 'limonade', 'ranja', 'koffie', 'coffee', 'thee',
    'tea', 'chocomel', 'prosecco',
  ],
  Household: [
    'toiletpapier', 'wc-papier', 'toilet paper', 'keukenpapier', 'keukenrol', 'paper towel',
    'paper towels', 'afwasmiddel', 'dish soap', 'vaatwastabletten', 'dishwasher tablets',
    'wasmiddel', 'laundry detergent', 'wasverzachter', 'vuilniszakken', 'bin bags', 'trash bags',
    'aluminiumfolie', 'aluminium foil', 'foil', 'vershoudfolie', 'cling film', 'bakpapier',
    'baking paper', 'schoonmaakmiddel', 'cleaner', 'sponzen', 'sponge', 'tandpasta', 'toothpaste',
    'shampoo', 'zeep', 'soap', 'luiers', 'diapers', 'billendoekjes', 'wipes', 'batterijen',
    'batteries', 'tissues', 'zakdoekjes',
  ],
  Other: [],
};

const ENTRIES: [string, Category][] = Object.entries(KEYWORDS)
  .flatMap(([cat, words]) => words.map((w) => [w, cat as Category] as [string, Category]))
  .sort((a, b) => b[0].length - a[0].length);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MATCHERS = ENTRIES.map(([word, cat]) => ({
  cat,
  re:
    word.length <= 3
      ? new RegExp(`(^|[^\\p{L}])${escapeRe(word)}([^\\p{L}]|$)`, 'u')
      : new RegExp(escapeRe(word), 'u'),
}));

export function guessCategory(name: string): Category {
  const n = name.toLowerCase().trim();
  if (!n) return 'Other';
  for (const m of MATCHERS) if (m.re.test(n)) return m.cat;
  return 'Other';
}
