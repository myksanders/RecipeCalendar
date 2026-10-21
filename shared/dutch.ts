import { guessCategory } from './categorize';
import { normalizeName } from './shopping';
import type { Category } from './types';

// English → Dutch grocery names, worded the way Albert Heijn sells things, so
// a shopping list from an English recipe can be typed straight into the AH app.
// Keys are singular and already normalised (lowercase, no accents/punctuation).
// The household can teach extra names; those are stored on the server and win.
const DICTIONARY: Record<string, string> = {
  // vegetables
  onion: 'ui', 'yellow onion': 'ui', 'white onion': 'ui', 'red onion': 'rode ui', shallot: 'sjalot',
  garlic: 'knoflook', 'garlic clove': 'knoflook', scallion: 'bosui', 'green onion': 'bosui', 'spring onion': 'bosui',
  leek: 'prei', carrot: 'wortel', potato: 'aardappelen', 'baby potato': 'krieltjes', 'sweet potato': 'zoete aardappel',
  tomato: 'tomaat', 'cherry tomato': 'cherrytomaten', 'plum tomato': 'romatomaten', cucumber: 'komkommer',
  zucchini: 'courgette', courgette: 'courgette', eggplant: 'aubergine', aubergine: 'aubergine',
  'bell pepper': 'paprika', 'red bell pepper': 'paprika', 'red pepper': 'paprika', 'green pepper': 'groene paprika',
  'yellow pepper': 'gele paprika', chili: 'rode peper', chile: 'rode peper', chilies: 'rode peper',
  'chili pepper': 'rode peper', 'red chili': 'rode peper', 'green chili': 'groene peper', jalapeno: 'jalapeño peper',
  mushroom: 'champignons', 'button mushroom': 'champignons', 'shiitake mushroom': 'shiitake', shiitake: 'shiitake',
  'oyster mushroom': 'oesterzwammen', 'portobello mushroom': 'portobello', spinach: 'spinazie', 'baby spinach': 'spinazie',
  lettuce: 'sla', 'romaine lettuce': 'romaine sla', 'iceberg lettuce': 'ijsbergsla', arugula: 'rucola', rocket: 'rucola',
  kale: 'boerenkool', cabbage: 'witte kool', 'white cabbage': 'witte kool', 'red cabbage': 'rode kool',
  'napa cabbage': 'chinese kool', 'chinese cabbage': 'chinese kool', 'savoy cabbage': 'savooiekool',
  'bok choy': 'paksoi', 'pak choi': 'paksoi', 'baby bok choy': 'paksoi', broccoli: 'broccoli', broccolini: 'bimi',
  cauliflower: 'bloemkool', 'brussels sprout': 'spruitjes', 'green bean': 'sperziebonen', 'string bean': 'sperziebonen',
  'snow pea': 'peultjes', 'sugar snap pea': 'sugarsnaps', pea: 'doperwten', 'green pea': 'doperwten',
  corn: 'mais', sweetcorn: 'mais', 'corn kernel': 'mais', 'bean sprout': 'taugé', celery: 'bleekselderij',
  'celery stalk': 'bleekselderij', celeriac: 'knolselderij', fennel: 'venkel', asparagus: 'asperges',
  beet: 'rode biet', beetroot: 'rode biet', radish: 'radijs', 'daikon radish': 'rettich', daikon: 'rettich',
  pumpkin: 'pompoen', 'butternut squash': 'flespompoen', squash: 'pompoen', avocado: 'avocado', endive: 'witlof',
  'mixed salad': 'gemengde sla', 'salad green': 'gemengde sla', parsnip: 'pastinaak', turnip: 'raap',
  // fruit
  lemon: 'citroen', 'lemon juice': 'citroensap', 'lemon zest': 'citroen', lime: 'limoen', 'lime juice': 'limoensap',
  orange: 'sinaasappel', apple: 'appel', pear: 'peer', banana: 'banaan', strawberry: 'aardbeien',
  blueberry: 'blauwe bessen', raspberry: 'frambozen', blackberry: 'bramen', grape: 'druiven', mango: 'mango',
  pineapple: 'ananas', kiwi: 'kiwi', watermelon: 'watermeloen', melon: 'meloen', peach: 'perzik', plum: 'pruim',
  cherry: 'kersen', 'asian pear': 'nashi peer', date: 'dadels', raisin: 'rozijnen', cranberry: 'cranberries',
  // herbs
  ginger: 'gember', 'fresh ginger': 'gember', 'ginger root': 'gember', lemongrass: 'citroengras',
  cilantro: 'koriander', coriander: 'koriander', 'fresh coriander': 'koriander', parsley: 'peterselie',
  'flat leaf parsley': 'platte peterselie', basil: 'basilicum', 'thai basil': 'thaise basilicum', mint: 'munt',
  dill: 'dille', chive: 'bieslook', thyme: 'tijm', rosemary: 'rozemarijn', sage: 'salie', 'bay leaf': 'laurierblad',
  'bay leaves': 'laurierblad', oregano: 'oregano', tarragon: 'dragon',
  // meat & fish
  'ground beef': 'rundergehakt', 'minced beef': 'rundergehakt', 'beef mince': 'rundergehakt', 'lean ground beef': 'rundergehakt',
  'ground pork': 'varkensgehakt', 'pork mince': 'varkensgehakt', 'minced pork': 'varkensgehakt', 'ground meat': 'gehakt',
  mince: 'gehakt', 'ground chicken': 'kipgehakt', 'ground turkey': 'kalkoengehakt',
  chicken: 'kip', 'chicken breast': 'kipfilet', 'chicken fillet': 'kipfilet', 'chicken thigh': 'kippendijen',
  'boneless chicken thigh': 'kippendijfilet', 'chicken drumstick': 'drumsticks', 'chicken leg': 'kippenpoten',
  'chicken wing': 'kippenvleugels', 'whole chicken': 'hele kip', beef: 'rundvlees', steak: 'biefstuk',
  'beef steak': 'biefstuk', sirloin: 'entrecote', ribeye: 'ribeye', 'flank steak': 'bavette', 'skirt steak': 'bavette',
  'stewing beef': 'runderstoofvlees', 'stew beef': 'runderstoofvlees', 'beef chuck': 'runderstoofvlees',
  'short rib': 'short ribs', 'thinly sliced beef': 'rundvlees reepjes', 'beef strip': 'rundvlees reepjes',
  pork: 'varkensvlees', 'pork belly': 'buikspek', 'pork chop': 'karbonade', 'pork tenderloin': 'varkenshaas',
  'pork loin': 'varkenshaas', 'pork shoulder': 'varkensschouder', 'pork rib': 'spareribs', sparerib: 'spareribs',
  bacon: 'bacon', pancetta: 'spekjes', 'diced bacon': 'spekjes', lardon: 'spekjes', ham: 'ham', prosciutto: 'parmaham',
  sausage: 'worst', 'smoked sausage': 'rookworst', chorizo: 'chorizo', salami: 'salami', lamb: 'lamsvlees',
  'lamb chop': 'lamskoteletten', 'ground lamb': 'lamsgehakt', turkey: 'kalkoen', 'turkey breast': 'kalkoenfilet',
  duck: 'eend', 'duck breast': 'eendenborst', salmon: 'zalm', 'salmon fillet': 'zalmfilet', 'smoked salmon': 'gerookte zalm',
  cod: 'kabeljauw', 'white fish': 'witvis', tilapia: 'tilapia', pollock: 'koolvis', tuna: 'tonijn',
  'canned tuna': 'tonijn in blik', shrimp: 'garnalen', prawn: 'garnalen', 'king prawn': 'gamba', mussel: 'mosselen',
  squid: 'inktvis', anchovy: 'ansjovis', anchovies: 'ansjovis', tofu: 'tofu', 'firm tofu': 'tofu', tempeh: 'tempeh',
  // dairy & eggs
  egg: 'eieren', 'egg yolk': 'eieren', 'egg white': 'eieren', milk: 'melk', 'whole milk': 'volle melk',
  'skim milk': 'magere melk', butter: 'roomboter', 'unsalted butter': 'ongezouten roomboter', cream: 'room',
  'heavy cream': 'slagroom', 'whipping cream': 'slagroom', 'double cream': 'slagroom', 'cooking cream': 'kookroom',
  'single cream': 'kookroom', 'sour cream': 'zure room', 'creme fraiche': 'crème fraîche', yogurt: 'yoghurt',
  yoghurt: 'yoghurt', 'greek yogurt': 'griekse yoghurt', 'plain yogurt': 'yoghurt', cheese: 'kaas', cheddar: 'cheddar',
  'cheddar cheese': 'cheddar', mozzarella: 'mozzarella', parmesan: 'parmezaanse kaas', 'parmesan cheese': 'parmezaanse kaas',
  feta: 'feta', 'feta cheese': 'feta', 'goat cheese': 'geitenkaas', 'cream cheese': 'roomkaas', ricotta: 'ricotta',
  mascarpone: 'mascarpone', 'shredded cheese': 'geraspte kaas', 'grated cheese': 'geraspte kaas', gouda: 'goudse kaas',
  halloumi: 'halloumi', buttermilk: 'karnemelk', quark: 'kwark',
  // pantry
  rice: 'rijst', 'white rice': 'witte rijst', 'jasmine rice': 'jasmijnrijst', 'basmati rice': 'basmatirijst',
  'short grain rice': 'sushirijst', 'sushi rice': 'sushirijst', 'brown rice': 'zilvervliesrijst', 'cooked rice': 'rijst',
  'steamed rice': 'rijst', 'arborio rice': 'risottorijst', pasta: 'pasta', spaghetti: 'spaghetti', penne: 'penne',
  macaroni: 'macaroni', fusilli: 'fusilli', 'lasagna sheet': 'lasagnebladen', 'lasagne sheet': 'lasagnebladen',
  noodle: 'noedels', 'egg noodle': 'mie', 'rice noodle': 'rijstnoedels', 'glass noodle': 'glasnoedels',
  'sweet potato noodle': 'glasnoedels', 'ramen noodle': 'ramen noedels', udon: 'udon noedels', 'udon noodle': 'udon noedels',
  'soba noodle': 'soba noedels', couscous: 'couscous', bulgur: 'bulgur', quinoa: 'quinoa',
  flour: 'bloem', 'all purpose flour': 'bloem', 'plain flour': 'bloem', 'self raising flour': 'zelfrijzend bakmeel',
  cornstarch: 'maïzena', 'corn starch': 'maïzena', cornflour: 'maïzena', 'potato starch': 'aardappelzetmeel',
  sugar: 'suiker', 'white sugar': 'kristalsuiker', 'granulated sugar': 'kristalsuiker', 'brown sugar': 'bruine basterdsuiker',
  'light brown sugar': 'lichtbruine basterdsuiker', 'powdered sugar': 'poedersuiker', 'icing sugar': 'poedersuiker',
  honey: 'honing', 'maple syrup': 'ahornsiroop', salt: 'zout', 'sea salt': 'zeezout', pepper: 'zwarte peper',
  'black pepper': 'zwarte peper', 'ground black pepper': 'zwarte peper', 'white pepper': 'witte peper',
  'olive oil': 'olijfolie', 'extra virgin olive oil': 'olijfolie extra vierge', 'vegetable oil': 'zonnebloemolie',
  'sunflower oil': 'zonnebloemolie', 'canola oil': 'raapzaadolie', 'neutral oil': 'zonnebloemolie', 'cooking oil': 'zonnebloemolie',
  'sesame oil': 'sesamolie', 'toasted sesame oil': 'sesamolie', 'coconut oil': 'kokosolie', oil: 'olie',
  vinegar: 'azijn', 'rice vinegar': 'rijstazijn', 'rice wine vinegar': 'rijstazijn', 'apple cider vinegar': 'appelazijn',
  'balsamic vinegar': 'balsamicoazijn', 'white wine vinegar': 'witte wijnazijn', 'red wine vinegar': 'rode wijnazijn',
  'soy sauce': 'sojasaus', 'light soy sauce': 'sojasaus', 'dark soy sauce': 'donkere sojasaus', 'low sodium soy sauce': 'sojasaus',
  'sweet soy sauce': 'ketjap manis', 'kecap manis': 'ketjap manis', tamari: 'tamari', 'fish sauce': 'vissaus',
  'oyster sauce': 'oestersaus', 'hoisin sauce': 'hoisinsaus', sriracha: 'sriracha', 'chili sauce': 'chilisaus',
  'sweet chili sauce': 'zoete chilisaus', gochujang: 'gochujang', 'korean chili paste': 'gochujang',
  gochugaru: 'gochugaru', 'korean chili flake': 'gochugaru', 'korean red pepper flake': 'gochugaru', doenjang: 'doenjang',
  miso: 'miso', 'miso paste': 'misopasta', mirin: 'mirin', sake: 'sake', 'rice wine': 'rijstwijn', 'cooking wine': 'rijstwijn',
  'shaoxing wine': 'shaoxing rijstwijn', 'sesame seed': 'sesamzaad', 'toasted sesame seed': 'sesamzaad',
  'chili flake': 'chilivlokken', 'red pepper flake': 'chilivlokken', 'crushed red pepper': 'chilivlokken',
  'chili powder': 'chilipoeder', 'cayenne pepper': 'cayennepeper', cayenne: 'cayennepeper', paprika: 'paprikapoeder',
  'paprika powder': 'paprikapoeder', 'smoked paprika': 'gerookt paprikapoeder', 'sweet paprika': 'paprikapoeder',
  cumin: 'komijn', 'ground cumin': 'komijnpoeder', 'ground coriander': 'korianderpoeder', turmeric: 'kurkuma',
  cinnamon: 'kaneel', 'curry powder': 'kerriepoeder', 'garam masala': 'garam masala', 'five spice': 'vijfkruidenpoeder',
  'chinese five spice': 'vijfkruidenpoeder', nutmeg: 'nootmuskaat', clove: 'kruidnagel', 'star anise': 'steranijs',
  'garlic powder': 'knoflookpoeder', 'onion powder': 'uienpoeder', 'italian seasoning': 'italiaanse kruiden',
  'dried oregano': 'oregano', 'dried thyme': 'tijm', stock: 'bouillon', broth: 'bouillon',
  'chicken stock': 'kippenbouillon', 'chicken broth': 'kippenbouillon', 'beef stock': 'runderbouillon',
  'beef broth': 'runderbouillon', 'vegetable stock': 'groentebouillon', 'vegetable broth': 'groentebouillon',
  'stock cube': 'bouillonblokjes', 'bouillon cube': 'bouillonblokjes', 'tomato paste': 'tomatenpuree',
  'tomato puree': 'tomatenpuree', 'canned tomato': 'tomatenblokjes', 'diced tomato': 'tomatenblokjes',
  'chopped tomato': 'tomatenblokjes', 'crushed tomato': 'gezeefde tomaten', passata: 'passata', 'tomato sauce': 'passata',
  'coconut milk': 'kokosmelk', 'coconut cream': 'kokosroom', 'peanut butter': 'pindakaas', peanut: "pinda's",
  cashew: 'cashewnoten', almond: 'amandelen', walnut: 'walnoten', 'pine nut': 'pijnboompitten', pistachio: "pistache's",
  chickpea: 'kikkererwten', 'kidney bean': 'kidneybonen', 'black bean': 'zwarte bonen', 'white bean': 'witte bonen',
  'cannellini bean': 'cannellini bonen', lentil: 'linzen', 'red lentil': 'rode linzen', breadcrumb: 'paneermeel',
  panko: 'panko', oat: 'havermout', 'rolled oat': 'havermout', mustard: 'mosterd', 'dijon mustard': 'dijonmosterd',
  'whole grain mustard': 'grove mosterd', ketchup: 'ketchup', mayonnaise: 'mayonaise', mayo: 'mayonaise',
  'kewpie mayonnaise': 'japanse mayonaise', 'baking powder': 'bakpoeder', 'baking soda': 'zuiveringszout',
  yeast: 'gist', 'vanilla extract': 'vanille-extract', vanilla: 'vanille', 'cocoa powder': 'cacaopoeder',
  chocolate: 'chocolade', 'dark chocolate': 'pure chocolade', 'chocolate chip': 'chocoladedruppels',
  'curry paste': 'currypasta', 'red curry paste': 'rode currypasta', 'green curry paste': 'groene currypasta',
  kimchi: 'kimchi', nori: 'nori', seaweed: 'zeewier', 'roasted seaweed': 'nori', pesto: 'pesto', olive: 'olijven',
  'black olive': 'zwarte olijven', caper: 'kappertjes', 'sun dried tomato': 'zongedroogde tomaten', jam: 'jam',
  'worcestershire sauce': 'worcestershiresaus', 'hot sauce': 'hete saus', tahini: 'tahin', hummus: 'hummus',
  // bakery
  bread: 'brood', baguette: 'stokbrood', 'sourdough bread': 'desembrood', tortilla: 'wraps', wrap: 'wraps',
  'flour tortilla': 'wraps', 'corn tortilla': 'maistortilla', pita: 'pitabroodjes', 'pita bread': 'pitabroodjes',
  naan: 'naan', bun: 'broodjes', 'burger bun': 'hamburgerbroodjes', 'hamburger bun': 'hamburgerbroodjes',
  'hot dog bun': 'hotdogbroodjes', croissant: 'croissants', 'puff pastry': 'bladerdeeg', 'pizza dough': 'pizzadeeg',
  // frozen
  'frozen pea': 'diepvries doperwten', 'frozen spinach': 'diepvries spinazie', 'frozen corn': 'diepvries mais',
  'frozen dumpling': 'diepvries dumplings', dumpling: 'dumplings', 'ice cream': 'ijs', fries: 'friet',
  // drinks
  water: 'water', 'sparkling water': 'bruisend water', juice: 'sap', 'orange juice': 'sinaasappelsap',
  'apple juice': 'appelsap', beer: 'bier', wine: 'wijn', 'red wine': 'rode wijn', 'white wine': 'witte wijn',
  coffee: 'koffie', tea: 'thee', soda: 'frisdrank',
  // household
  'toilet paper': 'toiletpapier', 'paper towel': 'keukenpapier', 'kitchen roll': 'keukenpapier',
  'dish soap': 'afwasmiddel', 'washing up liquid': 'afwasmiddel', 'dishwasher tablet': 'vaatwastabletten',
  'laundry detergent': 'wasmiddel', 'fabric softener': 'wasverzachter', 'trash bag': 'vuilniszakken',
  'bin bag': 'vuilniszakken', 'garbage bag': 'vuilniszakken', 'aluminum foil': 'aluminiumfolie',
  'aluminium foil': 'aluminiumfolie', 'tin foil': 'aluminiumfolie', 'plastic wrap': 'vershoudfolie',
  'cling film': 'vershoudfolie', 'baking paper': 'bakpapier', 'parchment paper': 'bakpapier', sponge: 'sponsjes',
  toothpaste: 'tandpasta', shampoo: 'shampoo', 'hand soap': 'handzeep', diaper: 'luiers', wipe: 'billendoekjes',
  battery: 'batterijen', tissue: 'tissues',
};

