// Types shared by the server API and the web app. A future native iOS app
// should mirror these shapes; see docs/API.md.

export const CATEGORIES = [
  'Meat & Fish',
  'Vegetables & Fruit',
  'Dairy & Eggs',
  'Bakery',
  'Pantry',
  'Frozen',
  'Drinks',
  'Household',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'other'] as const;
export type Slot = (typeof SLOTS)[number];

export const ENTRY_KINDS = ['recipe', 'leftovers', 'dining_out', 'fend', 'note'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export interface Ingredient {
  id?: number;
  name: string;
  quantity: number | null;
  unit: string;
  category: Category;
  note?: string;
}

export interface Recipe {
  id: number;
  title: string;
  description: string;
  photo: string | null; // URL path, e.g. /photos/12-1700000000.jpg
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  sourceUrl: string | null;
  tags: string[];
  notes: string;
  ingredients: Ingredient[];
  steps: string[];
  createdAt: string;
  updatedAt: string;
}

/** Recipe summary used by the recipe book list. */
export interface RecipeSummary {
  id: number;
  title: string;
  photo: string | null;
  tags: string[];
  servings: number;
  totalMinutes: number | null;
  lastPlanned: string | null; // most recent planned date on or before today
  nextPlanned: string | null; // next planned date after today
  timesPlanned: number;
}

export type RecipeInput = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'photo'> & {
  photo?: string | null;
};

export interface MealEntry {
  id: number;
  date: string; // YYYY-MM-DD
  slot: Slot;
  kind: EntryKind;
  recipeId: number | null;
  leftoverOfEntryId: number | null;
  title: string; // free title (for notes / dining out), or override
  who: string; // e.g. "Kid", "Everyone"
  servings: number | null; // override of recipe servings
  notes: string;
  sortOrder: number;
  // Denormalised for display
  displayTitle: string;
  photo: string | null;
  checkedCount: number;
  ingredientCount: number;
}

export interface EntryInput {
  date: string;
  slot?: Slot;
  kind: EntryKind;
  recipeId?: number | null;
  leftoverOfEntryId?: number | null;
  title?: string;
  who?: string;
  servings?: number | null;
  notes?: string;
}

export interface EntryDetail extends MealEntry {
  recipe: Recipe | null; // for leftovers: the source meal's recipe
  sourceEntry: MealEntry | null;
  checks: Record<number, boolean>; // ingredientId -> have it
  scale: number;
}

export interface ShoppingItem {
  key: string;
  name: string;
  quantity: number | null;
  unit: string;
  category: Category;
  /** Where this item comes from, e.g. "Lasagne (Wed)". */
  usedIn: string[];
  /** Ingredient references so the list can mark them as "have it". */
  refs: { entryId: number; ingredientId: number }[];
  extraId?: number;
}

export interface ShoppingGroup {
  category: Category;
  items: ShoppingItem[];
}

export interface ShoppingList {
  from: string;
  to: string;
  groups: ShoppingGroup[];
  haveCount: number;
}

export interface ExtraItem {
  id: number;
  name: string;
  category: Category;
  done: boolean;
}

export interface Settings {
  varietyWeeks: number;
  weekStart: 0 | 1; // 0 = Sunday, 1 = Monday
  people: string[];
}
