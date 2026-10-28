import type {
  EntryDetail,
  EntryInput,
  ExtraItem,
  MealEntry,
  Recipe,
  RecipeInput,
  RecipeSummary,
  Settings,
  ShoppingList,
  Category,
} from '../../shared/types';

export class ApiError extends Error {}

async function req<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const isBlob = body instanceof Blob;
  const res = await fetch(url, {
    method,
    headers: body === undefined ? headers : { 'Content-Type': isBlob ? (body as Blob).type : 'application/json', ...headers },
    body: body === undefined ? undefined : isBlob ? (body as Blob) : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      // not JSON
    }
    throw new ApiError(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type ImportedRecipe = RecipeInput & {
  imageUrl: string | null;
  source: 'structured' | 'recipe-card' | 'title-only';
  unclear: string[];
};

export const api = {
  recipes: () => req<RecipeSummary[]>('GET', '/api/recipes'),
  recipe: (id: number) => req<Recipe>('GET', `/api/recipes/${id}`),
  createRecipe: (r: RecipeInput) => req<Recipe>('POST', '/api/recipes', r),
  updateRecipe: (id: number, r: RecipeInput) => req<Recipe>('PUT', `/api/recipes/${id}`, r),
  deleteRecipe: (id: number) => req<void>('DELETE', `/api/recipes/${id}`),
  uploadPhoto: (id: number, blob: Blob) => req<Recipe>('PUT', `/api/recipes/${id}/photo`, blob),
  removePhoto: (id: number) => req<Recipe>('DELETE', `/api/recipes/${id}/photo`),
  photoFromUrl: (id: number, url: string) => req<Recipe>('POST', `/api/recipes/${id}/photo-from-url`, { url }),
  importRecipe: (url: string) => req<ImportedRecipe>('POST', '/api/recipes/import', { url }),
  variety: (id: number, date: string, excludeEntryId?: number) =>
    req<{ weeks: number; dates: string[] }>(
      'GET',
      `/api/recipes/${id}/variety?date=${date}${excludeEntryId ? `&excludeEntryId=${excludeEntryId}` : ''}`,
    ),

  entries: (from: string, to: string) => req<MealEntry[]>('GET', `/api/entries?from=${from}&to=${to}`),
  entry: (id: number) => req<EntryDetail>('GET', `/api/entries/${id}`),
  createEntry: (e: EntryInput) => req<MealEntry>('POST', '/api/entries', e),
  updateEntry: (id: number, patch: Partial<EntryInput> & { sortOrder?: number }) =>
    req<MealEntry>('PATCH', `/api/entries/${id}`, patch),
  deleteEntry: (id: number) => req<void>('DELETE', `/api/entries/${id}`),
  setCheck: (entryId: number, ingredientId: number, have: boolean) =>
    req<void>('PUT', `/api/entries/${entryId}/checks/${ingredientId}`, { have }),

  shoppingList: (from: string, to: string) => req<ShoppingList>('GET', `/api/shopping-list?from=${from}&to=${to}`),
  markHave: (refs: { entryId: number; ingredientId: number }[], have: boolean) =>
    req<void>('POST', '/api/shopping-list/have', { refs, have }),
  extras: () => req<ExtraItem[]>('GET', '/api/extras'),
  addExtra: (name: string, category?: Category) => req<ExtraItem>('POST', '/api/extras', { name, category }),
  updateExtra: (id: number, patch: Partial<Pick<ExtraItem, 'name' | 'category' | 'done'>>) =>
    req<void>('PATCH', `/api/extras/${id}`, patch),
  deleteExtra: (id: number) => req<void>('DELETE', `/api/extras/${id}`),

  dutchNames: () => req<{ key: string; name: string; nl: string }[]>('GET', '/api/dutch-names'),
  setDutchName: (name: string, nl: string) =>
    req<{ key: string; name: string; nl: string }>('PUT', '/api/dutch-names', { name, nl }),

  settings: () => req<Settings>('GET', '/api/settings').then(cacheSettings),
  updateSettings: (s: Partial<Settings>) => req<Settings>('PUT', '/api/settings', s).then(cacheSettings),
};

const SETTINGS_KEY = 'settings.cache';
const DEFAULT_SETTINGS: Settings = { varietyWeeks: 3, weekStart: 1, mealSlots: ['dinner'], people: ['Everyone', 'Kid'] };

function cacheSettings(s: Settings): Settings {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // private mode
  }
  return s;
}

/** Last known settings, so the first render already uses the household's week start. */
export function cachedSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Shrink phone photos (often 4–8 MB) to a sensible JPEG before upload. */
export async function resizeImage(file: Blob, maxSide = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality),
    );
  } catch {
    return file; // e.g. HEIC the browser can't decode: send as-is
  }
}
