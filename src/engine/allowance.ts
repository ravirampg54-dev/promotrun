import type { Paise } from './money';
import { clampPaise } from './money';
import type { BalanceSnapshot } from './balance';

/**
 * The one number the hero card shows.
 *
 *   safeDailyAllowance = max(0, (projectedBalance − goalSavings − protectedFunds) / remainingDays)
 *
 * projectedBalance already nets out future income and future discretionary
 * spend; protectedFunds holds back the reserve and every unpaid essential;
 * goalSavings is money already committed to a goal. Whatever survives those
 * three deductions is what can be spread across the days that are left.
 */
export interface AllowanceInput {
  balance: BalanceSnapshot;
  remainingDays: number;
  /** tunes when we start nudging — see RiskSettings.allowanceFloor */
  allowanceFloor?: Paise;
}

export interface AllowanceResult {
  /** rupees per day you can spend without hurting the plan */
  daily: Paise;
  /** money genuinely free to spend across the whole remaining horizon */
  discretionaryPool: Paise;
  remainingDays: number;
  /** daily / allowanceFloor, for the "below your comfort line" warning */
  ratioToFloor: number;
  isBelowFloor: boolean;
  /** nothing left to spend — the whole remaining balance is spoken for */
  fullyCommitted: boolean;
  formula: string;
}

export function computeAllowance(input: AllowanceInput): AllowanceResult {
  const { balance, remainingDays } = input;
  const floor = input.allowanceFloor ?? 0;

  const pool = Math.max(
    0,
    balance.projectedBalance - balance.goalSaved - balance.protectedFunds,
  );
  const days = Math.max(1, remainingDays);
  const daily = clampPaise(Math.floor(pool / days));
  const ratioToFloor = floor > 0 ? daily / floor : 0;

  return {
    daily,
    discretionaryPool: pool,
    remainingDays,
    ratioToFloor,
    isBelowFloor: floor > 0 && daily < floor,
    fullyCommitted: pool === 0 && balance.protectedTotal > 0,
    formula: `(${balance.projectedBalance} − ${balance.goalSaved} − ${balance.protectedFunds}) ÷ ${days} days`,
  };
}

/** Convenience used by list rows: does this spend fit inside today's allowance? */
export function fitsAllowance(allowance: Paise, amount: Paise): boolean {
  return amount <= allowance;
}

/** What is left of today's allowance after a hypothetical spend. */
export function allowanceAfterSpend(allowance: Paise, amount: Paise): Paise {
  return clampPaise(allowance - amount);
}