# API

JSON over HTTP. Types are in [`shared/types.ts`](../shared/types.ts); a native
iOS app should mirror them. Errors return `{ "error": "message" }` with a 4xx/5xx status.
Dates are local `YYYY-MM-DD` strings.

## Recipes

| Method | Path | Notes |
|---|---|---|
| GET | `/api/recipes` | `RecipeSummary[]` with `lastPlanned`, `nextPlanned`, `timesPlanned` |
| GET | `/api/recipes/:id` | full `Recipe` |
| POST | `/api/recipes` | body `RecipeInput`; ingredient `category` is guessed when omitted |
| PUT | `/api/recipes/:id` | send ingredient `id`s back to keep "have it" ticks |
| DELETE | `/api/recipes/:id` | planned meals keep existing as "Deleted recipe" |
| PUT | `/api/recipes/:id/photo` | raw image body (`Content-Type: image/jpeg|png|webp|gif`, ≤15 MB) |
| DELETE | `/api/recipes/:id/photo` | |
| POST | `/api/recipes/:id/photo-from-url` | `{ url }` — server downloads the image |
| POST | `/api/recipes/import` | `{ url }` → recipe draft + `imageUrl` (nothing saved) |
| GET | `/api/recipes/:id/variety?date=&excludeEntryId=` | `{ weeks, dates[] }` planned nearby |

## Calendar entries

| Method | Path | Notes |
|---|---|---|
| GET | `/api/entries?from=&to=` | `MealEntry[]` (default: next 7 days) |
| GET | `/api/entries/:id` | `EntryDetail` with recipe, `checks` map and `scale` |
| POST | `/api/entries` | `EntryInput`; `kind` is `recipe` / `leftovers` / `dining_out` / `fend` / `note` |
| PATCH | `/api/entries/:id` | move (`date`, `slot`), `who`, `servings`, `title`, `notes` |
| DELETE | `/api/entries/:id` | |
| PUT | `/api/entries/:id/checks/:ingredientId` | `{ have: boolean }` — leftovers share their source meal's checks |

## Shopping

| Method | Path | Notes |
|---|---|---|
| GET | `/api/shopping-list?from=&to=` | `ShoppingList` grouped by category |
| GET | `/api/shopping-list.txt?from=&to=&sources=1` | plain text (for Shortcuts) |
| POST | `/api/shopping-list/have` | `{ refs: [{entryId, ingredientId}], have }` |
| GET/POST | `/api/extras` | extra items `{ name, category? }` |
| PATCH/DELETE | `/api/extras/:id` | `{ done?, name?, category? }` |
| POST | `/api/extras/clear-done` | |

## Other

| Method | Path | Notes |
|---|---|---|
| GET/PUT | `/api/settings` | `{ varietyWeeks, weekStart (0 = Sunday, 1 = Monday), mealSlots (dinner always included), people[] }` |
| GET | `/api/categorize?name=` | `{ category }` |
| GET | `/calendar.ics` | iCal feed, 4 weeks back to ~4 months ahead |
| GET | `/photos/:file` | recipe photos |
