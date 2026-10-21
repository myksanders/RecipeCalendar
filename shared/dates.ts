// Dates are plain local "YYYY-MM-DD" strings everywhere; no time zones involved.

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function today(): string {
  return toISODate(new Date());
}

export type WeekStart = 0 | 1; // 0 = Sunday, 1 = Monday

/** First day of the week containing the date; weeks start on Monday unless weekStart is 0 (Sunday). */
export function startOfWeek(s: string, weekStart: WeekStart = 1): string {
  const d = parseISODate(s);
  const offset = (d.getDay() - weekStart + 7) % 7;
  return addDays(s, -offset);
}

export function isValidISODate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISODate(s).getTime());
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);
}
