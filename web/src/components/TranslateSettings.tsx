import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useToast } from '../ui';

type Row = { id: number; title: string; state: 'waiting' | 'working' | 'done' | 'failed'; message?: string; newTitle?: string };

/** Settings section: the Anthropic API key, and translating every Dutch recipe at once. */
export function TranslateSettings() {
  const toast = useToast();
  const [status, setStatus] = useState<{ configured: boolean; fromEnvironment: boolean } | null>(null);
  const [key, setKey] = useState('');
  const [candidates, setCandidates] = useState<{ id: number; title: string }[] | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  useEffect(() => {
    api.translationStatus().then(setStatus).catch(() => {});
    api.translationCandidates().then(setCandidates).catch(() => setCandidates([]));
  }, []);

  async function saveKey(value: string) {
    try {
      setStatus(await api.setTranslationKey(value));
      setKey('');
      toast({ text: value ? 'API key saved on this Mac' : 'API key removed' });
    } catch (e: any) {
      toast({ text: e.message, tone: 'warn' });
    }
  }

  async function translateAll() {
    if (!candidates?.length) return;
    stop.current = false;
    setRunning(true);
    const list: Row[] = candidates.map((c) => ({ ...c, state: 'waiting' }));
    setRows(list);
    const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    for (const c of list) {
      if (stop.current) break;
      update(c.id, { state: 'working' });
      try {
        const saved = await api.translateAndSave(c.id);
        update(c.id, { state: 'done', newTitle: saved.title });
      } catch (e: any) {
        update(c.id, { state: 'failed', message: e.message });
        if (/API key/.test(e.message)) break; // no point trying the rest
      }
    }
    setRunning(false);
    api.translationCandidates().then(setCandidates).catch(() => {});
  }

  const icon = { waiting: '⏳', working: '🌐', done: '✓', failed: '⚠️' } as const;

  return (
    <section className="card">
      <h2>🌐 Translate recipes to English</h2>
      <p className="small" style={{ margin: 0 }}>
        Uses Claude to translate a recipe’s name, ingredients, steps and notes. Amounts never change, the shopping list keeps
        finding the right Albert Heijn products, and each translated recipe keeps its original so you can restore it. Costs
        a few cents per recipe on your Anthropic account.
      </p>

      <h3>Anthropic API key</h3>
      {status?.fromEnvironment ? (
        <p className="small muted" style={{ margin: 0 }}>
          Set on the Mac through the ANTHROPIC_API_KEY environment variable.
        </p>
      ) : (
        <form
          className="copy-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) saveKey(key.trim());
          }}
        >
          <input
            type="password"
            autoComplete="off"
            placeholder={status?.configured ? 'Saved ✓ (paste a new key to replace)' : 'sk-ant-…'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            aria-label="Anthropic API key"
          />
          <button className="btn" disabled={!key.trim()}>
            Save
          </button>
          {status?.configured && (
            <button type="button" className="btn ghost" onClick={() => saveKey('')}>
              Remove
            </button>
          )}
        </form>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        Create one at console.anthropic.com → API keys. It’s stored only on the Mac running the meal planner, never in the
        browser.
      </p>

      <h3>Recipes still in Dutch</h3>
      {candidates === null ? (
        <p className="small muted" style={{ margin: 0 }}>Checking…</p>
      ) : candidates.length === 0 && !rows.length ? (
        <p className="small muted" style={{ margin: 0 }}>None — your recipe book is in English.</p>
      ) : (
        <>
          {!rows.length && (
            <p className="small" style={{ margin: 0 }}>
              {candidates.map((c) => c.title).join(', ')}
            </p>
          )}
          {!running && candidates.length === 0 ? (
            <p className="small" style={{ margin: 0 }}>All recipes are in English now.</p>
          ) : (
            <div className="btn-row">
              {!running ? (
                <button className="btn primary" disabled={!status?.configured || !candidates.length} onClick={translateAll}>
                  Translate {candidates.length} {candidates.length === 1 ? 'recipe' : 'recipes'}
                </button>
              ) : (
                <button className="btn" onClick={() => (stop.current = true)}>
                  Stop after this one
                </button>
              )}
              {!status?.configured && <span className="small muted">Add your API key first.</span>}
            </div>
          )}
          {rows.length > 0 && (
            <ul className="translate-list">
              {rows.map((r) => (
                <li key={r.id} className={r.state}>
                  <span aria-hidden>{icon[r.state]}</span>{' '}
                  <a href={`#/recipes/${r.id}`}>{r.title}</a>
                  {r.newTitle && r.newTitle !== r.title && <> → {r.newTitle}</>}
                  {r.message && <span className="muted"> — {r.message}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
