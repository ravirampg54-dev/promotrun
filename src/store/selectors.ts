import { useEffect, useMemo } from 'react';
import { useStore, computeDerived } from './store';
import type { Derived } from '@/engine/derive';
import type { AppData, CategoryId, Goal, Item } from '@/engine/types';
import type { ISODate } from '@/engine/dates';
import { compareISO } from '@/engine/dates';
import { describeRecurrence, nextOccurrence } from '@/engine/recurrence';
import { goalDelayEstimate } from '@/engine/scenarios';
import type { RiskLevel } from '@/engine/risk';

export type { Derived };

/** The single hook every screen uses for money. Recomputed when inputs change. */
export function useDerived(): Derived {
  const today = useStore((s) => s.today);
  const items = useStore((s) => s.items);
  const goals = useStore((s) => s.goals);
  const settings = useStore((s) => s.settings);
  const budget = useStore((s) => s.budget);

  return useMemo(
    () => computeDerived({ today, items, goals, settings, budget }),
    [today, items, goals, settings, budget],
  );
}

/** Mirrors engine warnings into the in-app inbox, exactly once per warning id. */
export function useNotificationSync(derived: Derived): void {
  const sync = useStore((s) => s.syncNotifications);
  const warnings = derived.risk.warnings;
  useEffect(() => {
    sync(derived.risk);
  }, [sync, warnings]);
}

export function useAppData(): AppData {
  const items = useStore((s) => s.items);
  const goals = useStore((s) => s.goals);
  const settings = useStore((s) => s.settings);
  const budget = useStore((s) => s.budget);
  const profile = useStore((s) => s.profile);
  return useMemo(
    () => ({ items, goals, settings, budget, profile }),
    [items, goals, settings, budget, profile],
  );
}

/* ---------------------------- item selectors ---------------------------- */

export type ItemSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export interface ItemFilter {
  query: string;
  kind: 'all' | 'income' | 'expense';
  status: 'all' | 'paid' | 'scheduled';
  categories: CategoryId[];
}

export const EMPTY_FILTER: ItemFilter = {
  query: '',
  kind: 'all',
  status: 'all',
  categories: [],
};

export function filterItems(items: readonly Item[], filter: ItemFilter): Item[] {
  const q = filter.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter.kind !== 'all' && item.kind !== filter.kind) return false;
    if (filter.status !== 'all' && item.status !== filter.status) return false;
    if (filter.categories.length > 0 && !filter.categories.includes(item.category)) return false;
    if (q && !`${item.title} ${item.note ?? ''} ${item.category}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function sortItems(items: readonly Item[], sort: ItemSort): Item[] {
  const out = [...items];
  out.sort((a, b) => {
    switch (sort) {
      case 'date-asc':
        return compareISO(a.date, b.date);
      case 'amount-desc':
        return b.amount - a.amount;
      case 'amount-asc':
        return a.amount - b.amount;
      case 'date-desc':
      default:
        return compareISO(b.date, a.date);
    }
  });
  return out;
}

/** Duplicate guard: same title + amount + date + category is the same entry. */
export function findDuplicate(items: readonly Item[], candidate: Partial<Item>): Item | null {
  return (
    items.find(
      (item) =>
        item.id !== candidate.id &&
        item.title.trim().toLowerCase() === String(candidate.title ?? '').trim().toLowerCase() &&
        item.amount === candidate.amount &&
        item.date === candidate.date &&
        item.category === candidate.category,
    ) ?? null
  );
}

export interface BillRow {
  item: Item;
  label: string;
  cadence: string;
  nextDate: ISODate | null;
  status: 'active' | 'paused' | 'cancelled' | 'paid';
  annualCost: number;
}

export function billRows(items: readonly Item[], today: ISODate): BillRow[] {
  return items
    .filter((item) => item.kind === 'expense' && (item.recurring || item.category === 'bills'))
    .map((item) => {
      const rule = item.recurrence;
      const cancelled = Boolean(rule?.cancelledFrom);
      const paused = Boolean(rule?.paused);
      const status: BillRow['status'] =
        item.status === 'paid' && !item.recurring ? 'paid' : cancelled ? 'cancelled' : paused ? 'paused' : 'active';
      const perYear =
        rule?.type === 'weekly'
          ? (item.amount * 52) / (rule.interval ?? 1)
          : rule?.type === 'monthly'
            ? item.amount * (12 / (rule.interval ?? 1))
            : 0;
      return {
        item,
        cadence: describeRecurrence(rule),
        label: rule?.type === 'once' ? 'One-off' : (describeRecurrence(rule) ?? ''),
        nextDate: status === 'cancelled' ? null : nextOccurrence(rule, today),
        status,
        annualCost: Math.round(perYear),
      };
    })
    .sort((a, b) => (a.nextDate ?? '9999').localeCompare(b.nextDate ?? '9999'));
}

export function goalDelay(goal: Goal, today: ISODate) {
  return goalDelayEstimate(goal, today);
}

export function unreadCount(notifications: readonly { read: boolean }[]): number {
  return notifications.filter((n) => !n.read).length;
}

export function levelClasses(level: RiskLevel): {
  text: string;
  bg: string;
  border: string;
  dot: string;
  ring: string;
} {
  switch (level) {
    case 'critical':
      return {
        text: 'text-status-red',
        bg: 'bg-status-red/12',
        border: 'border-status-red/30',
        dot: 'bg-status-red',
        ring: 'stroke-status-red',
      };
    case 'high':
      return {
        text: 'text-status-amber',
        bg: 'bg-status-amber/12',
        border: 'border-status-amber/30',
        dot: 'bg-status-amber',
        ring: 'stroke-status-amber',
      };
    case 'moderate':
      return {
        text: 'text-status-sky',
        bg: 'bg-status-sky/12',
        border: 'border-status-sky/30',
        dot: 'bg-status-sky',
        ring: 'stroke-status-sky',
      };
    case 'low':
    default:
      return {
        text: 'text-status-lime',
        bg: 'bg-status-lime/12',
        border: 'border-status-lime/30',
        dot: 'bg-status-lime',
        ring: 'stroke-status-lime',
      };
  }
}