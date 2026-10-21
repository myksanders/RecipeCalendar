import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { parseISODate } from '../../shared/dates';

// ---------- hash router ----------

export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/calendar');
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/calendar');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [path, query = ''] = hash.slice(1).split('?');
  return { path, params: new URLSearchParams(query) };
}

export function navigate(to: string) {
  window.location.hash = to;
}

// ---------- photo ----------

const PH_COLORS = [
  ['#fed7aa', '#fca5a5'],
  ['#bbf7d0', '#99f6e4'],
  ['#fde68a', '#fdba74'],
  ['#c7d2fe', '#f5d0fe'],
  ['#fecdd3', '#fde68a'],
  ['#a5f3fc', '#bbf7d0'],
];
const EMOJI = ['🍲', '🥘', '🍝', '🥗', '🍛', '🌮', '🍜', '🥙'];

export function Photo({ src, seed = '', emoji, className = '' }: { src: string | null; seed?: string; emoji?: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = PH_COLORS[h % PH_COLORS.length];
  return (
    <div className={`photo ${className}`}>
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} />
      ) : (
        <div className="ph" style={{ ['--ph-a' as any]: a, ['--ph-b' as any]: b }} aria-hidden>
          {emoji ?? EMOJI[h % EMOJI.length]}
        </div>
      )}
    </div>
  );
}

// ---------- modal ----------

export function Modal({ onClose, children, narrow, label }: { onClose: () => void; children: ReactNode; narrow?: boolean; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${narrow ? 'narrow' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

// ---------- toasts ----------

interface Toast {
  id: number;
  text: string;
  tone?: 'warn';
  action?: { label: string; run: () => void };
}
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.tone === 'warn' ? 7000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone ?? ''}`}>
            <span>{t.text}</span>
            {t.action && (
              <button
                className="btn small"
                onClick={() => {
                  t.action!.run();
                  setToasts((ts) => ts.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- formatting ----------

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDay(s: string) {
  const d = parseISODate(s);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function dowShort(s: string) {
  return DOW[parseISODate(s).getDay()];
}
export function monthName(s: string) {
  const d = parseISODate(s);
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtRange(a: string, b: string) {
  const da = parseISODate(a);
  const db = parseISODate(b);
  if (da.getMonth() === db.getMonth()) return `${da.getDate()}–${db.getDate()} ${MONTHS[db.getMonth()]} ${db.getFullYear()}`;
  return `${da.getDate()} ${MONTHS[da.getMonth()]} – ${db.getDate()} ${MONTHS[db.getMonth()]} ${db.getFullYear()}`;
}

export function agoLabel(date: string | null, todayStr: string): string {
  if (!date) return 'never planned';
  const days = Math.round((parseISODate(todayStr).getTime() - parseISODate(date).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export const KIND_INFO = {
  recipe: { emoji: '🍽', label: 'Recipe' },
  leftovers: { emoji: '♻️', label: 'Leftovers' },
  dining_out: { emoji: '🍷', label: 'Dinner out' },
  fend: { emoji: '🥡', label: 'Fend for yourselves' },
  note: { emoji: '📝', label: 'Note' },
} as const;

export const SLOT_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', other: 'Other' } as const;
