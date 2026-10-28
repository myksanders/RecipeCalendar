import { parse, type HTMLElement } from 'node-html-parser';
import { guessCategoryWithDutch } from '../../shared/dutch';
import { parseIngredientLine } from '../../shared/ingredients';
import type { Ingredient, RecipeInput } from '../../shared/types';

// Recipe pages describe their recipe in one of a few ways, tried in order:
//  1. schema.org "Recipe" JSON-LD (Allerhande, BBC Good Food, most WordPress food
//     blogs through WP Recipe Maker / Tasty Recipes / Yoast),
//  2. schema.org microdata (itemprop="recipeIngredient" …),
//  3. the recipe-card plugin's own HTML (WP Recipe Maker, Tasty Recipes, Mediavine Create),
//  4. otherwise just the page title and photo, so the user can paste the rest.

export type ImportSource = 'structured' | 'recipe-card' | 'title-only';

export interface ImportedRecipe extends RecipeInput {
  imageUrl: string | null;
  source: ImportSource;
  /** Ingredient lines that couldn't be split cleanly into amount, unit and name. */
  unclear: string[];
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
  if (!recipe) throw new ImportError('No recipe found on that page. You can still add it by hand.');
  return recipe;
}

export function extractRecipeFromHtml(html: string, pageUrl: string): ImportedRecipe | null {
  const root = parse(html, { blockTextElements: { script: true, style: false, pre: true } });
  const card = readRecipeCard(root, pageUrl);

  const node = findJsonLdRecipe(root);
  if (node) {
    const fromJson = fromStructured(node, pageUrl);
    // The card often carries what JSON-LD leaves out: ingredient groups and notes.
    // Only take its lines when they add group headings to the same ingredients.
    if (card) {
      const cardItems = card.ingredientLines.filter((l) => !isHeading(l));
      if (cardItems.length < card.ingredientLines.length && cardItems.length === fromJson.ingredientLines.length) {
        fromJson.ingredientLines = card.ingredientLines;
      }
      if (card.notes) fromJson.notes = card.notes;
    }
    return build(fromJson, pageUrl, 'structured');
  }
  const micro = readMicrodata(root, pageUrl);
  if (micro) return build(micro, pageUrl, 'structured');
  if (card) return build(card, pageUrl, 'recipe-card');

  const title = meta(root, 'og:title') || cleanText(root.querySelector('title')?.text);
  if (!title) return null;
  return build(
    {
      title,
      description: meta(root, 'og:description'),
      image: absolute(meta(root, 'og:image'), pageUrl),
      ingredientLines: [],
      steps: [],
    },
    pageUrl,
    'title-only',
  );
}

// ---------- the shape every source is turned into ----------

interface Draft {
  title: string;
  description?: string;
  servings?: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  tags?: string[];
  /** Ingredient lines; a heading line ends with ":" (e.g. "For the sauce:"). */
  ingredientLines: string[];
  steps: string[];
  notes?: string;
  image: string | null;
}

function isHeading(line: string): boolean {
  return /:\s*$/.test(line) && !/\d/.test(line) && line.length < 60;
}

function build(d: Draft, pageUrl: string, source: ImportSource): ImportedRecipe {
  const ingredients: Ingredient[] = [];
  const unclear: string[] = [];
  let group = '';
  for (const line of d.ingredientLines) {
    if (isHeading(line)) {
      // "For the sauce:" → "for the sauce", added to the note of the lines below it.
      group = line.replace(/:\s*$/, '').trim().toLowerCase();
      continue;
    }
    const ing = parseIngredientLine(line);
    if (looksUnclear(line, ing)) unclear.push(line);
    const note = [ing.note, group].filter(Boolean).join(', ');
    ingredients.push({ ...ing, category: guessCategoryWithDutch(ing.name), ...(note ? { note } : {}) });
  }
  return {
    title: d.title || 'Imported recipe',
    description: d.description ?? '',
    servings: d.servings ?? 4,
    prepMinutes: d.prepMinutes ?? null,
    cookMinutes: d.cookMinutes ?? null,
    sourceUrl: pageUrl,
    tags: d.tags ?? [],
    notes: d.notes ?? '',
    ingredients,
    steps: d.steps,
    imageUrl: d.image,
    source,
    unclear,
  };
}

/** A line has a number we couldn't place as the amount, or nothing usable as a name. */
function looksUnclear(line: string, ing: Ingredient): boolean {
  if (!ing.name || ing.name.length > 60) return true;
  if (/\d/.test(ing.name)) return true;
  return ing.quantity === null && /^\s*\d/.test(line);
}

// ---------- 1. JSON-LD ----------

function findJsonLdRecipe(root: HTMLElement): any | null {
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(s.rawText.trim());
    } catch {
      continue;
    }
    const node = findRecipeNode(data);
    if (node) return node;
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

function fromStructured(node: any, pageUrl: string): Draft {
  return {
    title: cleanText(node.name),
    description: cleanText(node.description),
    servings: parseYield(node.recipeYield),
    prepMinutes: durationToMinutes(node.prepTime),
    cookMinutes: durationToMinutes(node.cookTime) ?? (node.prepTime ? null : durationToMinutes(node.totalTime)),
    tags: toTags(node.recipeCategory, node.recipeCuisine),
    ingredientLines: (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : []).map(cleanText).filter(Boolean),
    steps: flattenInstructions(node.recipeInstructions),
    image: pickImage(node.image, pageUrl),
  };
}

// ---------- 2. microdata ----------

