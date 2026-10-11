import { addDays, todayISO } from '@/engine/dates';
import type { ISODate } from '@/engine/dates';
import { RUPEE } from '@/engine/money';
import type { AppData, BudgetLine, Goal, Item, Profile, Settings } from '@/engine/types';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  level: 'low' | 'moderate' | 'high' | 'critical';
  createdAt: string;
  read: boolean;
}

export const STORE_VERSION = 3;

export interface StoreState {
  version: number;
  /** the "current day" the whole app is computed against */
  today: ISODate;
  profile: Profile;
  settings: Settings;
  items: Item[];
  goals: Goal[];
  budget: BudgetLine[];
  notifications: AppNotification[];
  /** warning ids already surfaced, so we never notify twice */
  seenWarnings: string[];
  /** scenario commit ids already applied, so confirming twice is impossible */
  appliedCommits: string[];
  emergencyMode: boolean;
  lastSavedAt: string | null;
}

let idSeed = 0;
/** Collision-safe enough for a single-user local app. */
export function uid(prefix: string): string {
  idSeed += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeed.toString(36)}`;
}

export function defaultSettings(today: ISODate = todayISO()): Settings {
  return {
    openingBalance: RUPEE(10000),
    durationDays: 30,
    startDate: today,
    reserveTarget: RUPEE(1500),
    allowanceFloor: RUPEE(150),
    plannedIncome: RUPEE(10000),
    theme: 'dark',
    motion: true,
  };
}

export function emptyData(today: ISODate = todayISO()): AppData {
  return {
    profile: { name: '', city: '', onboarded: false, demo: false },
    settings: defaultSettings(today),
    items: [],
    goals: [],
    budget: [],
  };
}

/* ------------------------------------------------------------------ *
 * Demo seed — a believable month for a student in Pune living on     *
 * ₹10,000. Dates are generated relative to `today` so the demo never  *
 * goes stale.                                                            *
 * ------------------------------------------------------------------ */

function seedItem(partial: Partial<Item> & Pick<Item, 'title' | 'amount' | 'date'>): Item {
  return {
    id: partial.id ?? uid('item'),
    kind: partial.kind ?? 'expense',
    category: partial.category ?? 'food',
    status: partial.status ?? 'scheduled',
    recurring: partial.recurring ?? false,
    recurrence: partial.recurrence ?? null,
    essential: partial.essential ?? false,
    note: partial.note,
    createdAt: partial.createdAt ?? partial.date,
    ...partial,
  } as Item;
}

export function demoData(today: ISODate = todayISO()): AppData {
  const d = (offset: number) => addDays(today, offset);

  const items: Item[] = [
    // --- already in the past, already paid ---
    seedItem({
      title: 'Family transfer',
      amount: RUPEE(12000),
      kind: 'income',
      category: 'income',
      date: d(-26),
      status: 'paid',
    }),
    seedItem({
      title: 'Room share',
      amount: RUPEE(3500),
      category: 'rent',
      essential: true,
      date: d(-24),
      status: 'paid',
    }),
    seedItem({
      title: 'Monthly bus pass',
      amount: RUPEE(400),
      category: 'transport',
      essential: true,
      date: d(-22),
      status: 'paid',
    }),
    seedItem({
      title: 'Groceries — big shop',
      amount: RUPEE(1180),
      category: 'food',
      essential: true,
      date: d(-14),
      status: 'paid',
    }),
    seedItem({
      title: 'Movie night',
      amount: RUPEE(600),
      category: 'entertainment',
      date: d(-9),
      status: 'paid',
    }),
    seedItem({
      title: 'Recharge',
      amount: RUPEE(799),
      category: 'bills',
      essential: true,
      date: d(-6),
      status: 'paid',
    }),
    seedItem({
      title: 'Coffee run',
      amount: RUPEE(320),
      category: 'food',
      date: d(-3),
      status: 'paid',
    }),
    seedItem({
      title: 'Metro recharge',
      amount: RUPEE(300),
      category: 'transport',
      essential: true,
      date: d(-1),
      status: 'paid',
    }),

    // --- coming up ---
    seedItem({
      title: 'Rent due',
      amount: RUPEE(3500),
      category: 'rent',
      essential: true,
      date: d(4),
      recurring: true,
      recurrence: { type: 'monthly', startDate: d(4), interval: 1, endDate: null, cancelledFrom: null, paused: false },
    }),
    seedItem({
      title: 'Electricity bill',
      amount: RUPEE(1150),
      category: 'utilities',
      essential: true,
      date: d(6),
    }),
    seedItem({
      title: 'Streaming subscription',
      amount: RUPEE(649),
      category: 'bills',
      date: d(8),
      recurring: true,
      recurrence: { type: 'monthly', startDate: d(8), interval: 1, endDate: null, cancelledFrom: null, paused: false },
    }),
    seedItem({
      title: 'Weekend groceries',
      amount: RUPEE(900),
      category: 'food',
      essential: true,
      date: d(9),
    }),
    seedItem({
      title: 'Gym membership',
      amount: RUPEE(700),
      category: 'health',
      date: d(11),
      recurring: true,
      recurrence: { type: 'monthly', startDate: d(11), interval: 1, endDate: null, cancelledFrom: null, paused: false },
    }),
    seedItem({
      title: 'Course fee — half 2',
      amount: RUPEE(2500),
      category: 'education',
      date: d(13),
    }),
    seedItem({
      title: 'Phone plan',
      amount: RUPEE(499),
      category: 'bills',
      essential: true,
      date: d(15),
      recurring: true,
      recurrence: { type: 'monthly', startDate: d(15), interval: 1, endDate: null, cancelledFrom: null, paused: false },
    }),
    seedItem({
      title: 'Birthday outing',
      amount: RUPEE(1500),
      category: 'entertainment',
      date: d(18),
    }),
    seedItem({
      title: 'New headphones',
      amount: RUPEE(3200),
      category: 'shopping',
      date: d(22),
    }),
    seedItem({
      title: 'Medicine',
      amount: RUPEE(450),
      category: 'health',
      essential: true,
      date: d(25),
    }),
    // an already-overdue bill, so the risk engine has something real to say
    seedItem({
      title: 'Library fine',
      amount: RUPEE(120),
      category: 'education',
      date: d(-2),
    }),
  ];

  const goals: Goal[] = [
    {
      id: uid('goal'),
      title: 'Course + certificate',
      target: RUPEE(8000),
      saved: RUPEE(2500),
      deadline: addDays(today, 26),
      priority: 'high',
      createdAt: addDays(today, -18),
    },
    {
      id: uid('goal'),
      title: 'Emergency cushion',
      target: RUPEE(5000),
      saved: RUPEE(1200),
      deadline: addDays(today, 24),
      priority: 'high',
      createdAt: addDays(today, -18),
    },
    {
      id: uid('goal'),
      title: 'Trip to Goa',
      target: RUPEE(9000),
      saved: RUPEE(2000),
      deadline: addDays(today, 27),
      priority: 'low',
      createdAt: addDays(today, -9),
    },
  ];

  const budget: BudgetLine[] = [
    { category: 'food', allocated: RUPEE(2500) },
    { category: 'transport', allocated: RUPEE(700) },
    { category: 'rent', allocated: RUPEE(3500) },
    { category: 'utilities', allocated: RUPEE(1400) },
    { category: 'bills', allocated: RUPEE(1600) },
    { category: 'health', allocated: RUPEE(900) },
    { category: 'education', allocated: RUPEE(2500) },
    { category: 'entertainment', allocated: RUPEE(1200) },
    { category: 'shopping', allocated: RUPEE(800) },
  ];

  return {
    profile: { name: 'Aarav', city: 'Pune', onboarded: true, demo: true },
    settings: {
      openingBalance: RUPEE(10000),
      durationDays: 30,
      startDate: addDays(today, -6),
      reserveTarget: RUPEE(1500),
      allowanceFloor: RUPEE(150),
      plannedIncome: RUPEE(10000),
      theme: 'dark',
      motion: true,
    },
    items,
    goals,
    budget,
  };
}

export function initialState(today: ISODate = todayISO()): StoreState {
  const data = emptyData(today);
  return {
    version: STORE_VERSION,
    today,
    profile: data.profile,
    settings: data.settings,
    items: data.items,
    goals: data.goals,
    budget: data.budget,
    notifications: [],
    seenWarnings: [],
    appliedCommits: [],
    emergencyMode: false,
    lastSavedAt: null,
  };
}

/** Migrates an older persisted blob forward instead of throwing it away. */
export function migrate(persisted: unknown, today: ISODate): StoreState {
  const base = initialState(today);
  if (!persisted || typeof persisted !== 'object') return base;
  const state = { ...base, ...(persisted as Partial<StoreState>) };
  return {
    ...base,
    ...state,
    version: STORE_VERSION,
    today: state.today ?? today,
    settings: { ...base.settings, ...(state.settings ?? {}) },
    profile: { ...base.profile, ...(state.profile ?? {}) },
    items: Array.isArray(state.items) ? state.items : [],
    goals: Array.isArray(state.goals) ? state.goals : [],
    budget: Array.isArray(state.budget) ? state.budget : [],
    notifications: Array.isArray(state.notifications) ? state.notifications : [],
    seenWarnings: Array.isArray(state.seenWarnings) ? state.seenWarnings : [],
    appliedCommits: Array.isArray(state.appliedCommits) ? state.appliedCommits : [],
  };
}