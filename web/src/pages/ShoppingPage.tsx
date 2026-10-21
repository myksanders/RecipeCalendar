import { useCallback, useEffect, useState } from 'react';
import { guessCategory } from '../../../shared/categorize';
import { addDays, startOfWeek, today as todayFn } from '../../../shared/dates';
import { formatQuantity } from '../../../shared/ingredients';
import { shoppingListToText } from '../../../shared/shopping';
import { CATEGORIES, type Category, type ShoppingItem, type ShoppingList } from '../../../shared/types';
import { api, cachedSettings } from '../api';
import { fmtRange, useToast } from '../ui';

const SHORTCUT_KEY = 'shopping.shortcutName';

function loadRange(): { from: string; to: string } {
  const t = todayFn();
  return { from: t, to: addDays(t, 6) };
}

export function ShoppingPage() {
  const [range, setRange] = useState(loadRange);
  const [list, setList] = useState<ShoppingList | null>(null);
  const [newItem, setNewItem] = useState('');
  const [newCat, setNewCat] = useState<Category | ''>('');
  const [shortcut, setShortcut] = useState(() => {
    try {
      return localStorage.getItem(SHORTCUT_KEY) ?? 'Meal Plan Shopping List';
    } catch {
      return 'Meal Plan Shopping List';
    }
  });
  const toast = useToast();

  const load = useCallback(() => {
    api.shoppingList(range.from, range.to).then(setList).catch((e) => toast({ text: e.message, tone: 'warn' }));
  }, [range, toast]);
  useEffect(load, [load]);

  const [weekStart, setWeekStart] = useState(() => cachedSettings().weekStart);
  useEffect(() => {
    api.settings().then((s) => setWeekStart(s.weekStart)).catch(() => {});
  }, []);

  const t = todayFn();
  const ws = startOfWeek(t, weekStart);
  const presets = [
    { label: 'Next 7 days', from: t, to: addDays(t, 6) },
    { label: 'This week', from: ws, to: addDays(ws, 6) },
    { label: 'Next week', from: addDays(ws, 7), to: addDays(ws, 13) },
  ];

  async function tick(item: ShoppingItem) {
    if (item.extraId) {
      await api.updateExtra(item.extraId, { done: true });
      load();
      toast({
        text: `Ticked off ${item.name}`,
        action: { label: 'Undo', run: () => api.updateExtra(item.extraId!, { done: false }).then(load) },
      });
      return;
    }
    await api.markHave(item.refs, true);
    load();
    toast({
      text: `${item.name} marked as in the house`,
      action: { label: 'Undo', run: () => api.markHave(item.refs, false).then(load) },
    });
  }

  async function addExtra(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    await api.addExtra(newItem.trim(), newCat || undefined);
    setNewItem('');
    setNewCat('');
    load();
  }

  const text = list ? shoppingListToText(list) : '';
  const itemCount = list?.groups.reduce((n, g) => n + g.items.length, 0) ?? 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast({ text: 'Copied — paste it into a note or message.' });
    } catch {
      // Clipboard API needs https; plain-http LAN falls back to a selectable box.
      window.prompt('Copy the list:', text);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Shopping list', text });
      } catch {
        // cancelled
      }
    } else copy();
  }

  function runShortcut() {
    try {
      localStorage.setItem(SHORTCUT_KEY, shortcut);
    } catch {
      // ignore
    }
    const input = encodeURIComponent(text);
    window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcut)}&input=text&text=${input}`;
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <h1>🛒 Shopping list</h1>
      </div>

      <div className="range">
        {presets.map((p) => (
          <button
            key={p.label}
            className={`btn small ${p.from === range.from && p.to === range.to ? 'primary' : ''}`}
            onClick={() => setRange({ from: p.from, to: p.to })}
          >
            {p.label}
          </button>
        ))}
        <input type="date" value={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} aria-label="From" />
        <span className="muted">→</span>
        <input type="date" value={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} aria-label="To" />
      </div>

      <div className="shop-actions">
        <div className="btn-row">
          <button className="btn primary" onClick={share} disabled={!itemCount}>
            Share…
          </button>
          <button className="btn" onClick={copy} disabled={!itemCount}>
            Copy
          </button>
          <button className="btn" onClick={runShortcut} disabled={!itemCount} title="Runs your iOS Shortcut that updates the shared Apple Note">
            📝 Send to Notes
          </button>
        </div>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          {list ? `${fmtRange(list.from, list.to)} · ${itemCount} to buy` : ''}
          {list && list.haveCount > 0 ? ` · ${list.haveCount} already in the house` : ''}
        </p>
      </div>

      <form className="add-extra" onSubmit={addExtra}>
        <input
          type="text"
          placeholder="Add something else (milk, toilet paper…)"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
        />
        <select value={newCat || (newItem ? guessCategory(newItem) : '')} onChange={(e) => setNewCat(e.target.value as Category)} aria-label="Category">
          <option value="" disabled>
            Category
          </option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="btn">Add</button>
      </form>

      {list === null ? (
        <div className="empty">Loading…</div>
      ) : itemCount === 0 ? (
        <div className="empty">
          Nothing to buy for these days. Plan some meals on the <a href="#/calendar">calendar</a>, or untick ingredients you’re out of.
        </div>
      ) : (
        list.groups.map((g) => (
          <div key={g.category} className="card shop-group">
            <h3>
              {g.category}
              <span className="muted">{g.items.length}</span>
            </h3>
            {g.items.map((it) => (
              <label key={it.key} className="shop-item">
                <input type="checkbox" checked={false} onChange={() => tick(it)} aria-label={`Have ${it.name}`} />
                <div>
                  <div>
                    {(it.quantity !== null || it.unit) && <span className="q">{formatQuantity(it.quantity, it.unit)} </span>}
                    {it.name}
                  </div>
                  {it.usedIn.length > 0 && <div className="src">{it.usedIn.join(' · ')}</div>}
                </div>
                {it.extraId && (
                  <button
                    className="btn ghost icon small"
                    onClick={async (e) => {
                      e.preventDefault();
                      await api.deleteExtra(it.extraId!);
                      load();
                    }}
                    aria-label={`Remove ${it.name}`}
                  >
                    ✕
                  </button>
                )}
              </label>
            ))}
          </div>
        ))
      )}

      <details className="card" style={{ padding: 14, marginTop: 20 }}>
        <summary style={{ fontWeight: 600, cursor: 'pointer' }}>Apple Notes shortcut setup</summary>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <p className="small" style={{ margin: 0 }}>
            “Send to Notes” opens an iOS Shortcut and hands it this list. Create the Shortcut once on each iPhone (see
            Settings → Apple Notes for the step-by-step), then put its exact name here:
          </p>
          <label className="field">
            Shortcut name
            <input type="text" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
          </label>
        </div>
      </details>
    </div>
  );
}
