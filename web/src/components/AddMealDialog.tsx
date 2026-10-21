import { useEffect, useMemo, useState } from 'react';
import { addDays } from '../../../shared/dates';
import type { EntryInput, EntryKind, MealEntry, RecipeSummary, Slot } from '../../../shared/types';
import { SLOTS } from '../../../shared/types';
import { api } from '../api';
import { fmtDay, KIND_INFO, Modal, Photo, SLOT_LABEL } from '../ui';
import { RecipeMeta, sortRecipes } from './RecipeBook';

const KINDS: EntryKind[] = ['recipe', 'leftovers', 'dining_out', 'fend', 'note'];

export function AddMealDialog({
  date,
  today,
  recipes,
  people,
  onClose,
  onAdd,
}: {
  date: string;
  today: string;
  recipes: RecipeSummary[];
  people: string[];
  onClose: () => void;
  onAdd: (input: EntryInput, recipe?: RecipeSummary) => Promise<void>;
}) {
  const [kind, setKind] = useState<EntryKind>('recipe');
  const [slot, setSlot] = useState<Slot>('dinner');
  const [who, setWho] = useState('');
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<MealEntry[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (kind !== 'leftovers' || recent) return;
    api
      .entries(addDays(date, -5), date)
      .then((es) => setRecent(es.filter((e) => e.kind === 'recipe').reverse()))
      .catch(() => setRecent([]));
  }, [kind, date, recent]);

  useEffect(() => {
    if (kind === 'leftovers') {
      setSlot('lunch');
      if (people.includes('Kid')) setWho('Kid');
    } else setSlot('dinner');
  }, [kind, people]);

  const list = useMemo(() => sortRecipes(recipes, 'stale', query), [recipes, query]);

  async function add(input: Omit<EntryInput, 'date' | 'slot' | 'who'>, recipe?: RecipeSummary) {
    setBusy(true);
    try {
      await onAdd({ date, slot, who, ...input }, recipe);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} narrow label={`Add to ${fmtDay(date)}`}>
      <div className="modal-head">
        <h2>Add to {fmtDay(date)}</h2>
        <button className="btn ghost icon" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
        <div className="kind-grid">
          {KINDS.map((k) => (
            <button key={k} className={`kind-btn ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
              <span className="e">{KIND_INFO[k].emoji}</span>
              {KIND_INFO[k].label}
            </button>
          ))}
        </div>
        <div className="three" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label className="field">
            Meal
            <select value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {SLOT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            For
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Everyone</option>
              {people
                .filter((p) => p !== 'Everyone')
                .map((p) => (
                  <option key={p}>{p}</option>
                ))}
            </select>
          </label>
        </div>

        {kind === 'recipe' && (
          <div>
            <input type="search" placeholder="Search the recipe book" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            <div className="pick-list">
              {list.map((r) => (
                <button
                  key={r.id}
                  className="book-item"
                  style={{ cursor: 'pointer', textAlign: 'left' }}
                  disabled={busy}
                  onClick={() => add({ kind: 'recipe', recipeId: r.id }, r)}
                >
                  <Photo src={r.photo} seed={r.title} />
                  <div>
                    <div className="t">{r.title}</div>
                    <RecipeMeta r={r} today={today} />
                  </div>
                </button>
              ))}
              {list.length === 0 && (
                <div className="empty">
                  No recipes yet. <a href="#/recipes/new?return=calendar">Add one</a>
                </div>
              )}
            </div>
          </div>
        )}

        {kind === 'leftovers' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="muted small">Leftovers from which meal?</div>
            {recent === null && <div className="muted">Loading…</div>}
            {recent?.map((e) => (
              <button
                key={e.id}
                className="book-item"
                style={{ cursor: 'pointer', textAlign: 'left' }}
                disabled={busy}
                onClick={() => add({ kind: 'leftovers', leftoverOfEntryId: e.id })}
              >
                <Photo src={e.photo} seed={e.displayTitle} />
                <div>
                  <div className="t">{e.displayTitle}</div>
                  <div className="muted small">{fmtDay(e.date)}</div>
                </div>
              </button>
            ))}
            {recent?.length === 0 && <div className="muted small">No cooked meals in the last few days.</div>}
            <button className="btn" disabled={busy} onClick={() => add({ kind: 'leftovers', title: title || 'Leftovers' })}>
              Just "leftovers" (whatever's in the fridge)
            </button>
          </div>
        )}

        {(kind === 'dining_out' || kind === 'fend' || kind === 'note') && (
          <form
            style={{ display: 'grid', gap: 10 }}
            onSubmit={(ev) => {
              ev.preventDefault();
              add({ kind, title: title.trim() });
            }}
          >
            <label className="field">
              {kind === 'dining_out' ? 'Where? (optional)' : kind === 'fend' ? 'Note (optional)' : 'Note'}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === 'dining_out' ? 'e.g. Pizzeria Da Mario' : kind === 'note' ? 'e.g. Grandma visiting' : ''}
                autoFocus
                required={kind === 'note'}
              />
            </label>
            <button className="btn primary" disabled={busy}>
              Add {KIND_INFO[kind].label.toLowerCase()}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
