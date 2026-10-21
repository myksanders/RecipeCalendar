import { useEffect, useMemo, useState } from 'react';
import { today as todayFn } from '../../../shared/dates';
import type { RecipeSummary } from '../../../shared/types';
import { api } from '../api';
import { RecipeMeta, sortRecipes } from '../components/RecipeBook';
import { Photo } from '../ui';

export function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'az' | 'stale' | 'popular'>('az');
  const today = todayFn();

  useEffect(() => {
    api.recipes().then(setRecipes).catch(() => setRecipes([]));
  }, []);

  const list = useMemo(() => sortRecipes(recipes ?? [], sort, query), [recipes, sort, query]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>📖 Recipe book</h1>
        <a className="btn primary" href="#/recipes/new">
          + New recipe
        </a>
      </div>
      <div className="filters">
        <input type="search" placeholder="Search by name or tag" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort">
          <option value="az">A–Z</option>
          <option value="stale">Longest since we had it</option>
          <option value="popular">Most planned</option>
        </select>
      </div>
      {recipes === null ? (
        <div className="empty">Loading…</div>
      ) : list.length === 0 ? (
        <div className="empty">
          {recipes.length === 0 ? (
            <>
              No recipes yet. <a href="#/recipes/new">Add your first one</a> — or paste a link from Allerhande.
            </>
          ) : (
            'Nothing matches that search.'
          )}
        </div>
      ) : (
        <div className="recipe-grid">
          {list.map((r) => (
            <a key={r.id} href={`#/recipes/${r.id}`} className="card recipe-card">
              <Photo src={r.photo} seed={r.title} />
              <div className="body">
                <div className="t">{r.title}</div>
                <RecipeMeta r={r} today={today} />
                {r.tags.length > 0 && (
                  <div className="meal-meta">
                    {r.tags.slice(0, 4).map((t) => (
                      <span key={t} className="chip">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
