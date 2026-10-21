import { useDroppable } from '@dnd-kit/core';
import { useRef } from 'react';
import { parseISODate } from '../../../shared/dates';
import { visibleSlots, type MealEntry, type Slot } from '../../../shared/types';
import { dowShort, fmtDay, KIND_INFO, Photo, SLOT_LABEL } from '../ui';
import { MealCard } from './MealCard';


function DayTile({
  date,
  entries,
  today,
  selected,
  placing,
  onTap,
}: {
  date: string;
  entries: MealEntry[];
  today: string;
  selected: boolean;
  placing: boolean;
  onTap: (date: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${date}`, data: { date } });
  const cls = [
    'day-tile',
    selected && 'selected',
    isOver && 'over',
    placing && 'placing',
    date === today && 'today',
    date < today && 'past',
  ]
    .filter(Boolean)
    .join(' ');
  const shown = entries.slice(0, 3);
  return (
    <button
      ref={setNodeRef}
      className={cls}
      onClick={() => onTap(date)}
      aria-pressed={selected}
      aria-label={`${fmtDay(date)}, ${entries.length} ${entries.length === 1 ? 'meal' : 'meals'}${placing ? ', place here' : ''}`}
    >
      <span className="dow">{dowShort(date)}</span>
      <span className="num">{parseISODate(date).getDate()}</span>
      <span className="thumbs" aria-hidden>
        {shown.map((e) =>
          e.kind === 'recipe' || (e.kind === 'leftovers' && e.photo) ? (
            <Photo key={e.id} src={e.photo} seed={e.displayTitle.replace('Leftovers: ', '')} className="thumb" />
          ) : (
            <span key={e.id} className="thumb emoji">
              {KIND_INFO[e.kind].emoji}
            </span>
          ),
        )}
        {entries.length > shown.length && <span className="more">+{entries.length - shown.length}</span>}
      </span>
    </button>
  );
}

export function SplitView({
  days,
  byDay,
  today,
  selected,
  slots: enabledSlots,
  placing,
  onTileTap,
  onAdd,
  onOpen,
  onSwipe,
}: {
  days: string[];
  byDay: Map<string, MealEntry[]>;
  today: string;
  selected: string;
  slots: Slot[];
  placing: boolean;
  onTileTap: (date: string) => void;
  onAdd: (date: string, slot: Slot) => void;
  onOpen: (e: MealEntry) => void;
  onSwipe: (dir: -1 | 1) => void;
}) {
  const entries = byDay.get(selected) ?? [];
  const slots = visibleSlots(enabledSlots, entries.map((e) => e.slot));
  const touch = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className="split">
      <div className="split-strip">
        {days.map((d) => (
          <DayTile
            key={d}
            date={d}
            entries={byDay.get(d) ?? []}
            today={today}
            selected={d === selected}
            placing={placing}
            onTap={onTileTap}
          />
        ))}
      </div>

      <section
        className="day-pane"
        aria-label={fmtDay(selected)}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
        }}
      >
        <div className="day-pane-head">
          <h2>
            {fmtDay(selected)}
            {selected === today && <span className="chip good">Today</span>}
          </h2>
          <span className="muted small">
            {entries.length === 0 ? 'Nothing planned yet' : `${entries.length} ${entries.length === 1 ? 'meal' : 'meals'}`}
          </span>
        </div>

        {slots.map((slot) => {
          const list = entries.filter((e) => e.slot === slot);
          return (
            <div key={slot} className={`slot-section ${list.length ? '' : 'empty'}`}>
              <div className="slot-head">
                <h3>{SLOT_LABEL[slot]}</h3>
                <button className={`btn small ${placing ? 'primary' : 'ghost'}`} onClick={() => onAdd(selected, slot)}>
                  {placing ? `⤵ Place at ${SLOT_LABEL[slot].toLowerCase()}` : `+ Add ${SLOT_LABEL[slot].toLowerCase()}`}
                </button>
              </div>
              {list.length > 0 && (
                <div className="big-cards">
                  {list.map((e) => (
                    <MealCard key={e.id} e={e} big onOpen={onOpen} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
