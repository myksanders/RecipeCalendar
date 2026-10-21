import { DatabaseSync } from 'node:sqlite';

// Node's built-in SQLite: no native modules to compile on Windows.
// All SQL lives in this file and repo.ts so a later move to a hosted
// Postgres only touches these two files.

const MIGRATIONS: string[] = [
  `
  CREATE TABLE recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    photo TEXT,
    servings INTEGER NOT NULL DEFAULT 4,
    prep_minutes INTEGER,
    cook_minutes INTEGER,
    source_url TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity REAL,
    unit TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Other',
    note TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX ingredients_recipe ON ingredients(recipe_id);
  CREATE TABLE steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    text TEXT NOT NULL
  );
  CREATE INDEX steps_recipe ON steps(recipe_id);
  CREATE TABLE meal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    slot TEXT NOT NULL DEFAULT 'dinner',
    kind TEXT NOT NULL,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
    leftover_of_entry_id INTEGER REFERENCES meal_entries(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    who TEXT NOT NULL DEFAULT '',
    servings INTEGER,
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX meal_entries_date ON meal_entries(date);
  CREATE INDEX meal_entries_recipe ON meal_entries(recipe_id);
  CREATE TABLE entry_checks (
    entry_id INTEGER NOT NULL REFERENCES meal_entries(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, ingredient_id)
  );
  CREATE TABLE extra_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // 2: Dutch names the household taught (English ingredient key -> AH name).
  `
  CREATE TABLE dutch_names (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nl TEXT NOT NULL
  );
  `,
];

export type DB = DatabaseSync;

export function openDb(file: string): DB {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export function transaction<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
