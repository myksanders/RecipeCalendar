import { CalendarPage } from './pages/CalendarPage';
import { RecipeEditor } from './pages/RecipeEditor';
import { RecipesPage } from './pages/RecipesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ShoppingPage } from './pages/ShoppingPage';
import { useTheme } from './theme';
import { useRoute } from './ui';

const TABS = [
  { href: '#/calendar', label: 'Calendar', icon: '📅' },
  { href: '#/recipes', label: 'Recipe book', icon: '📖' },
  { href: '#/shopping', label: 'Shopping', icon: '🛒' },
  { href: '#/settings', label: 'Settings', icon: '⚙️' },
];

export function App() {
  const { path, params } = useRoute();
  const theme = useTheme();
  const section = '#/' + (path.split('/')[1] ?? '');

  let page;
  const edit = path.match(/^\/recipes\/(\d+|new)$/);
  if (edit) page = <RecipeEditor key={path} id={edit[1] === 'new' ? null : Number(edit[1])} returnTo={params.get('return')} />;
  else if (path.startsWith('/recipes')) page = <RecipesPage />;
  else if (path.startsWith('/shopping')) page = <ShoppingPage />;
  else if (path.startsWith('/settings')) page = <SettingsPage />;
  else page = <CalendarPage openEntryId={params.get('entry') ? Number(params.get('entry')) : null} />;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/calendar">
          <img src="/icon.svg" alt="" />
          Meal Plan
        </a>
        <nav className="nav">
          {TABS.map((t) => (
            <a key={t.href} href={t.href} className={section === t.href ? 'active' : ''}>
              {t.label}
            </a>
          ))}
        </nav>
        <button
          className="btn ghost icon theme-btn"
          onClick={() => theme.setPref(theme.isDark ? 'light' : 'dark')}
          aria-label={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme.isDark ? 'Light mode' : 'Dark mode'}
        >
          {theme.isDark ? '☀️' : '🌙'}
        </button>
      </header>
      <main>{page}</main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <a key={t.href} href={t.href} className={section === t.href ? 'active' : ''}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
