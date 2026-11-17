import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Ingredient, RecipeInput } from '../../shared/types';

// Translates a recipe's text (Dutch, usually from Allerhande) into English with
// Claude. Amounts, categories and ingredient order never change: only words do.

/** The text parts of a recipe that get translated, in a stable order. */
export interface RecipeText {
  title: string;
  description: string;
  notes: string;
  ingredients: { name: string; unit: string; note: string }[];
  steps: string[];
}

export type Translator = (text: RecipeText) => Promise<RecipeText>;

export class TranslateError extends Error {}

export function recipeText(r: Pick<RecipeInput, 'title' | 'description' | 'notes' | 'ingredients' | 'steps'>): RecipeText {
  return {
    title: r.title,
    description: r.description ?? '',
    notes: r.notes ?? '',
    ingredients: r.ingredients.map((i) => ({ name: i.name, unit: i.unit ?? '', note: i.note ?? '' })),
    steps: r.steps,
  };
}

/** Put translated text back onto the recipe, keeping ids, amounts and categories. */
export function applyTranslation<T extends Pick<RecipeInput, 'title' | 'description' | 'notes' | 'ingredients' | 'steps'>>(
  r: T,
  t: RecipeText,
): T {
  if (t.ingredients.length !== r.ingredients.length || t.steps.length !== r.steps.length) {
    throw new TranslateError('The translation came back incomplete. Please try again.');
  }
  return {
    ...r,
    title: t.title.trim() || r.title,
    description: t.description.trim(),
    notes: t.notes.trim(),
    ingredients: r.ingredients.map(
      (ing, idx): Ingredient => ({
        ...ing,
        name: t.ingredients[idx].name.trim() || ing.name,
        unit: t.ingredients[idx].unit.trim(),
        ...(t.ingredients[idx].note.trim() ? { note: t.ingredients[idx].note.trim() } : { note: undefined }),
      }),
    ),
    steps: r.steps.map((s, idx) => t.steps[idx].trim() || s),
  };
}

const TranslationSchema = z.object({
  title: z.string(),
  description: z.string(),
  notes: z.string(),
  ingredients: z.array(z.object({ name: z.string(), unit: z.string(), note: z.string() })),
  steps: z.array(z.string()),
});

const SYSTEM = `You translate recipes into natural English for a home cook. The recipe arrives as JSON; return the same JSON shape with every text field in English.

- Keep the same number of ingredients and steps, in the same order. Never merge, split, add or drop items.
- Ingredient "name": the everyday English grocery name (e.g. "rundergehakt" -> "ground beef", "bosui" -> "spring onions", "kruimige aardappelen" -> "floury potatoes"). Keep brand names and dish names that have no English equivalent (e.g. "nduja", "stamppot").
- Ingredient "unit": translate unit words only ("el" -> "tbsp", "tl" -> "tsp", "teentjes" -> "cloves", "blik" -> "can", "bosje" -> "bunch", "zakje" -> "bag"). Keep metric units (g, kg, ml, l) as they are. Leave an empty unit empty.
- Numbers, temperatures and times inside text stay exactly as written.
- Text that is already English stays unchanged. Empty strings stay empty.`;

/** Build a translator that uses Claude. Throws TranslateError for problems the user can fix. */
export function claudeTranslator(apiKey: string | undefined): Translator {
  return async (text) => {
    if (!apiKey) {
      throw new TranslateError('Add your Anthropic API key in Settings to translate recipes.');
    }
    const client = new Anthropic({ apiKey });
    let response;
    try {
      response = await client.beta.messages.parse({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(text) }],
        output_config: { effort: 'low', format: betaZodOutputFormat(TranslationSchema) },
      });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) {
        throw new TranslateError('The Anthropic API key was refused. Check it in Settings.');
      }
      if (e instanceof Anthropic.RateLimitError) {
        throw new TranslateError('Too many translations at once. Wait a minute and try again.');
      }
      if (e instanceof Anthropic.APIConnectionError) {
        throw new TranslateError('Could not reach the translation service. Is the Mac online?');
      }
      throw e;
    }
    if (response.stop_reason === 'refusal') throw new TranslateError('This recipe could not be translated.');
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new TranslateError('The translation came back incomplete. Please try again.');
    }
    return response.parsed_output;
  };
}
