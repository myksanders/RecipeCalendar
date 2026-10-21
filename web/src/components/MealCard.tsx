import { useDraggable } from '@dnd-kit/core';
import type { MealEntry } from '../../../shared/types';
import { KIND_INFO, Photo, SLOT_LABEL } from '../ui';

export function MealCardView({ e, compact, showSlot = true }: { e: MealEntry; compact?: boolean; showSlot?: boolean }) {
  const info = KIND_INFO[e.kind];
  const hasPhoto = e.kind === 'recipe' || (e.kind === 'leftovers' && e.photo);
  return (
    <>
      {hasPhoto && !compact && <Photo src={e.photo} seed={e.displayTitle.replace('Leftovers: ', '')} />}
      <div className="meal-body">
        {showSlot && !compact && <div className="slot-label">{SLOT_LABEL[e.slot]}</div>}
        <div className="meal-title">
          {e.kind !== 'recipe' && <span aria-hidden>{info.emoji} </span>}
          {e.displayTitle}
        </div>
        {!compact && (e.who || e.ingredientCount > 0) && (
          <div className="meal-meta">
            {e.who && <span className="chip">{e.who}</span>}
            {e.ingredientCount > 0 && (
              <span className="chip" title="Ingredients already in the house">
                {e.checkedCount}/{e.ingredientCount} in house
              </span>
            )}
          </div>
        )}
        {!compact && e.ingredientCount > 0 && (
          <div className="progress" aria-hidden>
            <div style={{ width: `${(100 * e.checkedCount) / e.ingredientCount}%` }} />
          </div>
        )}
      </div>
    </>
  );
}

export function MealCard({
  e,
  compact,
  big,
  showSlot = true,
  onOpen,
}: {
  e: MealEntry;
  compact?: boolean;
  big?: boolean;
  showSlot?: boolean;
  onOpen: (e: MealEntry) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `entry-${e.id}`, data: { entry: e } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      aria-label={`${e.displayTitle}, ${SLOT_LABEL[e.slot]}`}
      className={`meal kind-${e.kind} ${compact ? 'compact' : ''} ${big ? 'big' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={(ev) => {
        ev.stopPropagation();
        onOpen(e);
      }}
      onKeyDown={(k) => k.key === 'Enter' && onOpen(e)}
    >
      <MealCardView e={e} compact={compact} showSlot={showSlot && !big} />
    </div>
  );
}
