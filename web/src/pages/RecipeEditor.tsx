import { useEffect, useRef, useState } from 'react';
import { guessCategory } from '../../../shared/categorize';
import { parseIngredientLine } from '../../../shared/ingredients';
import { CATEGORIES, type Category, type Ingredient, type RecipeInput } from '../../../shared/types';
import { api, resizeImage } from '../api';
import { navigate, Photo, useToast } from '../ui';

interface IngRow {
  key: number;
  id?: number;
  qty: string;
  unit: string;
  name: string;
  category: Category;
  categoryTouched: boolean;
  note?: string;
}

let keySeq = 1;
const toRow = (i: Ingredient): IngRow => ({
  key: keySeq++,
  id: i.id,
  qty: i.quantity === null ? '' : String(i.quantity),
  unit: i.unit,
  name: i.name,
  category: i.category,
  categoryTouched: true,
  note: i.note,
});
const blankRow = (): IngRow => ({ key: keySeq++, qty: '', unit: '', name: '', category: 'Other', categoryTouched: false });

export function RecipeEditor({ id, returnTo }: { id: number | null; returnTo: string | null }) {
  const toast = useToast();
  const [loading, setLoading] = useState(id !== null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState('4');
  const [prep, setPrep] = useState('');
  const [cook, setCook] = useState('');
  const [tags, setTags] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<IngRow[]>([blankRow()]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [photo, setPhoto] = useState<string | null>(null); // saved photo URL
  const [pendingPhoto, setPendingPhoto] = useState<Blob | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [remoteImage, setRemoteImage] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id === null) return;
    api
      .recipe(id)
      .then((r) => {
        setTitle(r.title);
        setDescription(r.description);
        setServings(String(r.servings));
        setPrep(r.prepMinutes?.toString() ?? '');
        setCook(r.cookMinutes?.toString() ?? '');
        setTags(r.tags.join(', '));
        setSourceUrl(r.sourceUrl ?? '');
        setNotes(r.notes);
        setRows(r.ingredients.length ? r.ingredients.map(toRow) : [blankRow()]);
        setSteps(r.steps.length ? r.steps : ['']);
        setPhoto(r.photo);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  function fill(r: RecipeInput & { imageUrl?: string | null }) {
    setTitle(r.title);
    setDescription(r.description);
    setServings(String(r.servings));
    setPrep(r.prepMinutes?.toString() ?? '');
    setCook(r.cookMinutes?.toString() ?? '');
    setTags(r.tags.join(', '));
    setSourceUrl(r.sourceUrl ?? '');
    setRows(r.ingredients.length ? r.ingredients.map(toRow) : [blankRow()]);
    setSteps(r.steps.length ? r.steps : ['']);
    if (r.imageUrl && !photo && !pendingPhoto) setRemoteImage(r.imageUrl);
  }

  async function doImport() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setError('');
    try {
      fill(await api.importRecipe(importUrl.trim()));
      toast({ text: 'Recipe imported — check it over and save.' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    const blob = await resizeImage(file);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPhoto(blob);
    setPendingPreview(URL.createObjectURL(blob));
    setRemoteImage(null);
  }

  function updateRow(key: number, patch: Partial<IngRow>) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.name !== undefined && !next.categoryTouched) next.category = guessCategory(patch.name);
        return next;
      }),
    );
  }

  function addBulk() {
    const parsed = bulk
      .split('\n')
      .map((l) => l.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
      .map(parseIngredientLine)
      .map(toRow)
      .map((r) => ({ ...r, categoryTouched: false }));
    setRows((rs) => [...rs.filter((r) => r.name.trim()), ...parsed]);
    setBulk('');
    setShowBulk(false);
  }

  function buildInput(): RecipeInput {
    const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
    return {
      title: title.trim(),
      description: description.trim(),
      servings: Math.max(1, Math.round(Number(servings) || 4)),
      prepMinutes: num(prep),
      cookMinutes: num(cook),
      sourceUrl: sourceUrl.trim() || null,
      tags: tags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean),
      notes: notes.trim(),
      ingredients: rows
        .filter((r) => r.name.trim())
        .map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          name: r.name.trim(),
          quantity: num(r.qty),
          unit: r.unit.trim(),
          category: r.category,
          ...(r.note ? { note: r.note } : {}),
        })),
      steps: steps.map((s) => s.trim()).filter(Boolean),
    };
  }

  async function save() {
    const input = buildInput();
    if (!input.title) {
      setError('Give the recipe a name.');
      return;
    }
    if (input.ingredients.some((i) => i.quantity !== null && Number.isNaN(i.quantity))) {
      setError('One of the quantities is not a number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = id === null ? await api.createRecipe(input) : await api.updateRecipe(id, input);
      if (pendingPhoto) await api.uploadPhoto(saved.id, pendingPhoto);
      else if (remoteImage) await api.photoFromUrl(saved.id, remoteImage).catch(() => toast({ text: 'Could not download the photo.', tone: 'warn' }));
      toast({ text: `Saved ${saved.title}` });
      navigate(returnTo === 'calendar' ? '/calendar' : '/recipes');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (id === null || !confirm(`Delete "${title}" from the recipe book? Planned meals using it will show as deleted.`)) return;
    await api.deleteRecipe(id);
    toast({ text: `Deleted ${title}` });
    navigate('/recipes');
  }

  async function clearPhoto() {
    if (pendingPhoto || remoteImage) {
      setPendingPhoto(null);
      setPendingPreview(null);
      setRemoteImage(null);
    } else if (id !== null && photo) {
      await api.removePhoto(id);
      setPhoto(null);
    }
  }

  if (loading) return <div className="page empty">Loading…</div>;

  const shownPhoto = pendingPreview ?? remoteImage ?? photo;

  return (
    <div className="page">
      <div className="page-head">
        <h1>{id === null ? 'New recipe' : 'Edit recipe'}</h1>
        <button className="btn" onClick={() => history.back()}>
          Cancel
        </button>
        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save recipe'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="editor">
        {id === null && (
          <section className="card">
            <h2>Import from a link</h2>
            <p className="muted small" style={{ marginTop: -6 }}>
              Paste a recipe link (Allerhande, Leukerecepten, BBC Good Food, most blogs) and we’ll fill in the form.
            </p>
            <form
              className="import-box"
              onSubmit={(e) => {
                e.preventDefault();
                doImport();
              }}
            >
              <input type="url" placeholder="https://www.ah.nl/allerhande/recept/…" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} />
              <button className="btn" disabled={importing || !importUrl.trim()}>
                {importing ? 'Importing…' : 'Import'}
              </button>
            </form>
          </section>
        )}

        <section className="card two-col">
          <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
            <div className="photo-drop" onClick={() => fileRef.current?.click()} role="button" aria-label="Choose photo">
              <Photo src={shownPhoto} seed={title} emoji="📷" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
            <div className="btn-row">
              <button className="btn small" onClick={() => fileRef.current?.click()}>
                {shownPhoto ? 'Change photo' : 'Add photo'}
              </button>
              {shownPhoto && (
                <button className="btn small ghost" onClick={clearPhoto}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <label className="field">
              Name
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grandma's lasagne" />
            </label>
            <label className="field">
              Description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 60 }} />
            </label>
            <div className="three">
              <label className="field">
                Servings
                <input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
              </label>
              <label className="field">
                Prep (min)
                <input type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} />
              </label>
              <label className="field">
                Cook (min)
                <input type="number" min={0} value={cook} onChange={(e) => setCook(e.target.value)} />
              </label>
            </div>
            <label className="field">
              Tags (comma separated)
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="quick, vegetarian, kid-friendly" />
            </label>
          </div>
        </section>

        <section className="card">
          <div className="page-head" style={{ marginBottom: 10 }}>
            <h2>Ingredients</h2>
            <button className="btn small" onClick={() => setShowBulk((s) => !s)}>
              Paste a list
            </button>
          </div>
          {showBulk && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              <textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={'One per line, e.g.\n500 g rundergehakt\n2 teentjes knoflook\n1 blik tomatenblokjes'}
              />
              <div>
                <button className="btn small primary" onClick={addBulk} disabled={!bulk.trim()}>
                  Add these
                </button>
              </div>
            </div>
          )}
          <div className="ing-row muted small" aria-hidden style={{ fontWeight: 600 }}>
            <span>Qty</span>
            <span>Unit</span>
            <span>Ingredient</span>
            <span className="hide-sm">Aisle</span>
            <span />
          </div>
          {rows.map((r) => (
            <div key={r.key} className="ing-row">
              <input type="text" inputMode="decimal" value={r.qty} onChange={(e) => updateRow(r.key, { qty: e.target.value })} aria-label="Quantity" />
              <input type="text" value={r.unit} onChange={(e) => updateRow(r.key, { unit: e.target.value })} aria-label="Unit" placeholder="g" />
              <input type="text" value={r.name} onChange={(e) => updateRow(r.key, { name: e.target.value })} aria-label="Ingredient" placeholder="ingredient" />
              <select
                value={r.category}
                onChange={(e) => updateRow(r.key, { category: e.target.value as Category, categoryTouched: true })}
                aria-label="Shop category"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button className="btn ghost icon small" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove ingredient">
                ✕
              </button>
            </div>
          ))}
          <button className="btn small" onClick={() => setRows((rs) => [...rs, blankRow()])}>
            + Ingredient
          </button>
        </section>

        <section className="card">
          <h2>Steps</h2>
          {steps.map((s, i) => (
            <div key={i} className="step-row">
              <span className="n">{i + 1}</span>
              <textarea value={s} onChange={(e) => setSteps((ss) => ss.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Step ${i + 1}`} />
              <div style={{ display: 'grid', gap: 2 }}>
                <button className="btn ghost icon small" disabled={i === 0} onClick={() => setSteps((ss) => swap(ss, i, i - 1))} aria-label="Move up">
                  ↑
                </button>
                <button className="btn ghost icon small" onClick={() => setSteps((ss) => ss.filter((_, j) => j !== i))} aria-label="Remove step">
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button className="btn small" onClick={() => setSteps((ss) => [...ss, ''])}>
            + Step
          </button>
        </section>

        <section className="card" style={{ display: 'grid', gap: 10 }}>
          <label className="field">
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Kid prefers it without the chili" style={{ minHeight: 60 }} />
          </label>
          <label className="field">
            Original recipe link
            <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          </label>
        </section>

        <div className="btn-row">
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save recipe'}
          </button>
          {id !== null && (
            <button className="btn danger" onClick={remove} style={{ marginLeft: 'auto' }}>
              Delete recipe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const out = [...arr];
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}
