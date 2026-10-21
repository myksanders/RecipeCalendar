import { guessCategoryWithDutch } from '../../shared/dutch';
import { parseIngredientLine } from '../../shared/ingredients';
import type { RecipeInput } from '../../shared/types';

// Most recipe sites (Allerhande, BBC Good Food, NYT, blogs using Yoast/WPRM)
// embed a schema.org "Recipe" object as JSON-LD for Google. We read that.

export interface ImportedRecipe extends RecipeInput {
  imageUrl: string | null;
}

export class ImportError extends Error {}

export async function importRecipeFromUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<ImportedRecipe> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ImportError('That does not look like a valid link.');
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new ImportError('Only http(s) links can be imported.');
  const res = await fetchImpl(parsed.href, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new ImportError(`The site answered with HTTP ${res.status}.`);
  const html = await res.text();
  const recipe = extractRecipeFromHtml(html, parsed.href);
  if (!recipe) throw new ImportError('No recipe data found on that page. You can still add it by hand.');
  return recipe;
}

export function extractRecipeFromHtml(html: string, pageUrl: string): ImportedRecipe | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const node = findRecipeNode(data);
    if (node) return mapRecipe(node, pageUrl);
  }
  return null;
}

function isRecipeType(t: unknown): boolean {
  if (typeof t === 'string') return t === 'Recipe' || t.endsWith('/Recipe');
  if (Array.isArray(t)) return t.some(isRecipeType);
  return false;
}

function findRecipeNode(data: any, depth = 0): any | null {
  if (!data || typeof data !== 'object' || depth > 6) return null;
  if (Array.isArray(data)) {
    for (const d of data) {
      const r = findRecipeNode(d, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (isRecipeType(data['@type'])) return data;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    if (data[key]) {
      const r = findRecipeNode(data[key], depth + 1);
      if (r) return r;
    }
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', euml: 'ë',
  iuml: 'ï', ouml: 'ö', uuml: 'ü', auml: 'ä', ccedil: 'ç', frac12: '½', frac14: '¼', frac34: '¾', deg: '°',
};

export function cleanText(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** ISO-8601 duration ("PT1H30M") to minutes. */
export function durationToMinutes(d: unknown): number | null {
  if (typeof d !== 'string') return null;
  const m = d.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const mins = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return mins || null;
}

function parseYield(y: unknown): number {
  const v = Array.isArray(y) ? y[0] : y;
  if (typeof v === 'number') return v;
  const m = typeof v === 'string' ? v.match(/\d+/) : null;
  return m ? Number(m[0]) : 4;
}

function pickImage(img: any, base: string): string | null {
  let url: unknown = img;
  if (Array.isArray(img)) url = img[img.length - 1] ?? null; // usually the largest
  if (url && typeof url === 'object') url = (url as any).url ?? (url as any).contentUrl ?? null;
  if (typeof url !== 'string' || !url) return null;
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

function flattenInstructions(ins: any): string[] {
  if (!ins) return [];
  if (typeof ins === 'string') {
    return cleanText(ins)
      .split(/\n+|(?<=\.)\s+(?=\d+[.)]\s)/)
      .map((s) => s.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean);
  }
  if (Array.isArray(ins)) return ins.flatMap(flattenInstructions);
  if (typeof ins === 'object') {
    if (ins.itemListElement) return flattenInstructions(ins.itemListElement);
    const text = cleanText(ins.text ?? ins.name);
    return text ? [text] : [];
  }
  return [];
}

function toTags(...vals: unknown[]): string[] {
  const tags = new Set<string>();
  for (const v of vals) {
    const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
    for (const t of arr) {
      const s = cleanText(t).toLowerCase();
      if (s && s.length < 30) tags.add(s);
    }
  }
  return [...tags].slice(0, 8);
}

function mapRecipe(node: any, pageUrl: string): ImportedRecipe {
  const ingredientLines: string[] = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : [])
    .map(cleanText)
    .filter(Boolean);
  return {
    title: cleanText(node.name) || 'Imported recipe',
    description: cleanText(node.description),
    servings: parseYield(node.recipeYield),
    prepMinutes: durationToMinutes(node.prepTime),
    cookMinutes: durationToMinutes(node.cookTime) ?? (node.prepTime ? null : durationToMinutes(node.totalTime)),
    sourceUrl: pageUrl,
    tags: toTags(node.recipeCategory, node.recipeCuisine),
    notes: '',
    ingredients: ingredientLines.map(parseIngredientLine).map((i) => ({ ...i, category: guessCategoryWithDutch(i.name) })),
    steps: flattenInstructions(node.recipeInstructions),
    imageUrl: pickImage(node.image, pageUrl),
  };
}
