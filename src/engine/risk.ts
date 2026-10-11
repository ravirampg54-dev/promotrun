import type { ISODate } from './dates';
import { compareISO, diffDays, formatDayLabel } from './dates';
import { formatINR } from './money';
import type { Paise } from './money';
import type { AllowanceResult } from './allowance';
import type { BalanceSnapshot } from './balance';
import type { ForecastResult } from './forecast';
import type { BudgetLine, CategoryId, Goal } from './types';
import { categoryLabel } from './categories';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface RiskTuning {
  /** allowance below this is Moderate */
  allowanceFloor: Paise;
  /** reserve target from settings */
  reserve: Paise;
  /** how many days of runway we consider comfortable (for goal warnings) */
  comfortableRunwayDays?: number;
}

/**
 * Every warning answers four questions, in this order:
 *   what changed · why it matters · which calculation fired · what to do next
 */
export interface RiskWarning {
  /** stable id — notifications dedupe on this */
  id: string;
  level: RiskLevel;
  title: string;
  whatChanged: string;
  whyItMatters: string;
  calculation: string;
  nextStep: string;
}

export interface RiskInput {
  balance: BalanceSnapshot;
  forecast: ForecastResult;
  allowance: AllowanceResult;
  goals: readonly Goal[];
  budget: readonly BudgetLine[];
  spentByCategory: Readonly<Partial<Record<CategoryId, Paise>>>;
  tuning: RiskTuning;
  today: ISODate;
  /** optional "before" snapshot so warnings can say what this decision changed */
  baseline?: { forecast: ForecastResult; allowance: AllowanceResult };
}

export interface RiskAssessment {
  level: RiskLevel;
  /** 0–100, higher is safer. Used for the ring on the health screen. */
  score: number;
  headline: string;
  warnings: RiskWarning[];
  /** the warning that decides the level */
  driver: RiskWarning | null;
}

const LEVEL_SCORE: Record<RiskLevel, number> = {
  low: 100,
  moderate: 70,
  high: 38,
  critical: 12,
};

export function assessRisk(input: RiskInput): RiskAssessment {
  const { balance, forecast, allowance, tuning, goals, budget, spentByCategory, today } = input;
  const warnings: RiskWarning[] = [];

  /* ---------------------------- Critical ---------------------------- */
  if (forecast.shortfallDays > 0) {
    warnings.push(
      shortfallWarning({
        forecast,
        tuning,
        today,
        baseline: input.baseline,
      }),
    );
  }

  /* ------------------------------ High ------------------------------ */
  const reserveShortfall = forecast.minClosing < tuning.reserve;
  if (reserveShortfall && forecast.shortfallDays === 0) {
    warnings.push(reserveWarning({ forecast, tuning, baseline: input.baseline }));
  }

  if (balance.overdueAmount > 0) {
    warnings.push(overdueWarning(balance.overdueAmount, today));
  }

  /* ---------------------------- Moderate ---------------------------- */
  if (allowance.isBelowFloor) {
    warnings.push(allowanceWarning(allowance, tuning));
  }

  const lateGoals = goalsOverdue(goals, today);
  for (const goal of lateGoals) {
    warnings.push(goalWarning(goal, today, tuning));
  }

  const overspent = overspentLines(budget, spentByCategory);
  for (const line of overspent) {
    warnings.push(overspendWarning(line, spentByCategory[line.category] ?? 0));
  }

  /* ------------------------------ Level ----------------------------- */
  const level = pickLevel(warnings);
  const driver =
    warnings.find((w) => w.level === level) ?? warnings[0] ?? null;

  return {
    level,
    score: LEVEL_SCORE[level],
    headline: HEADLINES[level],
    warnings,
    driver,
  };
}

const HEADLINES: Record<RiskLevel, string> = {
  low: 'Your plan holds up. Normal spending keeps you positive.',
  moderate: 'Your plan works, but the margin is thin.',
  high: 'Your plan dips below your safety net.',
  critical: 'Your plan runs out of money before day 30.',
};

