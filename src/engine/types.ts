import type { ISODate } from './dates';
import type { Paise } from './money';
import type { RecurrenceType } from './recurrence';

/* ------------------------------------------------------------------ *
 * Domain types. The engine only ever reads these; the store owns them. *
 * ------------------------------------------------------------------ */

export type { Paise };
export type { RecurrenceType };

export type FlowKind = 'income' | 'expense';
export type ItemStatus = 'scheduled' | 'paid';

export type CategoryId =
  | 'food'
  | 'transport'
  | 'rent'
  | 'utilities'
  | 'bills'
  | 'health'
  | 'education'
  | 'entertainment'
  | 'shopping'
  | 'emergency'
  | 'income'
  | 'transfer';

export interface Category {
  id: CategoryId;
  label: string;
  /** true when the category is treated as an essential commitment */
  essential: boolean;
  /** income categories never appear in the expense breakdown */
  flow: FlowKind;
  hue: number;
}

export interface Recurrence {
  type: RecurrenceType;
  /** first occurrence */
  startDate: ISODate;
  /** last allowed occurrence (inclusive), optional */
  endDate?: ISODate | null;
  /** occurrences on/after this date stop happening (cancel) */
  cancelledFrom?: ISODate | null;
  /** true when paused right now (both past and future occurrences stop) */
  paused?: boolean;
  interval?: number;
}

/**
 * A cash-flow item. One row can be a one-off expense, an income credit, or an
 * active recurring bill/subscription. Recurring projections come from
 * `recurrence`; the current occurrence is always `date`.
 */
export interface Item {
  id: string;
  title: string;
  amount: Paise;
  kind: FlowKind;
  category: CategoryId;
  date: ISODate;
  status: ItemStatus;
  recurring: boolean;
  recurrence?: Recurrence | null;
  /** essentials are the ones we refuse to let the user casually overspend */
  essential?: boolean;
  note?: string;
  createdAt: ISODate;
}

export interface Goal {
  id: string;
  title: string;
  target: Paise;
  saved: Paise;
  deadline: ISODate;
  priority: 'low' | 'medium' | 'high';
  createdAt: ISODate;
}

export interface BudgetLine {
  category: CategoryId;
  /** planned spend for the whole horizon, in paise */
  allocated: Paise;
}

export interface Settings {
  /** cash on hand when the plan started */
  openingBalance: Paise;
  /** how many days the survival run lasts (default 30) */
  durationDays: number;
  /** day 1 of the plan */
  startDate: ISODate;
  /** money we refuse to spend, for any reason */
  reserveTarget: Paise;
  /** allowance below this triggers a Moderate risk */
  allowanceFloor: Paise;
  /** recommendations flip at < 100% of planned income */
  plannedIncome: Paise;
  theme: 'dark' | 'light';
  motion: boolean;
}

export interface Profile {
  name: string;
  city: string;
  onboarded: boolean;
  demo: boolean;
}

export interface AppData {
  profile: Profile;
  settings: Settings;
  items: Item[];
  goals: Goal[];
  budget: BudgetLine[];
}

/* --------------------------- derived shapes --------------------------- */

export interface Occurrence {
  itemId: string;
  title: string;
  amount: Paise;
  kind: FlowKind;
  category: CategoryId;
  date: ISODate;
  essential: boolean;
  overdue: boolean;
}

export interface DayPoint {
  /** calendar day of the plan, day 1 = startDate */
  day: number;
  date: ISODate;
  /** balance at the start of this day */
  opening: Paise;
  income: Paise;
  expense: Paise;
  /** opening + income − expense — the balance carried into tomorrow */
  closing: Paise;
  isToday: boolean;
  isPast: boolean;
  /** the day closes below zero */
  shortfall: boolean;
  /** contains an item whose due date already passed */
  overdue: boolean;
  items: Occurrence[];
}