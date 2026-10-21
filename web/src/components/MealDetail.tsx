import { useCallback, useEffect, useState } from 'react';
import { addDays } from '../../../shared/dates';
import { formatIngredient } from '../../../shared/ingredients';
import type { EntryDetail, Slot } from '../../../shared/types';
import { SLOTS } from '../../../shared/types';
import { api } from '../api';
import { fmtDay, KIND_INFO, Modal, navigate, Photo, SLOT_LABEL, useToast } from '../ui';

export function MealDetail({
  entryId,
  people,
  onClose,
  onChanged,
}: {
  entryId: number;
  people: string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [d, setD] = useState<EntryDetail | null>(null);
  const [error, setError] = useState('');
  const toast = useToast();

  const load = useCallback(() => {
    api
      .entry(entryId)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [entryId]);
  useEffect(load, [load]);

  async function patch(p: Parameters<typeof api.updateEntry>[1]) {
    try {
      await api.updateEntry(entryId, p);
      load();
      onChanged();
    } catch (e: any) {
      toast({ text: e.message, tone: 'warn' });
    }
  }

  async function toggle(ingredientId: number, have: boolean) {
    if (!d) return;
    setD({ ...d, checks: { ...d.checks, [ingredientId]: have }, checkedCount: d.checkedCount + (have ? 1 : -1) });
    try {
      await api.setCheck(entryId, ingredientId, have);
      onChanged();
    } catch (e: any) {
      toast({ text: e.message, tone: 'warn' });
      load();
    }
  }

  async function remove() {
    if (!d) return;
    await api.deleteEntry(d.id);
    onChanged();
    onClose();
    toast({
      text: `Removed ${d.displayTitle} from ${fmtDay(d.date)}`,
      action: {
        label: 'Undo',
        run: async () => {
          await api.createEntry({
            date: d.date,
            slot: d.slot,
            kind: d.kind,
            recipeId: d.recipeId,
            leftoverOfEntryId: d.leftoverOfEntryId,
            title: d.title,
            who: d.who,
            servings: d.servings,
            notes: d.notes,
          });
          onChanged();
        },
      },
    });
  }

  async function leftoversTomorrow() {
    if (!d) return;
    const date = addDays(d.date, 1);
    await api.createEntry({
      date,
      slot: 'lunch',
      kind: 'leftovers',
      leftoverOfEntryId: d.id,
      who: people.includes('Kid') ? 'Kid' : '',
    });
    onChanged();
    toast({ text: `Leftovers added to ${fmtDay(date)} lunch` });
  }

  if (error)
    return (
      <Modal onClose={onClose} narrow label="Meal">
        <div className="modal-body error">{error}</div>
      </Modal>
    );
  if (!d)
    return (
      <Modal onClose={onClose} narrow label="Meal">
        <div className="modal-body muted">Loading…</div>
      </Modal>
    );

  const recipe = d.recipe;
  const info = KIND_INFO[d.kind];
  const isRecipe = d.kind === 'recipe';
  const servings = d.servings ?? recipe?.servings ?? null;
  const haveCount = recipe ? recipe.ingredients.filter((i) => d.checks[i.id!]).length : 0;

  return (
    <Modal onClose={onClose} label={d.displayTitle}>
      <button className="btn icon close-x" onClick={onClose} aria-label="Close">
        ✕
      </button>
      {recipe ? (
        <Photo src={recipe.photo} seed={recipe.title} className="hero" />
      ) : (
        <Photo src={null} seed={d.kind} emoji={info.emoji} className="hero" />
      )}
      <div className="detail-head">
        <div>
          <div className="slot-label">
            {info.emoji} {info.label} · {fmtDay(d.date)}
          </div>
          <h1>{d.displayTitle}</h1>
          {d.sourceEntry && (
            <div className="muted small">
              From {d.sourceEntry.displayTitle} on {fmtDay(d.sourceEntry.date)}
            </div>
          )}
          {recipe?.description && <p className="muted" style={{ marginBottom: 0 }}>{recipe.description}</p>}
        </div>
        <div className="detail-meta">
          <label className="field">
            Day
            <input type="date" value={d.date} onChange={(e) => e.target.value && patch({ date: e.target.value })} />
          </label>
          <label className="field">
            Meal
            <select value={d.slot} onChange={(e) => patch({ slot: e.target.value as Slot })}>
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {SLOT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            For
            <select value={d.who} onChange={(e) => patch({ who: e.target.value })}>
              <option value="">Everyone</option>
              {[...new Set([...people.filter((p) => p !== 'Everyone'), ...(d.who ? [d.who] : [])])].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          {isRecipe && recipe && (
            <label className="field">
              Servings
              <div className="stepper">
                <button className="btn small icon" onClick={() => servings && servings > 1 && patch({ servings: servings - 1 })} aria-label="Fewer servings">
                  −
                </button>
                <span>{servings}</span>
                <button className="btn small icon" onClick={() => servings && patch({ servings: servings + 1 })} aria-label="More servings">
                  +
                </button>
              </div>
            </label>
          )}
          {!recipe && (
            <label className="field">
              Title
              <input
                type="text"
                defaultValue={d.title}
                placeholder={info.label}
                onBlur={(e) => e.target.value !== d.title && patch({ title: e.target.value })}
              />
            </label>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {recipe ? (
          <div className="checklist">
            <h3>
              Ingredients
              <span className="muted small">
                {haveCount}/{recipe.ingredients.length} in house
              </span>
            </h3>
            <p className="muted small" style={{ margin: '4px 0 6px' }}>
              {d.kind === 'leftovers'
                ? 'Leftovers don’t add anything to the shopping list.'
                : 'Tick what you already have — the rest goes on the shopping list.'}
            </p>
            {recipe.ingredients.map((i) => {
              const have = !!d.checks[i.id!];
              return (
                <label key={i.id} className={`check-row ${have ? 'have' : ''}`}>
                  <input type="checkbox" checked={have} onChange={(e) => toggle(i.id!, e.target.checked)} />
                  <span>
                    <span className="name">{formatIngredient(i, d.scale)}</span>
                    {i.note && <span className="muted small">, {i.note}</span>}
                    <div className="cat">{i.category}</div>
                  </span>
                </label>
              );
            })}
            {recipe.ingredients.length === 0 && <div className="muted small">No ingredients listed.</div>}
          </div>
        ) : (
          <div className="checklist">
            <h3>Notes</h3>
            <textarea
              defaultValue={d.notes}
              placeholder="Anything to remember"
              onBlur={(e) => e.target.value !== d.notes && patch({ notes: e.target.value })}
              style={{ marginTop: 8 }}
            />
          </div>
        )}

        <div style={{ display: 'grid', gap: 16 }}>
          {recipe && recipe.steps.length > 0 && (
            <div>
              <h2 style={{ marginBottom: 10 }}>Steps</h2>
              <ol className="steps">
                {recipe.steps.map((s, i) => (
                  <li key={i}>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {recipe && (recipe.prepMinutes || recipe.cookMinutes || recipe.sourceUrl || recipe.notes) && (
            <div className="muted small" style={{ display: 'grid', gap: 4 }}>
              {(recipe.prepMinutes || recipe.cookMinutes) && (
                <div>
                  ⏱ {recipe.prepMinutes ? `${recipe.prepMinutes} min prep` : ''}
                  {recipe.prepMinutes && recipe.cookMinutes ? ' · ' : ''}
                  {recipe.cookMinutes ? `${recipe.cookMinutes} min cooking` : ''}
                </div>
              )}
              {recipe.notes && <div>📝 {recipe.notes}</div>}
              {recipe.sourceUrl && (
                <div>
                  🔗{' '}
                  <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                    Original recipe
                  </a>
                </div>
              )}
            </div>
          )}
          <div className="btn-row">
            {isRecipe && (
              <button className="btn" onClick={leftoversTomorrow}>
                ♻️ Leftovers tomorrow
              </button>
            )}
            {recipe && (
              <button className="btn" onClick={() => navigate(`/recipes/${recipe.id}?return=calendar`)}>
                ✏️ Edit recipe
              </button>
            )}
            <button className="btn danger" onClick={remove}>
              Remove from calendar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
