import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { addDays, isValidISODate, today } from '../shared/dates';
import { guessCategoryWithDutch } from '../shared/dutch';
import { formatIngredient } from '../shared/ingredients';
import { shoppingListToText } from '../shared/shopping';
import { CATEGORIES, ENTRY_KINDS, SLOTS, visibleSlots } from '../shared/types';
import type { Repo } from './repo';
import { buildIcs } from './services/ical';
import { ImportError, importRecipeFromUrl } from './services/importer';
import { MAX_PHOTO_BYTES, type PhotoStore } from './services/photos';

export interface AppOptions {
  repo: Repo;
  photos: PhotoStore;
  webDist?: string;
  logger?: boolean;
  fetchImpl?: typeof fetch;
}

const isoDate = z.string().refine(isValidISODate, 'Expected YYYY-MM-DD');
const category = z.enum(CATEGORIES);

const ingredientSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1),
  quantity: z.number().nonnegative().nullable(),
  unit: z.string().default(''),
  category: category.optional(),
  note: z.string().optional(),
});

const recipeSchema = z.object({
  title: z.string().trim().min(1, 'A recipe needs a name'),
  description: z.string().default(''),
  photo: z.string().nullable().optional(),
  servings: z.number().int().min(1).max(50).default(4),
  prepMinutes: z.number().int().nonnegative().nullable().default(null),
  cookMinutes: z.number().int().nonnegative().nullable().default(null),
  sourceUrl: z.string().nullable().default(null),
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().default(''),
  ingredients: z.array(ingredientSchema).default([]),
  steps: z.array(z.string().trim().min(1)).default([]),
});

const entrySchema = z.object({
  date: isoDate,
  slot: z.enum(SLOTS).optional(),
  kind: z.enum(ENTRY_KINDS),
  recipeId: z.number().int().nullable().optional(),
  leftoverOfEntryId: z.number().int().nullable().optional(),
  title: z.string().optional(),
  who: z.string().optional(),
  servings: z.number().int().min(1).max(50).nullable().optional(),
  notes: z.string().optional(),
});

const entryPatchSchema = entrySchema.omit({ kind: true, recipeId: true }).partial().extend({
  sortOrder: z.number().int().optional(),
});

const rangeSchema = z.object({ from: isoDate.optional(), to: isoDate.optional() });

class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, `${first.path.join('.') || 'input'}: ${first.message}`);
  }
  return r.data;
}

