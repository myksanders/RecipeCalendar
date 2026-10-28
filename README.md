# Meal Plan — family recipe calendar

A self-hosted meal planner for the household: a week/month calendar where each
event is a recipe, a recipe book you drag meals from, a per-meal ingredient
checklist ("we already have this"), and a shopping list of everything *not*
ticked, grouped by Albert Heijn-style category so it's quick to enter in the AH app.

## What it does

- **Calendar** — week view (Mon–Sun) and month view. Several meals per day
  (breakfast / lunch / dinner / other), each optionally "for" someone (e.g. Kid).
- **Special days** — ♻️ leftovers (linked to the meal they came from), 🍷 dinner
  out, 🥡 fend for yourselves, 📝 notes.
- **Recipe book** — drag a recipe onto a day (desktop/iPad), or tap it then tap a
  day (phone). Create recipes on their own page with a photo, ingredients and steps.
- **Import from a link** — paste a recipe URL (Allerhande, food blogs using WP Recipe
  Maker / Tasty Recipes / Mediavine, most big recipe sites) and the form is filled in,
  including the photo, notes and ingredient groups. Pages without a recipe card still
  give you the title and photo; paste the ingredients yourself.
- **Ingredient checklist** — always visible next to the steps in a meal. Ticked =
  in the fridge/pantry; unticked goes on the shopping list. Servings scale amounts.
- **Shopping list** — for any date range; merges duplicates (500 g + 1 kg gehakt =
  1.5 kg), groups by Meat & Fish, Vegetables & Fruit, Dairy & Eggs, Bakery,
  Pantry, Frozen, Drinks, Household. Add extras (toilet paper…). Copy, Share, or
  **Send to Notes** via an iOS Shortcut into your shared Apple Note.
- **Variety nudges** — the book shows when you last had each recipe and sorts by
  "longest since we had it"; planning a repeat within N weeks (default 3) warns you.
- **Apple Calendar feed** — subscribe to `http://<computer>:3000/calendar.ics` (Calendar → File → New Calendar Subscription).
- Works on iPhone as a home-screen app (PWA), iPad, and desktop; light and dark mode.
- Two phones planning at once stay in sync (refreshes on focus and every 30 s).

## Run it

Needs **Node.js 22.13+** (Node 24 LTS recommended). No database server or native
modules — it uses Node's built-in SQLite.

```bash
git clone https://github.com/myksanders/RecipeCalendar.git
cd RecipeCalendar
npm install
npm run build
npm start          # http://localhost:3000, and on your Wi-Fi at http://<pc-ip>:3000
```

It runs on macOS, Windows and Linux. To host it on a home computer:

- **Mac** (an idle MacBook is ideal): double-click `start-meal-planner.command`,
  or run `scripts/macos/install-launchd.sh` to keep it running in the background.
  Phones reach it at `http://<mac-name>.local:3000`. Lid-closed setup, auto-start
  and backups: [docs/MAC_SETUP.md](docs/MAC_SETUP.md).
- **Windows**: double-click `start-meal-planner.cmd`. Background running, firewall
  and backups: [docs/WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md).

Settings via environment variables: `PORT` (3000), `HOST` (0.0.0.0), `DATA_DIR`
(`./data`), `SEED=0` to skip the five sample recipes on first run.

### Development

```bash
npm run dev        # API on :3000 with reload + Vite on :5173
npm test           # unit + API tests (vitest)
npm run typecheck
```

## How it's built

| Part | Where |
|---|---|
| REST API (Fastify) | `server/app.ts` — documented in [docs/API.md](docs/API.md) |
| Database (SQLite, all SQL) | `server/db.ts`, `server/repo.ts` |
| Recipe import (schema.org JSON-LD) | `server/services/importer.ts` |
| iCal feed | `server/services/ical.ts` |
| Shared logic: categories, ingredient parsing, shopping list | `shared/` |
| Web app (React + Vite, dnd-kit) | `web/src/` |

Data lives in `data/meal-planner.sqlite` plus `data/photos/`. Back up that folder.

## Roadmap

- Household passcode, then move to a free-tier host for access outside the home
  (the SQL is isolated in `server/db.ts` + `server/repo.ts` for a Postgres switch).
- Native SwiftUI iPhone app against the same API (`docs/API.md`).
- Per-person dietary tags and warnings; two-way calendar sync.
