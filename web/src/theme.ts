import { useEffect, useState } from 'react';

// Per-device theme choice: each phone keeps its own, so one person switching to
// dark at bedtime doesn't change anyone else's screen. index.html applies the
// stored choice before first paint.

export type ThemePref = 'auto' | 'light' | 'dark';
const KEY = 'theme';
const EVENT = 'themechange';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function effective(pref: ThemePref): 'light' | 'dark' {
  return pref === 'auto' ? (media().matches ? 'dark' : 'light') : pref;
}

function apply(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'auto') delete root.dataset.theme;
  else root.dataset.theme = pref;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effective(pref) === 'dark' ? '#1a1411' : '#c2410c');
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // private mode: still applies for this visit
  }
  apply(pref);
  window.dispatchEvent(new Event(EVENT));
}

export function useTheme() {
  const [pref, setPref] = useState(getThemePref);
  const [systemDark, setSystemDark] = useState(() => media().matches);
  useEffect(() => {
    apply(getThemePref());
    const onPref = () => setPref(getThemePref());
    const mq = media();
    const onSystem = () => {
      setSystemDark(mq.matches);
      apply(getThemePref());
    };
    window.addEventListener(EVENT, onPref);
    mq.addEventListener('change', onSystem);
    return () => {
      window.removeEventListener(EVENT, onPref);
      mq.removeEventListener('change', onSystem);
    };
  }, []);
  const isDark = pref === 'dark' || (pref === 'auto' && systemDark);
  return { pref, isDark, setPref: setThemePref };
}
