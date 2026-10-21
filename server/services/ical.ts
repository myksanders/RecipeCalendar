import type { MealEntry } from '../../shared/types';

// Minimal RFC 5545 feed. Times are "floating" (no time zone), which calendar
// apps show in the viewer's local time: right for a household in one place.

const SLOT_TIMES: Record<string, [string, string]> = {
  breakfast: ['080000', '083000'],
  lunch: ['123000', '131500'],
  dinner: ['180000', '190000'],
  other: ['150000', '153000'],
};

const KIND_EMOJI: Record<string, string> = {
  recipe: '🍽',
  leftovers: '♻️',
  dining_out: '🍷',
  fend: '🥡',
  note: '📝',
};

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets, without splitting UTF-8 characters. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curLen = 0;
  let limit = 75;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    if (curLen + len > limit) {
      out.push(cur);
      cur = '';
      curLen = 0;
      limit = 74; // continuation lines start with a space
    }
    cur += ch;
    curLen += len;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export interface IcalEntry extends MealEntry {
  ingredientsText?: string;
}

export function buildIcs(entries: IcalEntry[], opts: { baseUrl: string; calName?: string; now?: Date }): string {
  const stamp = (opts.now ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//meal-planner//family recipe calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.calName ?? 'Meal plan')}`,
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];
  for (const e of entries) {
    const d = e.date.replace(/-/g, '');
    const [start, end] = SLOT_TIMES[e.slot] ?? SLOT_TIMES.other;
    const url = `${opts.baseUrl}/#/calendar?entry=${e.id}`;
    const descParts = [];
    if (e.who) descParts.push(`For: ${e.who}`);
    if (e.notes) descParts.push(e.notes);
    if (e.ingredientsText) descParts.push(e.ingredientsText);
    descParts.push(url);
    lines.push(
      'BEGIN:VEVENT',
      `UID:entry-${e.id}@meal-planner`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${d}T${start}`,
      `DTEND:${d}T${end}`,
      `SUMMARY:${escapeText(`${KIND_EMOJI[e.kind] ?? ''} ${e.displayTitle}`.trim())}`,
      `DESCRIPTION:${escapeText(descParts.join('\n\n'))}`,
      `URL:${url}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