// Dutch words that aren't dictionary values but show a name is already Dutch.
const EXTRA_DUTCH = ['parmezaan', 'kruimige', 'vastkokende', 'kipdijfilet', 'bosje', 'teentjes', 'gesneden', 'verse'];

// Descriptive words dropped from the key so "2 large fresh carrots" and
// "carrot" teach and find the same thing.
const PREP_WORDS = new Set([
  'fresh', 'freshly', 'finely', 'roughly', 'thinly', 'chopped', 'minced', 'diced', 'sliced', 'grated', 'shredded',
  'crushed', 'large', 'small', 'medium', 'big', 'peeled', 'trimmed', 'halved', 'quartered', 'packed', 'divided',
  'optional', 'to', 'taste', 'about', 'cup', 'cups', 'of', 'and', 'or', 'some', 'a', 'few', 'plus', 'more', 'for',
  'serving', 'garnish', 'raw', 'uncooked', 'cooked', 'boneless', 'skinless', 'organic', 'room', 'temperature',
]);

function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (/(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Stable key for an ingredient name: normalised, prep words removed, singular. */
export function dutchKey(name: string): string {
  return normalizeName(name)
    .split(' ')
    .filter((w) => w && !PREP_WORDS.has(w) && !/^\d+$/.test(w))
    .map(singular)
    .join(' ');
}

const DICT_KEYS = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length);
const DUTCH_WORDS = [...new Set([...Object.values(DICTIONARY).map((v) => normalizeName(v)), ...EXTRA_DUTCH])].sort(
  (a, b) => b.length - a.length,
);

function containsPhrase(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${phrase} `);
}

export type DutchSource = 'learned' | 'dictionary' | 'dutch';
export interface DutchName {
  nl: string | null;
  source: DutchSource | null;
}

/**
 * Dutch name for an ingredient: a name the household taught wins, then the
 * dictionary (exact, then the longest phrase inside the name), then "it's
 * already Dutch". Returns nl = null when unknown.
 */
export function resolveDutch(name: string, learned: ReadonlyMap<string, string> = new Map()): DutchName {
  const key = dutchKey(name);
  if (!key) return { nl: null, source: null };
  const taught = learned.get(key);
  if (taught) return { nl: taught, source: 'learned' };

  const plain = normalizeName(name);
  if (DICTIONARY[key]) return { nl: DICTIONARY[key], source: 'dictionary' };
  for (const k of DICT_KEYS) {
    if (containsPhrase(key, k) || containsPhrase(plain, k)) return { nl: DICTIONARY[k], source: 'dictionary' };
  }

  // Already Dutch? Whole words ("geraspte kaas"), or a compound containing a
  // longer Dutch word ("pandanrijst" contains "rijst").
  for (const w of DUTCH_WORDS) {
    if (containsPhrase(plain, w) || (w.length >= 5 && plain.split(' ').some((t) => t.includes(w)))) {
      return { nl: name.trim(), source: 'dutch' };
    }
  }
  return { nl: null, source: null };
}

/** True when the Dutch name adds information (not just the same word). */
export function differsFromName(name: string, nl: string | null | undefined): nl is string {
  return !!nl && normalizeName(nl) !== normalizeName(name);
}

export function ahSearchUrl(query: string): string {
  return `https://www.ah.nl/zoeken?query=${encodeURIComponent(query)}`;
}

/** Category guess that also tries the Dutch name ("scallions" → "bosui" → vegetables). */
export function guessCategoryWithDutch(name: string, learned?: ReadonlyMap<string, string>): Category {
  const direct = guessCategory(name);
  if (direct !== 'Other') return direct;
  const nl = resolveDutch(name, learned).nl;
  return nl ? guessCategory(nl) : 'Other';
}