function pickLevel(warnings: RiskWarning[]): RiskLevel {
  if (warnings.some((w) => w.level === 'critical')) return 'critical';
  if (warnings.some((w) => w.level === 'high')) return 'high';
  if (warnings.some((w) => w.level === 'moderate')) return 'moderate';
  return 'low';
}

function shortfallWarning(args: {
  forecast: ForecastResult;
  tuning: RiskTuning;
  today: ISODate;
  baseline?: { forecast: ForecastResult; allowance: AllowanceResult };
}): RiskWarning {
  const { forecast, baseline } = args;
  const first = forecast.firstShortfallDate;
  const day = forecast.firstShortfallDay ?? 0;
  const beforeDate = baseline?.forecast.firstShortfallDate ?? null;
  const whatChanged = baseline
    ? beforeDate === null
      ? `The plan used to hold all ${forecast.remainingDays} remaining days; it now goes below zero on day ${day} (${formatDayLabel(first!)}).`
      : beforeDate !== first
        ? `The shortfall moved from ${formatDayLabel(beforeDate)} to ${formatDayLabel(first!)} — ${Math.abs(
            diffDays(beforeDate, first!),
          )} day(s) later.`
        : `The shortfall still lands on day ${day}; it now runs ${formatINR(
            Math.abs(forecast.minClosing - baseline.forecast.minClosing),
          )} ${forecast.minClosing < baseline.forecast.minClosing ? 'deeper' : 'shallower'}.`
    : `The projected balance drops below zero on day ${day} (${formatDayLabel(first!)}) and stays short on ${forecast.shortfallDays} day${forecast.shortfallDays === 1 ? '' : 's'}.`;
  const deepest = forecast.minClosing;
  return {
    id: 'risk:shortfall',
    level: 'critical',
    title: 'Projected balance goes negative',
    whatChanged,
    whyItMatters:
      'Once the closing balance is negative, the next essential bill has no money behind it. This is the point where a small cut turns into a cascade.',
    calculation: `lowest projected closing = ${formatINR(deepest)} (${formatDayLabel(forecast.minClosingDate)}) · income ${formatINR(
      forecast.totalIncome,
    )} − committed spend ${formatINR(forecast.totalExpense)}`,
    nextStep: `Open the simulator and cut ${formatINR(
      Math.abs(deepest),
    )} of non-essential spend, or move a recurring bill — the comparison table will show the day you stop going negative.`,
  };
}

function reserveWarning(args: {
  forecast: ForecastResult;
  tuning: RiskTuning;
  baseline?: { forecast: ForecastResult; allowance: AllowanceResult };
}): RiskWarning {
  const { forecast, tuning, baseline } = args;
  const gap = tuning.reserve - forecast.minClosing;
  const before = baseline?.forecast.minClosing;
  return {
    id: 'risk:reserve',
    level: 'high',
    title: 'Balance drops into your emergency reserve',
    whatChanged: before
      ? `The lowest projected balance moved from ${formatINR(before)} to ${formatINR(
          forecast.minClosing,
        )}.`
      : `The lowest projected balance is ${formatINR(forecast.minClosing)} on ${formatDayLabel(
          forecast.minClosingDate,
        )}, which is ${formatINR(gap)} below your ${formatINR(tuning.reserve)} reserve.`,
    whyItMatters:
      'The reserve is the money that absorbs surprise costs — a medical bill, a broken phone, one extra train fare. Touching it turns a plan into a reaction.',
    calculation: `min closing ${formatINR(forecast.minClosing)} < reserve ${formatINR(tuning.reserve)} · gap ${formatINR(
      gap,
    )}`,
    nextStep: `Raise today's allowance-free buffer by ${formatINR(
      gap,
    )} — try pausing the smallest recurring item in Bills and compare the forecasts.`,
  };
}

