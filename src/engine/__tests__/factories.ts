import type {
  AppData,
  CategoryId,
  Goal,
  Item,
  Recurrence,
  Settings,
} from '../types';

/** Deterministic base state for engine tests — no Date.now() anywhere. */
export const TODAY = '2025-03-10';
export const START = '2025-03-01'; // day 1
export const END = '2025-03-30'; // day 30

let counter = 0;
export function resetIds(): void {
  counter = 0;
}

export function makeItem(partial: Partial<Item> & Pick<Item, 'amount' | 'date'>): Item {
  counter += 1;
  return {
    id: partial.id ?? `item-${counter}`,
    title: partial.title ?? 'Test item',
    kind: partial.kind ?? 'expense',
    category: partial.category ?? ('entertainment' as CategoryId),
    status: partial.status ?? 'scheduled',
    recurring: partial.recurring ?? false,
    recurrence: partial.recurrence ?? null,
    essential: partial.essential ?? false,
    note: partial.note,
    createdAt: partial.createdAt ?? START,
    ...partial,
  } as Item;
}

export function makeRecurrence(partial: Partial<Recurrence> & Pick<Recurrence, 'type' | 'startDate'>): Recurrence {
  return {
    endDate: null,
    cancelledFrom: null,
    paused: false,
    interval: 1,
    ...partial,
  };
}

export function makeGoal(partial: Partial<Goal> & Pick<Goal, 'target'>): Goal {
  counter += 1;
  return {
    id: partial.id ?? `goal-${counter}`,
    title: partial.title ?? 'New headphones',
    saved: partial.saved ?? 0,
    deadline: partial.deadline ?? END,
    priority: partial.priority ?? 'medium',
    createdAt: partial.createdAt ?? START,
    ...partial,
  } as Goal;
}

export function makeSettings(partial: Partial<Settings> = {}): Settings {
  return {
    openingBalance: 0,
    durationDays: 30,
    startDate: START,
    reserveTarget: 0,
    allowanceFloor: 10000, // ₹100
    plannedIncome: 0,
    theme: 'dark',
    motion: true,
    ...partial,
  };
}

export function makeData(partial: Partial<AppData> = {}): AppData {
  return {
    profile: { name: 'Tester', city: 'Pune', onboarded: true, demo: false },
    settings: makeSettings(),
    items: [],
    goals: [],
    budget: [],
    ...partial,
  };
}

/** A typical month: ₹10,000 opening, rent, groceries, one weekly subscription. */
export function demoLikeData(): AppData {
  return makeData({
    settings: makeSettings({ openingBalance: 1_000_000, reserveTarget: 150_000 }),
    items: [
      makeItem({
        title: 'Salary',
        amount: 600_000,
        kind: 'income',
        category: 'income',
        date: '2025-03-01',
        status: 'paid',
      }),
      makeItem({
        title: 'Rent share',
        amount: 300_000,
        category: 'rent',
        essential: true,
        date: '2025-03-05',
        status: 'paid',
      }),
      makeItem({
        title: 'Phone plan',
        amount: 49_900,
        category: 'bills',
        essential: true,
        recurring: true,
        recurrence: makeRecurrence({ type: 'monthly', startDate: '2025-03-12' }),
        date: '2025-03-12',
      }),
    ],
  });
}