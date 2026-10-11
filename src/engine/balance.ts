import type { ISODate } from './dates';
import { addDays, diffDays } from './dates';
import type { Paise } from './money';
import { clampPaise } from './money';
import { projectOccurrences, sumOccurrences } from './schedule';
import type { Item, Settings } from './types';

/**
 * Balance: what you actually hold right now, and how much of it is spoken for.
 *
 * currentBalance = opening + income received − expenses paid
 *   (savings transfers are excluded — they move cash between pockets)
 *
 * protectedFunds = reserve target + unpaid essential commitments
 * goalSavings    = money already moved into savings goals (unreachable)
 */
export interface ProtectedSlice {
  id: string;
  label: string;
  amount: Paise;
  detail: string;
}

export interface BalanceSnapshot {
  opening: Paise;
  incomeReceived: Paise;
  expensesPaid: Paise;
  transfers: Paise;
  /** opening + received − paid */
  currentBalance: Paise;
  reserve: Paise;
  goalSaved: Paise;
  goalRemaining: Paise;
  /** essentials still to be paid inside the horizon */
  unpaidEssential: Paise;
  overdueAmount: Paise;
  /** reserve + unpaid essentials */
  protectedFunds: Paise;
  /** protectedFunds + savings already set aside */
  protectedTotal: Paise;
  /** what is genuinely spendable, never below zero */
  availableCash: Paise;
  breakdown: ProtectedSlice[];
  futureIncome: Paise;
  futureDiscretionary: Paise;
  /** currentBalance + futureIncome − futureDiscretionary */
  projectedBalance: Paise;
  remainingDays: number;
}

export interface BalanceInput {
  items: readonly Item[];
  openingBalance: Paise;
  reserveTarget: Paise;
  goalSaved: Paise;
  goalRemaining: Paise;
  today: ISODate;
  horizonEnd: ISODate;
}

export function computeBalance(input: BalanceInput): BalanceSnapshot {
  const { items, today, horizonEnd } = input;
  const remainingDays = Math.max(0, diffDays(today, horizonEnd) + 1);

  let incomeReceived = 0;
  let expensesPaid = 0;
  let transfers = 0;

  for (const item of items) {
    if (item.category === 'transfer') {
      if (item.status === 'paid') transfers += item.amount;
      continue;
    }
    if (item.status !== 'paid') continue;
    if (item.kind === 'income') incomeReceived += item.amount;
    else expensesPaid += item.amount;
  }

  const currentBalance = input.openingBalance + incomeReceived - expensesPaid;
  const reserve = clampPaise(input.reserveTarget);

  const future = projectOccurrences(items, today, horizonEnd);
  const unpaidEssential = sumOccurrences(
    future,
    (occ) => occ.kind === 'expense' && occ.essential,
  );
  const overdueAmount = sumOccurrences(future, (occ) => occ.overdue);
  const futureIncome = sumOccurrences(future, (occ) => occ.kind === 'income');
  const futureDiscretionary = sumOccurrences(
    future,
    (occ) => occ.kind === 'expense' && !occ.essential,
  );

  const projectedBalance = currentBalance + futureIncome - futureDiscretionary;
  const protectedFunds = reserve + unpaidEssential;
  const goalSaved = clampPaise(input.goalSaved);
  const protectedTotal = protectedFunds + goalSaved;
  const availableCash = clampPaise(currentBalance - protectedTotal);

  return {
    opening: input.openingBalance,
    incomeReceived,
    expensesPaid,
    transfers,
    currentBalance,
    reserve,
    goalSaved,
    goalRemaining: clampPaise(input.goalRemaining),
    unpaidEssential,
    overdueAmount,
    protectedFunds,
    protectedTotal,
    availableCash,
    futureIncome,
    futureDiscretionary,
    projectedBalance,
    remainingDays,
    breakdown: buildBreakdown({
      reserve,
      unpaidEssential,
      goalSaved,
      overdueAmount,
    }),
  };
}

function buildBreakdown(input: {
  reserve: Paise;
  unpaidEssential: Paise;
  goalSaved: Paise;
  overdueAmount: Paise;
}): ProtectedSlice[] {
  const slices: ProtectedSlice[] = [];
  if (input.reserve > 0) {
    slices.push({
      id: 'reserve',
      label: 'Emergency reserve',
      amount: input.reserve,
      detail: 'Set aside so one bad day cannot become a crisis.',
    });
  }
  if (input.unpaidEssential > 0) {
    slices.push({
      id: 'essentials',
      label: 'Essential commitments',
      amount: input.unpaidEssential,
      detail:
        input.overdueAmount > 0
          ? `Includes ${input.overdueAmount} paise already overdue.`
          : 'Rent, bills and essentials still to be paid.',
    });
  }
  if (input.goalSaved > 0) {
    slices.push({
      id: 'goals',
      label: 'Savings goals',
      amount: input.goalSaved,
      detail: 'Already moved aside — not available for day-to-day spending.',
    });
  }
  return slices;
}

/** Sum of what each goal still needs to reach its target. */
export function totalGoalRemaining(goals: readonly { target: Paise; saved: Paise }[]): Paise {
  return goals.reduce((acc, g) => acc + Math.max(0, g.target - g.saved), 0);
}

export function totalGoalSaved(goals: readonly { saved: Paise }[]): Paise {
  return goals.reduce((acc, g) => acc + Math.max(0, g.saved), 0);
}

/** Last calendar day of the run: startDate + durationDays − 1. */
export function settingsHorizon(settings: Pick<Settings, 'startDate' | 'durationDays'>): {
  end: ISODate;
} {
  return { end: addDays(settings.startDate, Math.max(0, settings.durationDays) - 1) };
}