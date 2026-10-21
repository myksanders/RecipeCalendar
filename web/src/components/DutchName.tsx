import { useState } from 'react';
import { ahSearchUrl } from '../../../shared/dutch';
import { api } from '../api';
import { useToast } from '../ui';

/**
 * Inline "teach the Dutch name" form. Saving stores it for the whole household,
 * so the same ingredient gets that name in every recipe from now on.
 */
export function DutchNameForm({
  name,
  current,
  onSaved,
  onCancel,
}: {
  name: string;
  current: string | null;
  onSaved: (nl: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.setDutchName(name, value);
      toast({ text: value.trim() ? `“${name}” is now “${value.trim()}” in every recipe` : `Forgot the Dutch name for “${name}”` });
      onSaved(value.trim());
    } catch (err: any) {
      toast({ text: err.message, tone: 'warn' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="dutch-form" onSubmit={save} onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Dutch for “${name}”`}
        aria-label={`Dutch name for ${name}`}
        autoFocus
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      <button className="btn small primary" disabled={busy}>
        Save
      </button>
      <button type="button" className="btn small ghost" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

export function AhSearchLink({ query }: { query: string }) {
  return (
    <a
      className="ah-link"
      href={ahSearchUrl(query)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Search Albert Heijn for ${query}`}
      title={`Search AH for “${query}”`}
    >
      AH
    </a>
  );
}
