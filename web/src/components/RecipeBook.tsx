import { useDraggable } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import type { RecipeSummary } from '../../../shared/types';
import { agoLabel, Photo } from '../ui';

const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

type Sort = 'az' | 'stale' | 'popular';

export function sortRecipes(recipes: RecipeSummary[], sort: Sort, query: string) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? recipes.filter((r) => r.title.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q)))
    : recipes;
  const sorted = [...filtered];
  if (sort === 'stale') sorted.sort((a, b) => (a.lastPlanned ?? '0000').localeCompare(b.lastPlanned ?? '0000'));
  if (sort === 'popular') sorted.sort((a, b) => b.timesPlanned - a.timesPlanned);
  return sorted;
}

export function RecipeMeta({ r, today }: { r: RecipeSummary; today: string }) {
  const recent = r.lastPlanned && Date.parse(today) - Date.parse(r.lastPlanned) < 14 * 86400000;
  return (
    <div className="meal-meta">
      {r.nextPlanned ? (
        <span className="chip good">planned</span>
      ) : (
        <span className={`chip ${recent ? 'warn' : ''}`}>{agoLabel(r.lastPlanned, today)}</span>
      )}
      {r.totalMinutes ? <span className="chip">{r.totalMinutes} min</span> : null}
    </div>
  );
}

function BookItem({
  r,
  today,
  selected,
  onSelect,
}: {
  r: RecipeSummary;
  today: string;
  selected: boolean;
  onSelect: (r: RecipeSummary) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `recipe-${r.id}`, data: { recipe: r } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`book-item ${selected ? 'selected' : ''}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={() => onSelect(r)}
      title={TOUCH ? "Press and hold, then drag onto a day" : "Drag onto a day, or tap and then tap a day"}
    >
      <Photo src={r.photo} seed={r.title} />
      <div>
        <div className="t">{r.title}</div>
        <RecipeMeta r={r} today={today} />
      </div>
    </div>
  );
}

export function RecipeBook({
  recipes,
  today,
  selectedId,
  onSelect,
  className = '',
}: {
  recipes: RecipeSummary[];
  today: string;
  selectedId: number | null;
  onSelect: (r: RecipeSummary) => void;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('stale');
  const list = useMemo(() => sortRecipes(recipes, sort, query), [recipes, sort, query]);
  return (
    <aside className={`book ${className}`}>
      <div className="book-head">
        <h2>📖 Recipe book</h2>
        <a className="btn small" href="#/recipes/new?return=calendar">
          + New
        </a>
      </div>
      <input type="search" placeholder="Search recipes or tags" value={query} onChange={(e) => setQuery(e.target.value)} />
      <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort recipes">
        <option value="stale">Longest since we had it</option>
        <option value="az">A–Z</option>
        <option value="popular">Most planned</option>
      </select>
      <p className="muted small" style={{ margin: 0 }}>
        {TOUCH ? 'Press and hold a recipe, then drag it onto a day — or tap it, then tap a day.' : 'Drag a recipe onto a day — or tap it, then tap a day.'}
      </p>
      <div className="book-list">
        {list.map((r) => (
          <BookItem key={r.id} r={r} today={today} selected={selectedId === r.id} onSelect={onSelect} />
        ))}
        {list.length === 0 && <div className="empty">No recipes found.</div>}
      </div>
    </aside>
  );
}
