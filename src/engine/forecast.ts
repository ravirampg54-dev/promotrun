import type { ISODate } from './dates';
import { compareISO, diffDays, eachDay } from './dates';
import type { Paise } from './money';
import { projectOccurrences } from './schedule';
import type { DayPoint, FlowKind, Item, Occurrence } from './types';

export type ForecastMode = 'base' | 'cautious' | 'scenario';

/**
 * Cautious mode: what happens if you stop every *discretionary* line and only
 * pay what is already committed? It is the floor of the plan, not a wish.
 */
export interface ForecastAssumptions {
  /** day 1 of the plan */
  startDate: ISODate;
  /** last day of the plan */
  endDate: ISODate;
  /** the user's "today" */
  today: ISODate;
  openingBalance: Paise;
  reserve: Paise;
  mode: ForecastMode;
  /** cautious drops non-essential spend; scenario adds the draft actions */
}

export interface ForecastInput extends ForecastAssumptions {
  items: readonly Item[];
}

export interface ForecastResult {
  days: DayPoint[];
  /** day number of the first day where the closing balance goes negative */
  firstShortfallDate: ISODate | null;
  firstShortfallDay: number | null;
  shortfallDays: number;
  minClosing: Paise;
  minClosingDate: ISODate;
  maxClosing: Paise;
  endClosing: Paise;
  todayClosing: Paise;
  totalIncome: Paise;
  totalExpense: Paise;
  netChange: Paise;
  /** days that close below the reserve even though they stay positive */
  daysBelowReserve: number;
  remainingDays: number;
  runwayDays: number;
}

export function buildForecast(input: ForecastInput): ForecastResult {
  const { today, endDate, startDate, openingBalance, reserve, mode } = input;

  const windowStart = compareISO(today, startDate) < 0 ? startDate : today;
  const horizonEnd = compareISO(today, endDate) > 0 ? today : endDate;

  const items = mode === 'cautious' ? itemsEssentialOnly(input.items) : input.items;

  const occurrences = projectOccurrences(items, windowStart, horizonEnd);

  const days: DayPoint[] = [];
  // If today is before the plan starts, the account still holds the opening balance.
  let running = openingBalance;
  const dateList = eachDay(windowStart, horizonEnd);

  for (let index = 0; index < dateList.length; index += 1) {
    const date = dateList[index];
    const dayItems = occurrences.get(date) ?? [];
    const income = sumKind(dayItems, 'income');
    const expense = sumKind(dayItems, 'expense');
    const opening = running;
    const closing = opening + income - expense;
    const isToday = date === today;

    days.push({
      date,
      day: diffDays(startDate, date) + 1,
      opening,
      income,
      expense,
      closing,
      isToday,
      isPast: compareISO(date, today) < 0,
      shortfall: closing < 0,
      overdue: dayItems.some((i) => i.overdue),
      items: dayItems,
    });

    running = closing;
  }

  const totalIncome = sum(days.map((d) => d.income));
  const totalExpense = sum(days.map((d) => d.expense));

  const closings = days.map((d) => d.closing);
  const minClosing = closings.length ? Math.min(...closings) : openingBalance;
  const maxClosing = closings.length ? Math.max(...closings) : openingBalance;
  const minClosingDate =
    days.find((d) => d.closing === minClosing)?.date ?? windowStart;
  const endClosing = closings.length ? closings[closings.length - 1] : openingBalance;
  const todayClosing = days.find((d) => d.isToday)?.closing ?? endClosing;

  const shortfallDays = days.filter((d) => d.shortfall).length;
  const firstShortfall = days.find((d) => d.shortfall) ?? null;
  const daysBelowReserve = days.filter((d) => d.closing < reserve && !d.shortfall).length;

  // runway: how long until the money actually runs out, 0 if it never does
  let runwayDays = 0;
  for (const day of days) {
    if (day.shortfall) {
      runwayDays = day.day - 1;
      break;
    }
  }
  if (runwayDays === 0 && !shortfallDays) runwayDays = days.length;

  return {
    days,
    firstShortfallDate: firstShortfall?.date ?? null,
    firstShortfallDay: firstShortfall?.day ?? null,
    shortfallDays,
    minClosing,
    minClosingDate,
    maxClosing,
    endClosing,
    todayClosing,
    totalIncome,
    totalExpense,
    netChange: totalIncome - totalExpense,
    daysBelowReserve,
    remainingDays: days.length,
    runwayDays,
  };
}

function itemsEssentialOnly(items: readonly Item[]): Item[] {
  return items.filter((item) => {
    if (item.category === 'transfer') return false;
    if (item.kind === 'income') return true;
    return Boolean(item.essential);
  });
}

function sumKind(items: readonly Occurrence[], kind: FlowKind): Paise {
  let total = 0;
  for (const item of items) if (item.kind === kind) total += item.amount;
  return total;
}

function sum(values: number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Compare two forecasts and describe, in plain words, what changed.
 * Used by the simulator's before/after panel.
 */
export interface ForecastDelta {
  endClosingBefore: Paise;
  endClosingAfter: Paise;
  endClosingChange: Paise;
  minClosingBefore: Paise;
  minClosingAfter: Paise;
  minClosingChange: Paise;
  shortfallBefore: number;
  shortfallAfter: number;
  shortfallChange: number;
  incomeChange: Paise;
  expenseChange: Paise;
  better: boolean;
}

export function diffForecasts(before: ForecastResult, after: ForecastResult): ForecastDelta {
  const endClosingChange = after.endClosing - before.endClosing;
  const minClosingChange = after.minClosing - before.minClosing;
  const shortfallChange = after.shortfallDays - before.shortfallDays;
  const better =
    endClosingChange > 0 ? true : endClosingChange < 0 ? false : shortfallChange < 0;
  return {
    endClosingBefore: before.endClosing,
    endClosingAfter: after.endClosing,
    endClosingChange,
    minClosingBefore: before.minClosing,
    minClosingAfter: after.minClosing,
    minClosingChange,
    shortfallBefore: before.shortfallDays,
    shortfallAfter: after.shortfallDays,
    shortfallChange,
    incomeChange: after.totalIncome - before.totalIncome,
    expenseChange: after.totalExpense - before.totalExpense,
    better,
  };
}

/** Cheap sanity helper used across the UI. */
export function isShortfall(closing: Paise): boolean {
  return closing < 0;
}