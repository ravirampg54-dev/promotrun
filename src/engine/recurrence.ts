import type { ISODate } from './dates';
import { addDays, addMonthsClamped, compareISO, diffDays } from './dates';

/**
 * Occurrence generation. A recurring item produces the list of calendar days it
 * will hit cash flow on, honouring:
 *   - `once`      → a single day
 *   - `weekly`    → every N weeks from the start (default 1)
 *   - `monthly`   → same day-of-month, clamped to short months
 *   - `endDate`   → nothing after it
 *   - `cancelledFrom` → nothing on or after it (cancel stops the *future* only)
 *   - `paused`    → nothing at all until unpaused
 */
export type RecurrenceType = 'once' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  type: RecurrenceType;
  startDate: ISODate;
  endDate?: ISODate | null;
  cancelledFrom?: ISODate | null;
  paused?: boolean;
  interval?: number;
}

const MAX_OCCURRENCES = 400;

export function occurrencesBetween(
  rule: RecurrenceRule | null | undefined,
  from: ISODate,
  to: ISODate,
): ISODate[] {
  if (!rule || rule.paused) return [];
  if (diffDays(from, to) < 0) return [];

  const start = rule.startDate;
  const end = rule.endDate ? rule.endDate : null;
  // cancel/pause boundary: the last day the item is still alive
  const stop = rule.cancelledFrom ? rule.cancelledFrom : null;

  const hardFrom = from > start ? from : start;
  const bounds = [to, end, stop ? addDays(stop, -1) : null].filter(Boolean) as ISODate[];
  const hardTo = bounds.reduce((acc, b) => (compareISO(b, acc) < 0 ? b : acc), to);
  if (compareISO(hardFrom, hardTo) > 0) return [];

  if (rule.type === 'once') {
    return compareISO(start, hardFrom) >= 0 && compareISO(start, hardTo) <= 0 ? [start] : [];
  }

  const interval = Math.max(1, Math.round(rule.interval ?? 1));
  const out: ISODate[] = [];

  if (rule.type === 'weekly') {
    // first occurrence on or after hardFrom, keeping the weekday of the start
    const weeksBehind = Math.floor(diffDays(start, hardFrom) / 7 / interval);
    let cursor = addDays(start, weeksBehind * interval * 7);
    while (compareISO(cursor, hardFrom) < 0) cursor = addDays(cursor, interval * 7);
    while (compareISO(cursor, hardTo) <= 0 && out.length < MAX_OCCURRENCES) {
      out.push(cursor);
      cursor = addDays(cursor, interval * 7);
    }
    return out;
  }

  // monthly
  let cursor = start;
  let guard = 0;
  while (compareISO(cursor, hardTo) <= 0 && guard < MAX_OCCURRENCES) {
    if (compareISO(cursor, hardFrom) >= 0) out.push(cursor);
    cursor = addMonthsClamped(cursor, interval);
    guard += 1;
  }
  return out;
}

/** Convenience: how many times will this fire inside the window? */
export function occurrenceCount(
  rule: RecurrenceRule | null | undefined,
  from: ISODate,
  to: ISODate,
): number {
  return occurrencesBetween(rule, from, to).length;
}

/** Next fire date strictly after `after`, or null when the item is finished. */
export function nextOccurrence(
  rule: RecurrenceRule | null | undefined,
  after: ISODate,
): ISODate | null {
  const window = 400;
  const until = addDays(after, window);
  const dates = occurrencesBetween(rule, addDays(after, 1), until);
  return dates.length > 0 ? dates[0] : null;
}

export function describeRecurrence(rule: RecurrenceRule | null | undefined): string {
  if (!rule || rule.type === 'once') return 'One time';
  const n = Math.max(1, Math.round(rule.interval ?? 1));
  if (rule.type === 'weekly') {
    return n === 1 ? 'Every week' : `Every ${n} weeks`;
  }
  return n === 1 ? 'Every month' : `Every ${n} months`;
}

/** Progress label for a subscription: "3rd of 6 paid" style context lives in the UI. */
export function isRecurringType(type: RecurrenceType | undefined): boolean {
  return type === 'weekly' || type === 'monthly';
}