function allowanceWarning(allowance: AllowanceResult, tuning: RiskTuning): RiskWarning {
  const gap = tuning.allowanceFloor - allowance.daily;
  return {
    id: 'risk:allowance',
    level: 'moderate',
    title: 'Safe-to-spend is below your comfort line',
    whatChanged: `Your safe daily allowance is ${formatINR(allowance.daily)}, under the ${formatINR(
      tuning.allowanceFloor,
    )} line you set.`,
    whyItMatters:
      'Below this line, one unplanned day pushes the rest of the month into the red. The number is not wrong — it just means less room for surprises.',
    calculation: `${allowance.formula} = ${formatINR(allowance.daily)} (short by ${formatINR(gap)})`,
    nextStep:
      'Lower the floor in Settings if you accept thinner margins, or move a one-off expense into the simulator to see what restores it.',
  };
}

function overdueWarning(amount: Paise, today: ISODate): RiskWarning {
  return {
    id: 'risk:overdue',
    level: 'high',
    title: 'Something already passed its due date',
    whatChanged: `${formatINR(amount)} of unpaid bills were due before ${formatDayLabel(today)}.`,
    whyItMatters:
      'Late fees and penalties usually land on the next day they hit, so the forecast already moved this money to today — the plan is honest about it.',
    calculation: `overdue occurrences moved to today = ${formatINR(amount)}`,
    nextStep: 'Open Bills, mark the unpaid ones as paid or reschedule them to a date you can actually hit.',
  };
}

function goalWarning(
  goal: Goal,
  today: ISODate,
  tuning: RiskTuning,
): RiskWarning {
  const remaining = Math.max(0, goal.target - goal.saved);
  const daysLeft = Math.max(0, diffDays(today, goal.deadline));
  const perDay = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
  return {
    id: `goal:${goal.id}:overdue`,
    level: 'moderate',
    title: `${goal.title} missed its deadline`,
    whatChanged: `The deadline passed ${Math.abs(diffDays(goal.deadline, today))} day(s) ago with ${formatINR(
      remaining,
    )} still to go.`,
    whyItMatters:
      'A goal that keeps slipping quietly stops being a plan. Naming the date forces a decision: fund it, resize it, or let it go.',
    calculation: `${formatINR(goal.saved)} of ${formatINR(goal.target)} saved · ${formatINR(
      perDay,
    )}/day for the next ${daysLeft} day(s) to catch up`,
    nextStep:
      tuning.comfortableRunwayDays && daysLeft < 3
        ? 'Reschedule the deadline from the Goals screen — the delay is calculated from your real contribution rate, not a fixed guess.'
        : 'Reschedule or resize the goal from the Goals screen.',
  };
}

function overspendWarning(
  line: BudgetLine,
  spent: Paise,
): RiskWarning {
  const over = spent - line.allocated;
  return {
    id: `budget:${line.category}:overspent`,
    level: 'moderate',
    title: `${categoryLabel(line.category)} is over plan`,
    whatChanged: `You have spent ${formatINR(spent)} against a ${formatINR(line.allocated)} plan.`,
    whyItMatters:
      'The budget is how the plan stays honest. Overruns here are the same money that is missing from your allowance.',
    calculation: `spent ${formatINR(spent)} − planned ${formatINR(line.allocated)} = ${formatINR(over)} over`,
    nextStep: 'Move the overrun into the Budget Planner and re-split the month, or trim the category to what is actually left.',
  };
}

function goalsOverdue(goals: readonly Goal[], today: ISODate): Goal[] {
  return goals.filter((g) => g.saved < g.target && compareISO(g.deadline, today) < 0);
}

function overspentLines(
  budget: readonly BudgetLine[],
  spent: Readonly<Partial<Record<CategoryId, Paise>>>,
): BudgetLine[] {
  return budget.filter((line) => line.allocated > 0 && (spent[line.category] ?? 0) > line.allocated);
}

export const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  critical: 3,
  high: 2,
  moderate: 1,
  low: 0,
};

export function isWorse(a: RiskLevel, b: RiskLevel): boolean {
  return RISK_LEVEL_ORDER[a] > RISK_LEVEL_ORDER[b];
}