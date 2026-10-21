import { parseIngredientLine } from '../shared/ingredients';
import type { Repo } from './repo';

// A few family staples so the recipe book isn't empty on first run.
// Delete them freely; set SEED=0 to skip.
const SAMPLES = [
  {
    title: 'Lasagne',
    description: 'Classic beef lasagne. Makes enough for leftovers.',
    servings: 6,
    prepMinutes: 30,
    cookMinutes: 45,
    tags: ['oven', 'leftovers'],
    ingredients: [
      '500 g rundergehakt',
      '1 ui',
      '2 teentjes knoflook',
      '1 blik tomatenblokjes',
      '70 g tomatenpuree',
      '250 g lasagnebladen',
      '500 ml melk',
      '40 g roomboter',
      '40 g bloem',
      '150 g geraspte kaas',
    ],
    steps: [
      'Fry the onion and garlic, add the mince and brown it.',
      'Stir in the tomato paste and chopped tomatoes; simmer 15 minutes.',
      'Make a béchamel: melt butter, stir in flour, slowly whisk in the milk.',
      'Layer sauce, sheets and béchamel in an oven dish; finish with cheese.',
      'Bake 45 minutes at 180 °C.',
    ],
  },
  {
    title: 'Chicken stir-fry with rice',
    description: 'Quick weeknight wok.',
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 15,
    tags: ['quick', 'wok'],
    ingredients: [
      '300 g pandanrijst',
      '400 g kipfilet',
      '1 paprika',
      '1 broccoli',
      '2 el sojasaus',
      '1 el sesamolie',
      '1 stuk gember',
    ],
    steps: [
      'Cook the rice.',
      'Cut the chicken and vegetables into bite-size pieces.',
      'Stir-fry the chicken until golden, add vegetables and ginger.',
      'Finish with soy sauce and sesame oil; serve with rice.',
    ],
  },
  {
    title: 'Pasta pesto with cherry tomatoes',
    description: 'Kid favourite, ready in 15 minutes.',
    servings: 4,
    prepMinutes: 5,
    cookMinutes: 12,
    tags: ['quick', 'vegetarian'],
    ingredients: ['400 g penne', '1 potje pesto', '250 g cherrytomaten', '50 g parmezaan', '1 zakje rucola'],
    steps: ['Cook the pasta.', 'Halve the tomatoes.', 'Toss pasta with pesto, tomatoes and rucola; top with parmesan.'],
  },
  {
    title: 'Stamppot boerenkool',
    description: 'Dutch winter classic with rookworst.',
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 25,
    tags: ['dutch', 'winter'],
    ingredients: ['1 kg kruimige aardappelen', '450 g boerenkool', '1 rookworst', '150 ml melk', '25 g roomboter', 'mosterd'],
    steps: [
      'Boil the potatoes with the kale on top for 20 minutes.',
      'Heat the rookworst.',
      'Drain, mash with butter and warm milk; season with mustard, salt and pepper.',
    ],
  },
  {
    title: 'Salmon tray bake',
    description: 'One-tray oven dinner.',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 25,
    tags: ['oven', 'fish'],
    ingredients: ['4 zalmfilets', '600 g krieltjes', '300 g sperziebonen', '1 citroen', '2 el olijfolie'],
    steps: [
      'Roast the halved potatoes with oil for 15 minutes at 200 °C.',
      'Add beans and salmon, top with lemon slices, roast 10 more minutes.',
    ],
  },
];

export function seedIfEmpty(repo: Repo) {
  if (repo.recipeCount() > 0) return;
  for (const s of SAMPLES) {
    repo.createRecipe({
      ...s,
      sourceUrl: null,
      notes: '',
      ingredients: s.ingredients.map(parseIngredientLine),
    });
  }
}