function readMicrodata(root: HTMLElement, pageUrl: string): Draft | null {
  const scope = root.querySelector('[itemtype*="schema.org/Recipe"]');
  if (!scope) return null;
  const prop = (name: string) => scope.querySelectorAll(`[itemprop="${name}"]`);
  const ingredientLines = [...prop('recipeIngredient'), ...prop('ingredients')].map(textOf).filter(Boolean);
  if (!ingredientLines.length) return null;
  const stepEls = prop('recipeInstructions');
  const steps = stepEls.flatMap((el) => {
    const items = el.querySelectorAll('li, p');
    return (items.length ? items : [el]).map(textOf).filter(Boolean);
  });
  const img = prop('image')[0];
  return {
    title: textOf(prop('name')[0]) || meta(root, 'og:title'),
    description: textOf(prop('description')[0]),
    servings: parseYield(prop('recipeYield')[0]?.getAttribute('content') ?? textOf(prop('recipeYield')[0])),
    prepMinutes: durationToMinutes(prop('prepTime')[0]?.getAttribute('content') ?? prop('prepTime')[0]?.getAttribute('datetime')),
    cookMinutes: durationToMinutes(prop('cookTime')[0]?.getAttribute('content') ?? prop('cookTime')[0]?.getAttribute('datetime')),
    ingredientLines,
    steps,
    image: absolute(img?.getAttribute('src') ?? img?.getAttribute('content') ?? img?.getAttribute('href') ?? meta(root, 'og:image'), pageUrl),
  };
}

// ---------- 3. recipe-card plugin HTML ----------

interface CardFormat {
  card: string;
  title: string;
  /** Ingredient items and group headings, in page order. */
  ingredients: string;
  heading: string;
  steps: string;
  servings: string;
  notes: string;
  image: string;
}

const CARD_FORMATS: CardFormat[] = [
  {
    // WP Recipe Maker
    card: '.wprm-recipe',
    title: '.wprm-recipe-name',
    ingredients: '.wprm-recipe-group-name, .wprm-recipe-ingredient',
    heading: 'wprm-recipe-group-name',
    steps: '.wprm-recipe-instruction-text',
    servings: '.wprm-recipe-servings',
    notes: '.wprm-recipe-notes',
    image: '.wprm-recipe-image img',
  },
  {
    // Tasty Recipes
    card: '.tasty-recipes',
    title: '.tasty-recipes-title',
    ingredients: '.tasty-recipes-ingredients h4, .tasty-recipes-ingredients li',
    heading: 'H4',
    steps: '.tasty-recipes-instructions li',
    servings: '.tasty-recipes-yield',
    notes: '.tasty-recipes-notes',
    image: '.tasty-recipes-image img',
  },
  {
    // Mediavine Create
    card: '.mv-create-card',
    title: '.mv-create-title',
    ingredients: '.mv-create-ingredients h4, .mv-create-ingredients li',
    heading: 'H4',
    steps: '.mv-create-instructions li',
    servings: '.mv-create-yield',
    notes: '.mv-create-notes',
    image: '.mv-create-image img',
  },
];

function readRecipeCard(root: HTMLElement, pageUrl: string): Draft | null {
  for (const f of CARD_FORMATS) {
    const card = root.querySelector(f.card);
    if (!card) continue;
    const ingredientLines = card.querySelectorAll(f.ingredients).map((el) => {
      const isGroup = el.classList.contains(f.heading) || el.tagName === f.heading;
      if (isGroup) return textOf(el).replace(/:?$/, ':');
      return wprmLine(el) ?? textOf(el);
    });
    const lines = ingredientLines.filter((l) => l && l !== ':');
    if (!lines.length) continue;
    const img = card.querySelector(f.image);
    return {
      title: textOf(card.querySelector(f.title)) || meta(root, 'og:title'),
      servings: parseYield(textOf(card.querySelector(f.servings))),
      ingredientLines: lines,
      steps: card.querySelectorAll(f.steps).map(textOf).filter(Boolean),
      notes: textOf(card.querySelector(f.notes)),
      image: absolute(
        img?.getAttribute('data-lazy-src') ?? img?.getAttribute('data-src') ?? img?.getAttribute('src') ?? meta(root, 'og:image'),
        pageUrl,
      ),
    };
  }
  return null;
}

/** WP Recipe Maker splits a line into spans; join them as "1 lb chicken, diced". */
function wprmLine(el: HTMLElement): string | null {
  const part = (c: string) => textOf(el.querySelector(`.wprm-recipe-ingredient-${c}`));
  const name = part('name');
  if (!name) return null;
  const notes = part('notes').replace(/^\((.*)\)$/, '$1');
  return [part('amount'), part('unit'), name].filter(Boolean).join(' ') + (notes ? `, ${notes}` : '');
}

// ---------- helpers ----------

function textOf(el: HTMLElement | null | undefined): string {
  if (!el) return '';
  // Put spaces where tags were so "<span>1</span><span>lb</span>" doesn't become "1lb".
  return cleanText(el.innerHTML.replace(/<(br|\/p|\/li|\/div)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/ *\n */g, '\n')
    .replace(/ {2,}/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}

function meta(root: HTMLElement, property: string): string {
  const el = root.querySelector(`meta[property="${property}"]`) ?? root.querySelector(`meta[name="${property}"]`);
  return cleanText(el?.getAttribute('content'));
}

function absolute(url: string | null | undefined, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', euml: 'ë',
  iuml: 'ï', ouml: 'ö', uuml: 'ü', auml: 'ä', ccedil: 'ç', frac12: '½', frac14: '¼', frac34: '¾', deg: '°',
  frac13: '⅓', frac23: '⅔', frac18: '⅛', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
};

export function cleanText(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
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
  return typeof url === 'string' ? absolute(url, base) : null;
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
