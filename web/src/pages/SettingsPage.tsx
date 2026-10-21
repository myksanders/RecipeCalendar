import { useEffect, useState } from 'react';
import type { Settings, Slot } from '../../../shared/types';
import { api } from '../api';
import { useTheme, type ThemePref } from '../theme';
import { SLOT_LABEL, useToast } from '../ui';

function CopyField({ value }: { value: string }) {
  const toast = useToast();
  return (
    <div className="copy-row">
      <input type="text" readOnly value={value} onFocus={(e) => e.target.select()} />
      <button
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast({ text: 'Copied' });
          } catch {
            window.prompt('Copy this:', value);
          }
        }}
      >
        Copy
      </button>
    </div>
  );
}

export function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [people, setPeople] = useState('');
  const toast = useToast();
  const theme = useTheme();
  const origin = window.location.origin;
  const host = window.location.host;

  useEffect(() => {
    api.settings().then((x) => {
      setS(x);
      setPeople(x.people.join(', '));
    });
  }, []);

  async function save(patch: Partial<Settings>) {
    try {
      const next = await api.updateSettings(patch);
      setS(next);
      setPeople(next.people.join(', '));
      toast({ text: 'Saved' });
    } catch (e: any) {
      toast({ text: e.message, tone: 'warn' });
    }
  }

  if (!s) return <div className="page empty">Loading…</div>;

  return (
    <div className="page">
      <div className="page-head">
        <h1>⚙️ Settings</h1>
      </div>
      <div className="settings">
        <section className="card">
          <h2>Household</h2>
          <label className="field">
            People / groups you plan meals for (comma separated)
            <input
              type="text"
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              onBlur={() =>
                save({
                  people: people
                    .split(',')
                    .map((p) => p.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <p className="muted small" style={{ margin: 0 }}>
            Used for the “For” field on meals, e.g. leftovers for the kid. Include “Kid” and leftovers default to them.
          </p>
        </section>

        <section className="card">
          <h2>Meals you plan</h2>
          <div className="meal-toggles">
            {(['breakfast', 'lunch', 'dinner'] as Slot[]).map((slot) => {
              const always = slot === 'dinner';
              const on = always || s.mealSlots.includes(slot);
              return (
                <label key={slot} className={`meal-toggle ${on ? 'on' : ''} ${always ? 'always' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={always}
                    onChange={(e) =>
                      save({ mealSlots: e.target.checked ? [...s.mealSlots, slot] : s.mealSlots.filter((x) => x !== slot) })
                    }
                  />
                  <span>{SLOT_LABEL[slot]}</span>
                  {always && <span className="muted small">always</span>}
                </label>
              );
            })}
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Turn on breakfast or lunch to plan them too. Meals already on the calendar always stay visible.
          </p>
        </section>

        <section className="card">
          <h2>Calendar</h2>
          <div className="field">
            Weeks start on
            <div className="seg" role="radiogroup" aria-label="Weeks start on" style={{ justifySelf: 'start' }}>
              {([
                [0, 'Sunday'],
                [1, 'Monday'],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={s.weekStart === v}
                  className={s.weekStart === v ? 'on' : ''}
                  onClick={() => s.weekStart !== v && save({ weekStart: v })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Used by the week and month views and the shopping list’s “This week” / “Next week”.
          </p>
          <div className="field">
            Appearance on this device
            <div className="seg" role="radiogroup" aria-label="Appearance" style={{ justifySelf: 'start' }}>
              {([
                ['light', '☀️ Light'],
                ['dark', '🌙 Dark'],
                ['auto', 'Match device'],
              ] as [ThemePref, string][]).map(([v, label]) => (
                <button key={v} role="radio" aria-checked={theme.pref === v} className={theme.pref === v ? 'on' : ''} onClick={() => theme.setPref(v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Only changes this phone or computer. The 🌙 button at the top switches quickly.
          </p>
        </section>

        <section className="card">
          <h2>Variety</h2>
          <label className="field">
            Warn when a recipe repeats within this many weeks (0 = never warn)
            <input
              type="number"
              min={0}
              max={26}
              defaultValue={s.varietyWeeks}
              onBlur={(e) => {
                const v = Math.max(0, Math.min(26, Math.round(Number(e.target.value) || 0)));
                if (v !== s.varietyWeeks) save({ varietyWeeks: v });
              }}
              style={{ maxWidth: 120 }}
            />
          </label>
        </section>

        <section className="card">
          <h2>📅 Show meals in Apple Calendar</h2>
          <p className="small" style={{ margin: 0 }}>
            Subscribe to this feed and planned meals appear in the Calendar app (read-only, refreshes about hourly).
            Works while your phone is on the home Wi-Fi.
          </p>
          <CopyField value={`webcal://${host}/calendar.ics`} />
          <ol className="howto small">
            <li>
              On iPhone: <b>Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar</b>.
            </li>
            <li>Paste the address above and tap Next, then Save.</li>
            <li>
              Or simply <a href={`webcal://${host}/calendar.ics`}>tap here on the iPhone</a> to subscribe.
            </li>
          </ol>
        </section>

        <section className="card">
          <h2>📝 Apple Notes shopping list</h2>
          <p className="small" style={{ margin: 0 }}>
            Web pages can’t write into Apple Notes directly, so an iOS Shortcut does it. Make it once on each iPhone:
          </p>
          <ol className="howto small">
            <li>
              In Notes, create (or open) the note you share with your partner, e.g. <b>Boodschappen</b>.
            </li>
            <li>
              Open <b>Shortcuts</b> → <b>+</b>. Name it <b>Meal Plan Shopping List</b>.
            </li>
            <li>
              Tap the info (ⓘ) button → turn on <b>Use with Share Sheet</b>, set input to <b>Text</b>, and set “If there’s no
              input” to <b>Continue</b>.
            </li>
            <li>
              Add action <b>If</b> → “Shortcut Input” <b>has any value</b>. Inside it, add <b>Set Variable</b> “List” to
              Shortcut Input. In <b>Otherwise</b>, add <b>Get Contents of URL</b> with the address below, then <b>Set Variable</b>{' '}
              “List” to its contents.
            </li>
            <li>
              After <b>End If</b>, add <b>Append to Note</b>: pick your shared note, and append the “List” variable.
            </li>
            <li>Tap “📝 Send to Notes” on the shopping page — or run the Shortcut from the home screen / Siri.</li>
          </ol>
          <p className="small muted" style={{ margin: 0 }}>
            Address for “Get Contents of URL” (always the next 7 days):
          </p>
          <CopyField value={`${origin}/api/shopping-list.txt`} />
          <p className="small muted" style={{ margin: 0 }}>
            Tip: each run adds the list to the bottom of the note. Clear the old list in the note first, or use “Create Note”
            in your shared folder instead to start a fresh note each week.
          </p>
        </section>

        <section className="card">
          <h2>📱 Put it on the home screen</h2>
          <p className="small" style={{ margin: 0 }}>
            In Safari on iPhone, open <b>{origin}</b>, tap Share → <b>Add to Home Screen</b>. It then opens full-screen like an app.
          </p>
        </section>
      </div>
    </div>
  );
}