function idParam(req: FastifyRequest): number {
  const id = Number((req.params as any).id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Bad id');
  return id;
}

function range(req: FastifyRequest, defaultDays = 7) {
  const q = parse(rangeSchema, req.query);
  const from = q.from ?? today();
  const to = q.to ?? addDays(from, defaultDays - 1);
  if (to < from) throw new HttpError(400, '"to" is before "from"');
  return { from, to };
}

function baseUrl(req: FastifyRequest) {
  return `${req.protocol}://${req.headers.host ?? 'localhost'}`;
}

export function buildApp(opts: AppOptions): FastifyInstance {
  const { repo, photos } = opts;
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: MAX_PHOTO_BYTES });

  app.addContentTypeParser(/^image\//, { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  app.setErrorHandler((err: any, _req, reply) => {
    const status = err instanceof HttpError ? err.statusCode : err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (status >= 500) app.log.error(err);
    const expose = err instanceof HttpError || status < 500;
    reply.status(status).send({ error: expose ? err.message : 'Something went wrong on the server.' });
  });

  // ---------- recipes ----------

  app.get('/api/recipes', async () => repo.listRecipes());

  app.get('/api/recipes/:id', async (req) => {
    const r = repo.getRecipe(idParam(req));
    if (!r) throw new HttpError(404, 'Recipe not found');
    return r;
  });

  function normalizeRecipe(input: z.infer<typeof recipeSchema>) {
    return {
      ...input,
      ingredients: input.ingredients.map((i) => ({ ...i, category: i.category ?? guessCategoryWithDutch(i.name) })),
    };
  }

  app.post('/api/recipes', async (req, reply) => {
    const input = normalizeRecipe(parse(recipeSchema, req.body));
    // Photos are only set via upload/import, never by arbitrary path.
    const created = repo.createRecipe({ ...input, photo: null });
    reply.status(201);
    return created;
  });

  app.put('/api/recipes/:id', async (req) => {
    const input = normalizeRecipe(parse(recipeSchema, req.body));
    const updated = repo.updateRecipe(idParam(req), { ...input, photo: undefined });
    if (!updated) throw new HttpError(404, 'Recipe not found');
    return updated;
  });

  app.delete('/api/recipes/:id', async (req, reply) => {
    const id = idParam(req);
    const r = repo.getRecipe(id);
    if (!r) throw new HttpError(404, 'Recipe not found');
    repo.deleteRecipe(id);
    photos.remove(r.photo);
    reply.status(204);
  });

  app.put('/api/recipes/:id/photo', async (req) => {
    const id = idParam(req);
    const r = repo.getRecipe(id);
    if (!r) throw new HttpError(404, 'Recipe not found');
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Send the image as the request body');
    let path: string;
    try {
      path = photos.save(id, req.body, req.headers['content-type'] ?? '');
    } catch (e: any) {
      throw new HttpError(415, e.message);
    }
    repo.setRecipePhoto(id, path);
    photos.remove(r.photo);
    return repo.getRecipe(id);
  });

  app.delete('/api/recipes/:id/photo', async (req) => {
    const id = idParam(req);
    const r = repo.getRecipe(id);
    if (!r) throw new HttpError(404, 'Recipe not found');
    repo.setRecipePhoto(id, null);
    photos.remove(r.photo);
    return repo.getRecipe(id);
  });

  /** Preview an import: returns a recipe draft, nothing is saved. */
  app.post('/api/recipes/import', async (req) => {
    const { url } = parse(z.object({ url: z.string().trim().min(1) }), req.body);
    try {
      return await importRecipeFromUrl(url, opts.fetchImpl);
    } catch (e: any) {
      if (e instanceof ImportError) throw new HttpError(422, e.message);
      throw new HttpError(502, `Could not load that page (${e?.message ?? 'network error'}).`);
    }
  });

  /** Download a remote image (from an import) as this recipe's photo. */
  app.post('/api/recipes/:id/photo-from-url', async (req) => {
    const id = idParam(req);
    const r = repo.getRecipe(id);
    if (!r) throw new HttpError(404, 'Recipe not found');
    const { url } = parse(z.object({ url: z.url() }), req.body);
    const path = await photos.download(id, url, opts.fetchImpl);
    if (!path) throw new HttpError(422, 'Could not download that image.');
    repo.setRecipePhoto(id, path);
    photos.remove(r.photo);
    return repo.getRecipe(id);
  });

  app.get('/api/recipes/:id/variety', async (req) => {
    const id = idParam(req);
    const q = parse(z.object({ date: isoDate, excludeEntryId: z.coerce.number().int().optional() }), req.query);
    const weeks = repo.getSettings().varietyWeeks;
    return { weeks, dates: repo.nearbyPlans(id, q.date, weeks, q.excludeEntryId) };
  });

  // ---------- calendar entries ----------

  app.get('/api/entries', async (req) => {
    const { from, to } = range(req, 7);
    return repo.listEntries(from, to);
  });

  app.get('/api/entries/:id', async (req) => {
    const e = repo.getEntryDetail(idParam(req));
    if (!e) throw new HttpError(404, 'Meal not found');
    return e;
  });

  app.post('/api/entries', async (req, reply) => {
    const input = parse(entrySchema, req.body);
    if (input.kind === 'recipe') {
      if (!input.recipeId || !repo.getRecipe(input.recipeId)) throw new HttpError(400, 'Pick a recipe');
    }
    if (input.kind === 'leftovers' && input.leftoverOfEntryId && !repo.getEntry(input.leftoverOfEntryId)) {
      throw new HttpError(400, 'The meal these leftovers come from no longer exists');
    }
    reply.status(201);
    return repo.createEntry(input);
  });

  app.patch('/api/entries/:id', async (req) => {
    const patch = parse(entryPatchSchema, req.body);
    const e = repo.updateEntry(idParam(req), patch);
    if (!e) throw new HttpError(404, 'Meal not found');
    return e;
  });

  app.delete('/api/entries/:id', async (req, reply) => {
    if (!repo.deleteEntry(idParam(req))) throw new HttpError(404, 'Meal not found');
    reply.status(204);
  });

  app.put('/api/entries/:id/checks/:ingredientId', async (req) => {
    const id = idParam(req);
    const ingredientId = Number((req.params as any).ingredientId);
    const { have } = parse(z.object({ have: z.boolean() }), req.body);
    const detail = repo.getEntryDetail(id);
    if (!detail || !detail.recipe) throw new HttpError(404, 'Meal not found');
    if (!detail.recipe.ingredients.some((i) => i.id === ingredientId)) throw new HttpError(404, 'Ingredient not found');
    // Leftovers share the checklist of the meal they came from.
    const target = detail.kind === 'leftovers' && detail.sourceEntry ? detail.sourceEntry.id : id;
    repo.setCheck(target, ingredientId, have);
    return { ok: true };
  });

  // ---------- shopping ----------

  app.get('/api/shopping-list', async (req) => {
    const { from, to } = range(req, 7);
    return repo.shoppingList(from, to);
  });

  app.get('/api/shopping-list.txt', async (req, reply) => {
    const { from, to } = range(req, 7);
    const sources = (req.query as any).sources === '1';
    reply.type('text/plain; charset=utf-8');
    return shoppingListToText(repo.shoppingList(from, to), { withSources: sources });
  });

  /** Mark shopping-list items as "have it" (or back). */
  app.post('/api/shopping-list/have', async (req) => {
    const body = parse(
      z.object({
        refs: z.array(z.object({ entryId: z.number().int(), ingredientId: z.number().int() })),
        have: z.boolean().default(true),
      }),
      req.body,
    );
    repo.setChecks(body.refs, body.have);
    return { ok: true };
  });

  app.get('/api/extras', async () => repo.listExtras());

  app.post('/api/extras', async (req, reply) => {
    const b = parse(z.object({ name: z.string().trim().min(1), category: category.optional() }), req.body);
    reply.status(201);
    return repo.addExtra(b.name, b.category ?? guessCategoryWithDutch(b.name));
  });

  app.patch('/api/extras/:id', async (req) => {
    const b = parse(
      z.object({ name: z.string().trim().min(1).optional(), category: category.optional(), done: z.boolean().optional() }),
      req.body,
    );
    if (!repo.updateExtra(idParam(req), b)) throw new HttpError(404, 'Item not found');
    return { ok: true };
  });

  app.delete('/api/extras/:id', async (req, reply) => {
    if (!repo.deleteExtra(idParam(req))) throw new HttpError(404, 'Item not found');
    reply.status(204);
  });

  app.post('/api/extras/clear-done', async () => {
    repo.clearDoneExtras();
    return { ok: true };
  });

  app.get('/api/categorize', async (req) => {
    const { name } = parse(z.object({ name: z.string() }), req.query);
    return { category: guessCategoryWithDutch(name) };
  });

  // ---------- Dutch names ----------

  app.get('/api/dutch-names', async () => repo.listDutchNames());

  /** Teach the Dutch (AH) name for an ingredient; an empty nl forgets it. */
  app.put('/api/dutch-names', async (req) => {
    const b = parse(z.object({ name: z.string().trim().min(1), nl: z.string().max(80) }), req.body);
    return repo.setDutchName(b.name, b.nl);
  });

  // ---------- settings ----------

  app.get('/api/settings', async () => repo.getSettings());

  app.put('/api/settings', async (req) => {
    const patch = parse(
      z.object({
        varietyWeeks: z.number().int().min(0).max(26).optional(),
        weekStart: z.union([z.literal(0), z.literal(1)]).optional(),
        // Dinner is always planned; stored in day order.
        mealSlots: z
          .array(z.enum(['breakfast', 'lunch', 'dinner']))
          .max(3)
          .transform((s) => visibleSlots(s))
          .optional(),
        people: z.array(z.string().trim().min(1)).max(12).optional(),
      }),
      req.body,
    );
    return repo.updateSettings(patch);
  });

  // ---------- iCal feed ----------

  app.get('/calendar.ics', async (req, reply) => {
    const from = addDays(today(), -28);
    const to = addDays(today(), 120);
    const entries = repo.listEntries(from, to).map((e) => {
      if (e.kind !== 'recipe' || !e.recipeId) return e;
      const r = repo.getRecipe(e.recipeId);
      const scale = r && e.servings ? e.servings / r.servings : 1;
      return { ...e, ingredientsText: r?.ingredients.map((i) => `• ${formatIngredient(i, scale)}`).join('\n') };
    });
    reply.type('text/calendar; charset=utf-8').header('Content-Disposition', 'inline; filename="meal-plan.ics"');
    return buildIcs(entries, { baseUrl: baseUrl(req), calName: 'Meal plan' });
  });

  app.get('/api/health', async () => ({ ok: true }));

  // ---------- static files ----------

  app.register(fastifyStatic, { root: photos.dir, prefix: '/photos/', decorateReply: false, maxAge: '30d', immutable: true });

  if (opts.webDist && existsSync(opts.webDist)) {
    app.register(fastifyStatic, { root: opts.webDist, prefix: '/', wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/') && !req.url.startsWith('/photos/')) {
        return reply.sendFile('index.html');
      }
      reply.status(404).send({ error: 'Not found' });
    });
  }

  return app;
}
