import { transaction, type DB } from './db';
import { today } from '../shared/dates';
import { buildShoppingList, type PlannedMeal } from '../shared/shopping';
import type {
  Category,
  EntryDetail,
  EntryInput,
  ExtraItem,
  Ingredient,
  MealEntry,
  Recipe,
  RecipeInput,
  RecipeSummary,
  Settings,
  ShoppingList,
} from '../shared/types';

type Row = Record<string, any>;

const DEFAULT_SETTINGS: Settings = { varietyWeeks: 3, weekStart: 1, mealSlots: ['dinner'], people: ['Everyone', 'Kid'] };

export function createRepo(db: DB) {
  // ---------- recipes ----------

  function rowToRecipe(r: Row): Recipe {
    const ingredients = db
      .prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order, id')
      .all(r.id)
      .map(
        (i: Row): Ingredient => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          category: i.category,
          ...(i.note ? { note: i.note } : {}),
        }),
      );
    const steps = db
      .prepare('SELECT text FROM steps WHERE recipe_id = ? ORDER BY sort_order, id')
      .all(r.id)
      .map((s: Row) => s.text as string);
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      photo: r.photo,
      servings: r.servings,
      prepMinutes: r.prep_minutes,
      cookMinutes: r.cook_minutes,
      sourceUrl: r.source_url,
      tags: JSON.parse(r.tags),
      notes: r.notes,
      ingredients,
      steps,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  function getRecipe(id: number): Recipe | null {
    const r = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
    return r ? rowToRecipe(r as Row) : null;
  }

  function listRecipes(): RecipeSummary[] {
    const t = today();
    const rows = db
      .prepare(
        `SELECT r.*,
           (SELECT MAX(date) FROM meal_entries e WHERE e.recipe_id = r.id AND e.kind = 'recipe' AND e.date <= ?) AS last_planned,
           (SELECT MIN(date) FROM meal_entries e WHERE e.recipe_id = r.id AND e.kind = 'recipe' AND e.date > ?) AS next_planned,
           (SELECT COUNT(*) FROM meal_entries e WHERE e.recipe_id = r.id AND e.kind = 'recipe') AS times_planned
         FROM recipes r ORDER BY r.title COLLATE NOCASE`,
      )
      .all(t, t) as Row[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      photo: r.photo,
      tags: JSON.parse(r.tags),
      servings: r.servings,
      totalMinutes:
        r.prep_minutes === null && r.cook_minutes === null ? null : (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0),
      lastPlanned: r.last_planned,
      nextPlanned: r.next_planned,
      timesPlanned: r.times_planned,
    }));
  }

  function writeChildren(recipeId: number, input: RecipeInput) {
    // Keep ingredient ids stable so "have it" checks survive edits.
    const existing = new Set(
      db.prepare('SELECT id FROM ingredients WHERE recipe_id = ?').all(recipeId).map((r: Row) => r.id as number),
    );
    const keep = new Set<number>();
    const update = db.prepare(
      'UPDATE ingredients SET name = ?, quantity = ?, unit = ?, category = ?, note = ?, sort_order = ? WHERE id = ? AND recipe_id = ?',
    );
    const insert = db.prepare(
      'INSERT INTO ingredients (recipe_id, name, quantity, unit, category, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    input.ingredients.forEach((ing, idx) => {
      const vals = [ing.name, ing.quantity, ing.unit ?? '', ing.category, ing.note ?? null, idx] as const;
      if (ing.id && existing.has(ing.id)) {
        update.run(...vals, ing.id, recipeId);
        keep.add(ing.id);
      } else {
        insert.run(recipeId, ...vals);
      }
    });
    const del = db.prepare('DELETE FROM ingredients WHERE id = ?');
    for (const id of existing) if (!keep.has(id)) del.run(id);

    db.prepare('DELETE FROM steps WHERE recipe_id = ?').run(recipeId);
    const insStep = db.prepare('INSERT INTO steps (recipe_id, sort_order, text) VALUES (?, ?, ?)');
    input.steps.forEach((text, idx) => insStep.run(recipeId, idx, text));
  }

  function createRecipe(input: RecipeInput): Recipe {
    const id = transaction(db, () => {
      const res = db
        .prepare(
          `INSERT INTO recipes (title, description, photo, servings, prep_minutes, cook_minutes, source_url, tags, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.title,
          input.description,
          input.photo ?? null,
          input.servings,
          input.prepMinutes,
          input.cookMinutes,
          input.sourceUrl,
          JSON.stringify(input.tags),
          input.notes,
        );
      const id = Number(res.lastInsertRowid);
      writeChildren(id, input);
      return id;
    });
    return getRecipe(id)!;
  }

  function updateRecipe(id: number, input: RecipeInput): Recipe | null {
    if (!getRecipe(id)) return null;
    transaction(db, () => {
      db.prepare(
        `UPDATE recipes SET title = ?, description = ?, servings = ?, prep_minutes = ?, cook_minutes = ?,
           source_url = ?, tags = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(
        input.title,
        input.description,
        input.servings,
        input.prepMinutes,
        input.cookMinutes,
        input.sourceUrl,
        JSON.stringify(input.tags),
        input.notes,
        id,
      );
      if (input.photo !== undefined) db.prepare('UPDATE recipes SET photo = ? WHERE id = ?').run(input.photo, id);
      writeChildren(id, input);
    });
    return getRecipe(id);
  }

  function setRecipePhoto(id: number, photo: string | null) {
    db.prepare(`UPDATE recipes SET photo = ?, updated_at = datetime('now') WHERE id = ?`).run(photo, id);
  }

  function deleteRecipe(id: number): boolean {
    return db.prepare('DELETE FROM recipes WHERE id = ?').run(id).changes > 0;
  }

  /** Entries for this recipe within `weeks` weeks of `date` (excluding one entry). */
  function nearbyPlans(recipeId: number, date: string, weeks: number, excludeEntryId?: number): string[] {
    return db
      .prepare(
        `SELECT date FROM meal_entries WHERE recipe_id = ? AND kind = 'recipe' AND id != ?
         AND ABS(julianday(date) - julianday(?)) < ? ORDER BY date`,
      )
      .all(recipeId, excludeEntryId ?? -1, date, weeks * 7)
      .map((r: Row) => r.date as string);
  }

  // ---------- meal entries ----------

  const ENTRY_SELECT = `
    SELECT e.*,
      COALESCE(r.title, sr.title) AS recipe_title,
      COALESCE(r.photo, sr.photo) AS recipe_photo,
      se.title AS source_title, se.kind AS source_kind,
      (SELECT COUNT(*) FROM ingredients i WHERE i.recipe_id = e.recipe_id) AS ingredient_count,
      (SELECT COUNT(*) FROM entry_checks c WHERE c.entry_id = e.id) AS checked_count
    FROM meal_entries e
    LEFT JOIN recipes r ON r.id = e.recipe_id
    LEFT JOIN meal_entries se ON se.id = e.leftover_of_entry_id
    LEFT JOIN recipes sr ON sr.id = se.recipe_id`;

  const KIND_LABEL: Record<string, string> = {
    dining_out: 'Dinner out',
    fend: 'Fend for yourselves',
    note: 'Note',
    leftovers: 'Leftovers',
    recipe: 'Meal',
  };

  function rowToEntry(r: Row): MealEntry {
    let displayTitle = r.title as string;
    if (!displayTitle) {
      if (r.kind === 'recipe') displayTitle = r.recipe_title ?? 'Deleted recipe';
      else if (r.kind === 'leftovers')
        displayTitle = r.recipe_title || r.source_title ? `Leftovers: ${r.recipe_title ?? r.source_title}` : 'Leftovers';
      else displayTitle = KIND_LABEL[r.kind] ?? r.kind;
    }
    return {
      id: r.id,
      date: r.date,
      slot: r.slot,
      kind: r.kind,
      recipeId: r.recipe_id,
      leftoverOfEntryId: r.leftover_of_entry_id,
      title: r.title,
      who: r.who,
      servings: r.servings,
      notes: r.notes,
      sortOrder: r.sort_order,
      displayTitle,
      photo: r.kind === 'recipe' || r.kind === 'leftovers' ? r.recipe_photo : null,
      checkedCount: r.kind === 'recipe' ? r.checked_count : 0,
      ingredientCount: r.kind === 'recipe' ? r.ingredient_count : 0,
    };
  }

  function listEntries(from: string, to: string): MealEntry[] {
    return (
      db
        .prepare(
          `${ENTRY_SELECT} WHERE e.date BETWEEN ? AND ?
           ORDER BY e.date, CASE e.slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'dinner' THEN 2 ELSE 3 END,
             e.sort_order, e.id`,
        )
        .all(from, to) as Row[]
    ).map(rowToEntry);
  }

  function getEntry(id: number): MealEntry | null {
    const r = db.prepare(`${ENTRY_SELECT} WHERE e.id = ?`).get(id);
    return r ? rowToEntry(r as Row) : null;
  }

  function entryScale(entry: MealEntry, recipe: Recipe | null) {
    if (!recipe || !entry.servings || !recipe.servings) return 1;
    return entry.servings / recipe.servings;
  }

  function getEntryDetail(id: number): EntryDetail | null {
    const entry = getEntry(id);
    if (!entry) return null;
    const sourceEntry = entry.leftoverOfEntryId ? getEntry(entry.leftoverOfEntryId) : null;
    const recipeId = entry.recipeId ?? sourceEntry?.recipeId ?? null;
    const recipe = recipeId ? getRecipe(recipeId) : null;
    // Leftovers show the source meal's checklist state; they never add to shopping.
    const checkEntryId = entry.kind === 'leftovers' && sourceEntry ? sourceEntry.id : entry.id;
    const checks: Record<number, boolean> = {};
    for (const c of db.prepare('SELECT ingredient_id FROM entry_checks WHERE entry_id = ?').all(checkEntryId) as Row[])
      checks[c.ingredient_id] = true;
    return { ...entry, recipe, sourceEntry, checks, scale: entryScale(entry, recipe) };
  }

  function createEntry(input: EntryInput): MealEntry {
    const slot = input.slot ?? 'dinner';
    const max = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM meal_entries WHERE date = ? AND slot = ?')
      .get(input.date, slot) as Row;
    const res = db
      .prepare(
        `INSERT INTO meal_entries (date, slot, kind, recipe_id, leftover_of_entry_id, title, who, servings, notes, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.date,
        slot,
        input.kind,
        input.kind === 'recipe' ? (input.recipeId ?? null) : null,
        input.kind === 'leftovers' ? (input.leftoverOfEntryId ?? null) : null,
        input.title ?? '',
        input.who ?? '',
        input.servings ?? null,
        input.notes ?? '',
        max.m + 1,
      );
    return getEntry(Number(res.lastInsertRowid))!;
  }

  function updateEntry(id: number, patch: Partial<EntryInput> & { sortOrder?: number }): MealEntry | null {
    const cur = getEntry(id);
    if (!cur) return null;
    const next = {
      date: patch.date ?? cur.date,
      slot: patch.slot ?? cur.slot,
      title: patch.title ?? cur.title,
      who: patch.who ?? cur.who,
      servings: patch.servings !== undefined ? patch.servings : cur.servings,
      notes: patch.notes ?? cur.notes,
      sortOrder: patch.sortOrder ?? cur.sortOrder,
      leftoverOfEntryId:
        patch.leftoverOfEntryId !== undefined ? patch.leftoverOfEntryId : cur.leftoverOfEntryId,
    };
    db.prepare(
      `UPDATE meal_entries SET date = ?, slot = ?, title = ?, who = ?, servings = ?, notes = ?, sort_order = ?,
         leftover_of_entry_id = ? WHERE id = ?`,
    ).run(
      next.date,
      next.slot,
      next.title,
      next.who,
      next.servings,
      next.notes,
      next.sortOrder,
      cur.kind === 'leftovers' ? next.leftoverOfEntryId : null,
      id,
    );
    return getEntry(id);
  }

  function deleteEntry(id: number): boolean {
    return db.prepare('DELETE FROM meal_entries WHERE id = ?').run(id).changes > 0;
  }

  function setCheck(entryId: number, ingredientId: number, have: boolean) {
    if (have)
      db.prepare('INSERT OR IGNORE INTO entry_checks (entry_id, ingredient_id) VALUES (?, ?)').run(entryId, ingredientId);
    else db.prepare('DELETE FROM entry_checks WHERE entry_id = ? AND ingredient_id = ?').run(entryId, ingredientId);
  }

  function setChecks(refs: { entryId: number; ingredientId: number }[], have: boolean) {
    transaction(db, () => refs.forEach((r) => setCheck(r.entryId, r.ingredientId, have)));
  }

  // ---------- shopping ----------

  function shoppingList(from: string, to: string): ShoppingList {
    const entries = listEntries(from, to).filter((e) => e.kind === 'recipe' && e.recipeId);
    const meals: PlannedMeal[] = entries.map((e) => {
      const recipe = getRecipe(e.recipeId!)!;
      const have = new Set(
        (db.prepare('SELECT ingredient_id FROM entry_checks WHERE entry_id = ?').all(e.id) as Row[]).map(
          (r) => r.ingredient_id as number,
        ),
      );
      return {
        entryId: e.id,
        date: e.date,
        title: e.displayTitle,
        scale: entryScale(e, recipe),
        ingredients: recipe.ingredients.map((i) => ({
          id: i.id!,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          category: i.category,
        })),
        have,
      };
    });
    return buildShoppingList(from, to, meals, listExtras());
  }

  // ---------- extras ----------

  function listExtras(): ExtraItem[] {
    return (db.prepare('SELECT * FROM extra_items ORDER BY id').all() as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      done: !!r.done,
    }));
  }

  function addExtra(name: string, category: Category): ExtraItem {
    const res = db.prepare('INSERT INTO extra_items (name, category) VALUES (?, ?)').run(name, category);
    return { id: Number(res.lastInsertRowid), name, category, done: false };
  }

  function updateExtra(id: number, patch: { done?: boolean; name?: string; category?: Category }) {
    const cur = db.prepare('SELECT * FROM extra_items WHERE id = ?').get(id) as Row | undefined;
    if (!cur) return false;
    db.prepare('UPDATE extra_items SET name = ?, category = ?, done = ? WHERE id = ?').run(
      patch.name ?? cur.name,
      patch.category ?? cur.category,
      patch.done === undefined ? cur.done : patch.done ? 1 : 0,
      id,
    );
    return true;
  }

  function deleteExtra(id: number) {
    return db.prepare('DELETE FROM extra_items WHERE id = ?').run(id).changes > 0;
  }

  function clearDoneExtras() {
    db.prepare('DELETE FROM extra_items WHERE done = 1').run();
  }

  // ---------- settings ----------

  function getSettings(): Settings {
    const s: Settings = { ...DEFAULT_SETTINGS };
    for (const r of db.prepare('SELECT key, value FROM settings').all() as Row[]) {
      (s as any)[r.key] = JSON.parse(r.value);
    }
    return s;
  }

  function updateSettings(patch: Partial<Settings>): Settings {
    const stmt = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_SETTINGS) stmt.run(k, JSON.stringify(v));
    return getSettings();
  }

  function recipeCount(): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM recipes').get() as Row).n;
  }

  return {
    getRecipe,
    listRecipes,
    createRecipe,
    updateRecipe,
    setRecipePhoto,
    deleteRecipe,
    nearbyPlans,
    listEntries,
    getEntry,
    getEntryDetail,
    createEntry,
    updateEntry,
    deleteEntry,
    setCheck,
    setChecks,
    shoppingList,
    listExtras,
    addExtra,
    updateExtra,
    deleteExtra,
    clearDoneExtras,
    getSettings,
    updateSettings,
    recipeCount,
  };
}

export type Repo = ReturnType<typeof createRepo>;
