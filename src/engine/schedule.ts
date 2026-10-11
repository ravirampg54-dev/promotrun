import type { ISODate } from './dates';
import { addDays, compareISO, diffDays } from './dates';
import type { Item, Occurrence } from './types';
import { occurrencesBetween } from './recurrence';

/**
 * Turns the item ledger into dated cash-flow occurrences for a window.
 *
 * Rules that matter for correctness:
 *  - a one-off item that is already `paid` produces nothing (it is in the
 *    balance already);
 *  - a *recurring* item that is paid produces its **future** occurrences only —
 *    paying this month does not cancel next month;
 *  - a `transfer` to a savings goal is never an expense;
 *  - an unpaid one-off item whose date has passed is pulled forward to the start
 *    of the window and flagged `overdue` (you still owe that money).
 */
export function projectOccurrences(
  items: readonly Item[],
  from: ISODate,
  to: ISODate,
): Map<ISODate, Occurrence[]> {
  const map = new Map<ISODate, Occurrence[]>();
  if (diffDays(from, to) < 0) return map;

  const push = (occ: Occurrence) => {
    const list = map.get(occ.date);
    if (list) list.push(occ);
    else map.set(occ.date, [occ]);
  };

  for (const item of items) {
    // savings transfers move money between pockets, it never leaves
    if (item.category === 'transfer') continue;
    if (item.kind === 'expense' && item.amount <= 0) continue;
    if (item.kind === 'income' && item.amount <= 0) continue;

    const paid = item.status === 'paid';

    if (!item.recurring) {
      if (paid) continue;
      if (compareISO(item.date, from) < 0) {
        // overdue: the money is still leaving the account, just today
        push(occurrence(item, from, true));
      } else if (compareISO(item.date, to) <= 0) {
        push(occurrence(item, item.date, false));
      }
      continue;
    }

    const rule = item.recurrence ?? { type: 'once' as const, startDate: item.date };
    const windowStart = paid ? addDays(item.date, 1) : from;
    const start = compareISO(windowStart, from) < 0 ? from : windowStart;
    const dates = occurrencesBetween(rule, start, to);
    for (const date of dates) push(occurrence(item, date, false));
  }

  return map;
}

function occurrence(item: Item, date: ISODate, overdue: boolean): Occurrence {
  return {
    itemId: item.id,
    title: item.title,
    amount: item.amount,
    kind: item.kind,
    category: item.category,
    date,
    essential: Boolean(item.essential),
    overdue,
  };
}

/** Flatten a date-keyed occurrence map into a sorted list. */
export function flattenOccurrences(map: Map<ISODate, Occurrence[]>): Occurrence[] {
  const dates = [...map.keys()].sort();
  const out: Occurrence[] = [];
  for (const date of dates) out.push(...(map.get(date) ?? []));
  return out;
}

/** Sum of occurrence amounts in the window, optionally filtered. */
export function sumOccurrences(
  map: Map<ISODate, Occurrence[]>,
  filter: (occ: Occurrence) => boolean = () => true,
): number {
  let total = 0;
  for (const list of map.values()) {
    for (const occ of list) if (filter(occ)) total += occ.amount;
  }
  return total;
}