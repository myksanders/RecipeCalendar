import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, parseISODate, startOfWeek, today as todayFn, toISODate } from '../../../shared/dates';
import { visibleSlots, type EntryInput, type MealEntry, type RecipeSummary, type Settings, type Slot } from '../../../shared/types';
import { api, cachedSettings } from '../api';
import { AddMealDialog } from '../components/AddMealDialog';
import { MealCard, MealCardView } from '../components/MealCard';
import { MealDetail } from '../components/MealDetail';
import { RecipeBook } from '../components/RecipeBook';
import { SplitView } from '../components/SplitView';
import { dowShort, fmtDay, fmtRange, Modal, monthName, navigate, Photo, useToast } from '../ui';

// "split": a strip of day tiles with the selected day's meals below (agenda style).
type View = 'week' | 'month' | 'split';

function loadView(): View {
  try {
    const v = localStorage.getItem('calendar.view');
    return v === 'month' || v === 'split' ? v : 'week';
  } catch {
    return 'week';
  }
}

function DayCell({
  date,
  entries,
  today,
  month,
  placing,
  compact,
  showSlots,
  onAdd,
  onOpen,
}: {
  date: string;
  entries: MealEntry[];
  today: string;
  month?: number;
  placing: boolean;
  compact?: boolean;
  showSlots: boolean;
  onAdd: (date: string) => void;
  onOpen: (e: MealEntry) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${date}`, data: { date } });
  const d = parseISODate(date);
  const cls = [
    'day',
    isOver && 'over',
    date === today && 'today',
    date < today && 'past',
    month !== undefined && d.getMonth() !== month && 'other-month',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={setNodeRef} className={cls} onClick={() => placing && onAdd(date)}>
      <div className="day-head">
        {!compact && <span className="dow">{dowShort(date)}</span>}
        <span className="num">{d.getDate()}</span>
      </div>
      <div className="day-body">
        {entries.map((e) => (
          <MealCard key={e.id} e={e} compact={compact} showSlot={showSlots || e.slot !== 'dinner'} onOpen={onOpen} />
        ))}
        <button
          className={`add-btn ${placing ? 'placing' : ''}`}
          onClick={(ev) => {
            ev.stopPropagation();
            onAdd(date);
          }}
          aria-label={`Add meal on ${fmtDay(date)}`}
        >
          {placing ? '⤵ Place here' : '+ Add'}
        </button>
      </div>
    </div>
  );
}

export function CalendarPage({ openEntryId }: { openEntryId: number | null }) {
  const today = todayFn();
  const [view, setView] = useState<View>(loadView);
  const [anchor, setAnchor] = useState(today);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [settings, setSettings] = useState<Settings>(cachedSettings);
  const [openId, setOpenId] = useState<number | null>(openEntryId);
  const [addFor, setAddFor] = useState<{ date: string; slot?: Slot } | null>(null);
  const [placing, setPlacing] = useState<RecipeSummary | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [dragging, setDragging] = useState<{ recipe?: RecipeSummary; entry?: MealEntry } | null>(null);
  const toast = useToast();

  useEffect(() => setOpenId(openEntryId), [openEntryId]);
  useEffect(() => {
    try {
      localStorage.setItem('calendar.view', view);
    } catch {
      // private mode
    }
  }, [view]);

  const weekStart = settings.weekStart;
  // Only label cards "Dinner" etc. when the household plans more than one meal a day.
  const showSlots = visibleSlots(settings.mealSlots).length > 1;
  const { from, to, days } = useMemo(() => {
    if (view !== 'month') {
      const from = startOfWeek(anchor, weekStart);
      const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
      return { from, to: days[6], days };
    }
    const a = parseISODate(anchor);
    const first = toISODate(new Date(a.getFullYear(), a.getMonth(), 1, 12));
    const last = toISODate(new Date(a.getFullYear(), a.getMonth() + 1, 0, 12));
    const from = startOfWeek(first, weekStart);
    const days: string[] = [];
    for (let d = from; d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
    return { from, to: days[days.length - 1], days };
  }, [view, anchor, weekStart]);

  const refresh = useCallback(() => {
    api.entries(from, to).then(setEntries).catch(() => {});
    api.recipes().then(setRecipes).catch(() => {});
  }, [from, to]);

  useEffect(refresh, [refresh]);
  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
  }, []);

  // Keep both phones in sync while planning together.
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    const t = setInterval(onVis, 30000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      clearInterval(t);
    };
  }, [refresh]);

  const byDay = useMemo(() => {
    const m = new Map<string, MealEntry[]>();
    for (const e of entries) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [entries]);

  async function addEntry(input: EntryInput, recipe?: RecipeSummary) {
    let warning = '';
    if (input.kind === 'recipe' && input.recipeId && settings.varietyWeeks > 0) {
      const v = await api.variety(input.recipeId, input.date).catch(() => null);
      if (v && v.dates.length) {
        warning = `Heads up: ${recipe?.title ?? 'this'} is also on ${v.dates.map(fmtDay).join(', ')} (within ${v.weeks} weeks).`;
      }
    }
    try {
      const created = await api.createEntry(input);
      refresh();
      const undo = {
        label: 'Undo',
        run: async () => {
          await api.deleteEntry(created.id);
          refresh();
        },
      };
      if (warning) toast({ text: warning, tone: 'warn', action: undo });
      else toast({ text: `Added ${created.displayTitle} to ${fmtDay(created.date)}`, action: undo });
    } catch (e: any) {
      toast({ text: e.message, tone: 'warn' });
    }
  }

  async function moveEntry(e: MealEntry, date: string) {
    if (e.date === date) return;
    setEntries((es) => es.map((x) => (x.id === e.id ? { ...x, date } : x)));
    try {
      await api.updateEntry(e.id, { date });
      if (e.kind === 'recipe' && e.recipeId && settings.varietyWeeks > 0) {
        const v = await api.variety(e.recipeId, date, e.id).catch(() => null);
        if (v?.dates.length)
          toast({ text: `Heads up: ${e.displayTitle} is also on ${v.dates.map(fmtDay).join(', ')}.`, tone: 'warn' });
      }
    } catch (err: any) {
      toast({ text: err.message, tone: 'warn' });
    }
    refresh();
  }

  function onDayAdd(date: string, slot?: Slot) {
    if (placing) {
      addEntry({ date, kind: 'recipe', recipeId: placing.id, slot: slot ?? 'dinner' }, placing);
      setPlacing(null);
    } else setAddFor({ date, slot });
  }

  // Split view: the selected day is the anchor, so the strip always shows its week.
  function onTileTap(date: string) {
    if (placing) onDayAdd(date);
    else setAnchor(date);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );

  function onDragStart(ev: DragStartEvent) {
    setDragging(ev.active.data.current as any);
  }
  function onDragEnd(ev: DragEndEvent) {
    setDragging(null);
    const date = ev.over?.data.current?.date as string | undefined;
    if (!date) return;
    const data = ev.active.data.current as { recipe?: RecipeSummary; entry?: MealEntry };
    if (data.recipe) addEntry({ date, kind: 'recipe', recipeId: data.recipe.id, slot: 'dinner' }, data.recipe);
    else if (data.entry) moveEntry(data.entry, date);
  }

  function step(dir: number) {
    if (view !== 'month') setAnchor(addDays(anchor, dir * 7));
    else {
      const a = parseISODate(anchor);
      setAnchor(toISODate(new Date(a.getFullYear(), a.getMonth() + dir, 1, 12)));
    }
  }

  function selectFromBook(r: RecipeSummary) {
    setPlacing((p) => (p?.id === r.id ? null : r));
    setBookOpen(false);
  }

  const closeDetail = useCallback(() => {
    setOpenId(null);
    if (window.location.hash.includes('entry=')) navigate('/calendar');
  }, []);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="cal-layout">
        <RecipeBook recipes={recipes} today={today} selectedId={placing?.id ?? null} onSelect={selectFromBook} />
        <div className="cal-main">
          <div className="cal-toolbar">
            <h1>{view === 'month' ? monthName(anchor) : fmtRange(from, to)}</h1>
            <div className="btn-row">
              <button className="btn icon" onClick={() => step(-1)} aria-label="Previous">
                ‹
              </button>
              <button className="btn" onClick={() => setAnchor(today)}>
                Today
              </button>
              <button className="btn icon" onClick={() => step(1)} aria-label="Next">
                ›
              </button>
            </div>
            <div className="seg" role="tablist">
              <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>
                Week
              </button>
              <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>
                Month
              </button>
              <button className={view === 'split' ? 'on' : ''} onClick={() => setView('split')}>
                Split
              </button>
            </div>
          </div>

          {placing && (
            <div className="placing-banner">
              <span>Tap a day to add “{placing.title}”</span>
              <button className="btn small" onClick={() => setPlacing(null)}>
                Cancel
              </button>
            </div>
          )}

          {view === 'split' ? (
            <SplitView
              days={days}
              byDay={byDay}
              today={today}
              selected={anchor}
              slots={settings.mealSlots}
              placing={!!placing}
              onTileTap={onTileTap}
              onAdd={onDayAdd}
              onOpen={(e) => setOpenId(e.id)}
              onSwipe={(dir) => setAnchor(addDays(anchor, dir))}
            />
          ) : view === 'week' ? (
            <div className="week-grid">
              {days.map((d) => (
                <DayCell
                  key={d}
                  date={d}
                  entries={byDay.get(d) ?? []}
                  today={today}
                  placing={!!placing}
                  showSlots={showSlots}
                  onAdd={onDayAdd}
                  onOpen={(e) => setOpenId(e.id)}
                />
              ))}
            </div>
          ) : (
            <div className="month-grid">
              {days.slice(0, 7).map(dowShort).map((d) => (
                <div key={d} className="dow-head">
                  {d}
                </div>
              ))}
              {days.map((d) => (
                <DayCell
                  key={d}
                  date={d}
                  entries={byDay.get(d) ?? []}
                  today={today}
                  month={parseISODate(anchor).getMonth()}
                  placing={!!placing}
                  showSlots={showSlots}
                  compact
                  onAdd={onDayAdd}
                  onOpen={(e) => setOpenId(e.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <button className="btn primary fab book-fab" onClick={() => setBookOpen(true)}>
        📖 Recipe book
      </button>

      {bookOpen && (
        <Modal onClose={() => setBookOpen(false)} narrow label="Recipe book">
          <div className="modal-head">
            <h2>Pick a recipe, then tap a day</h2>
            <button className="btn ghost icon" onClick={() => setBookOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="modal-body" style={{ display: 'grid', gap: 6 }}>
            {[...recipes]
              .sort((a, b) => (a.lastPlanned ?? '0000').localeCompare(b.lastPlanned ?? '0000'))
              .map((r) => (
                <button key={r.id} className="book-item" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => selectFromBook(r)}>
                  <Photo src={r.photo} seed={r.title} />
                  <div className="t">{r.title}</div>
                </button>
              ))}
            <a className="btn" href="#/recipes/new?return=calendar">
              + New recipe
            </a>
          </div>
        </Modal>
      )}

      <DragOverlay dropAnimation={null}>
        {dragging?.recipe && (
          <div className="book-item drag-overlay">
            <Photo src={dragging.recipe.photo} seed={dragging.recipe.title} />
            <div className="t">{dragging.recipe.title}</div>
          </div>
        )}
        {dragging?.entry && (
          <div className={`meal drag-overlay kind-${dragging.entry.kind}`}>
            <MealCardView e={dragging.entry} compact={view === 'month'} />
          </div>
        )}
      </DragOverlay>

      {addFor && (
        <AddMealDialog
          date={addFor.date}
          initialSlot={addFor.slot}
          slots={settings.mealSlots}
          today={today}
          recipes={recipes}
          people={settings.people}
          onClose={() => setAddFor(null)}
          onAdd={addEntry}
        />
      )}
      {openId && <MealDetail entryId={openId} people={settings.people} slots={settings.mealSlots} onClose={closeDetail} onChanged={refresh} />}
    </DndContext>
  );
}
