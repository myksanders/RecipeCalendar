import { useEffect, useState } from 'react';
import { api } from '../api';
import { navigate } from '../ui';

// Opened by the "Add to Meal Plan" bookmark from a recipe page. That page can't
// call this plain-http home server itself (browsers block https → http requests),
// but windows can always message each other: we say "ready", it sends the page.

const WAIT_MS = 15000;

export function ImportFromPage() {
  const [status, setStatus] = useState<'waiting' | 'reading' | 'error'>('waiting');
  const [error, setError] = useState('');

  useEffect(() => {
    const opener = window.opener as Window | null;
    if (!opener) {
      setStatus('error');
      setError('Open this from the “Add to Meal Plan” bookmark while you’re on a recipe page.');
      return;
    }
    let done = false;
    const ping = setInterval(() => opener.postMessage('mealplan-ready', '*'), 300);
    const timeout = setTimeout(() => {
      if (done) return;
      clearInterval(ping);
      setStatus('error');
      setError('The recipe page didn’t answer. Go back to it and click “Add to Meal Plan” again.');
    }, WAIT_MS);

    async function onMessage(e: MessageEvent) {
      if (done || e.source !== opener) return;
      const d = e.data;
      if (!d || d.type !== 'mealplan-page' || typeof d.url !== 'string' || typeof d.html !== 'string') return;
      done = true;
      clearInterval(ping);
      clearTimeout(timeout);
      setStatus('reading');
      try {
        const { id } = await api.importHtml(d.url, d.html);
        navigate(`/recipes/new?draft=${id}`);
      } catch (err: any) {
        setStatus('error');
        setError(err.message);
      }
    }
    window.addEventListener('message', onMessage);
    return () => {
      clearInterval(ping);
      clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  return (
    <div className="page empty">
      {status === 'waiting' && <p>Waiting for the recipe page…</p>}
      {status === 'reading' && <p>Reading the recipe…</p>}
      {status === 'error' && (
        <>
          <p className="error">{error}</p>
          <p>
            <a href="#/recipes/new">Add a recipe by hand</a> · <a href="#/settings">How to set up Add to Meal Plan</a>
          </p>
        </>
      )}
    </div>
  );
}
