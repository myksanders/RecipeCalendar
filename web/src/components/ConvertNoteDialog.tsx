import { useEffect, useMemo, useState } from 'react';
import { rankRecipesForText } from '../../../shared/match';
import type { RecipeSummary } from '../../../shared/types';
import { api } from '../api';
import { Modal, navigate, Photo } from '../ui';
import { RecipeMeta, sortRecipes } from './RecipeBook';

/**
 * Turn a calendar note ("Tacos") into a meal: pick a recipe from the book,
 * best matches for the note's text first, or create a new recipe named after it.
 */
export function ConvertNoteDialog({
  entryId,
  noteText,
  today,
  onClose,
  onConvert,
}: {
  entryId: number;
  noteText: string;
  today: string;
  onClose: () => void;
  onConvert: (recipe: RecipeSummary) => Promise<void>;
}) {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [query, setQuery] = useState(noteText);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.recipes().then(setRecipes).catch(() => setRecipes([]));
  }, []);

  const list = useMemo(() => {
    if (!recipes) return [];
    if (!query.trim()) return sortRecipes(recipes, 'az', '');
    // Word matches first ("Tacos" → "Chicken tacos"); otherwise a plain text/tag search.
    const ranked = rankRecipesForText(recipes, query);
    return ranked.length ? ranked : sortRecipes(recipes, 'az', query);
  }, [recipes, query]);

  const name = query.trim() || noteText.trim();

  async function pick(r: RecipeSummary) {
    setBusy(true);
    try {
      await onConvert(r);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} narrow label="Convert to meal">
      <div className="modal-head">
        <h2>Convert “{noteText}” to a meal</h2>
        <button className="btn ghost icon" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="modal-body" style={{ display: 'grid', gap: 10 }}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the recipe book" autoFocus />
        {name && (
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => navigate(`/recipes/new?title=${encodeURIComponent(name)}&convertEntry=${entryId}&return=calendar`)}
          >
            + Create recipe “{name}”
          </button>
        )}
        <div className="pick-list">
          {recipes === null && <div className="muted">Loading…</div>}
          {list.map((r) => (
            <button key={r.id} className="book-item" style={{ cursor: 'pointer', textAlign: 'left' }} disabled={busy} onClick={() => pick(r)}>
              <Photo src={r.photo} seed={r.title} />
              <div>
                <div className="t">{r.title}</div>
                <RecipeMeta r={r} today={today} />
              </div>
            </button>
          ))}
          {recipes !== null && list.length === 0 && (
            <div className="muted small">No recipe in the book matches “{query}”. Create one above.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
