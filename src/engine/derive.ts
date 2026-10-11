import { addDays, compareISO, diffDays } from './dates';
import type { ISODate } from './dates';
import { computeAllowance } from './allowance';
import type { AllowanceResult } from './allowance';
import { computeBalance, settingsHorizon, totalGoalRemaining, totalGoalSaved } from './balance';
import type { BalanceSnapshot } from './balance';
import { buildForecast } from './forecast';
import type { ForecastResult } from './forecast';
import { computeHealth } from './health';
import type { HealthResult } from './health';
import { assessRisk } from './risk';
import type { RiskAssessment } from './risk';
import type { AppData, CategoryId, Goal, Paise } from './types';
import { CATEGORIES } from './categories';
import { clamp } from './health';

/**
 * One pure function that turns raw state into every number the UI shows.
 * Components never call the sub-engines directly — they read this.
 */
export interface Derived {
  today: ISODate;
  horizonStart: ISODate;
  horizonEnd: ISODate;
  /** how many days are left to play, including today */
  remainingDays: number;
  dayNumber: number;
  balance: BalanceSnapshot;
  forecast: ForecastResult;
  cautious: ForecastResult;
  allowance: AllowanceResult;
  risk: RiskAssessment;
  health: HealthResult;
  spentByCategory: Record<CategoryId, Paise>;
  categoryRows: CategoryRow[];
  goals: GoalProgress[];
}

export interface CategoryRow {
  category: CategoryId;
  label: string;
  hue: number;
  essential: boolean;
  planned: Paise;
  spent: Paise;
  /** planned − spent, can go negative when over */
  remaining: Paise;
  percentUsed: number;
}

export interface GoalProgress {
  goal: Goal;
  saved: Paise;
  remaining: Paise;
  percent: number;
  daysLeft: number;
  /** per-day contribution needed from today to hit the deadline */
  requiredPerDay: Paise;
  /** per-day contribution implied by how the goal has been funded so far */
  currentRate: Paise;
  onTrack: boolean;
  funded: boolean;
  daysToFundAtCurrentRate: number;
  projectedDate: ISODate | null;
}

export function derive(data: AppData, today: ISODate): Derived {
  const { end: horizonEnd } = settingsHorizon(data.settings);
  const horizonStart = data.settings.startDate;
  const remainingDays = Math.max(0, diffDays(today, horizonEnd) + 1);

  const balance = computeBalance({
    items: data.items,
    openingBalance: data.settings.openingBalance,
    reserveTarget: data.settings.reserveTarget,
    goalSaved: totalGoalSaved(data.goals),
    goalRemaining: totalGoalRemaining(data.goals),
    today,
    horizonEnd,
  });

  const forecast = buildForecast({
    startDate: horizonStart,
    endDate: horizonEnd,
    today,
    openingBalance: balance.currentBalance,
    reserve: data.settings.reserveTarget,
    mode: 'base',
    items: data.items,
  });

  const cautious = buildForecast({
    startDate: horizonStart,
    endDate: horizonEnd,
    today,
    openingBalance: balance.currentBalance,
    reserve: data.settings.reserveTarget,
    mode: 'cautious',
    items: data.items,
  });

  const allowance = computeAllowance({
    balance,
    remainingDays,
    allowanceFloor: data.settings.allowanceFloor,
  });

  const spentByCategory = spendByCategory(data, today);
  const categoryRows = buildCategoryRows(data, spentByCategory);

  const risk = assessRisk({
    balance,
    forecast,
    allowance,
    goals: data.goals,
    budget: data.budget,
    spentByCategory,
    tuning: {
      allowanceFloor: data.settings.allowanceFloor,
      reserve: data.settings.reserveTarget,
    },
    today,
  });

  const health = computeHealth({
    balance,
    forecast,
    allowance,
    items: data.items,
    goals: data.goals,
    budget: data.budget,
    today,
  });

  return {
    today,
    horizonStart,
    horizonEnd,
    remainingDays,
    dayNumber: clamp(diffDays(horizonStart, today) + 1, 1, data.settings.durationDays),
    balance,
    forecast,
    cautious,
    allowance,
    risk,
    health,
    spentByCategory,
    categoryRows,
    goals: data.goals.map((goal) => goalProgress(goal, today)),
  };
}

function spendByCategory(data: AppData, today: ISODate): Record<CategoryId, Paise> {
  const out = {} as Record<CategoryId, Paise>;
  for (const c of CATEGORIES) out[c.id] = 0;
  for (const item of data.items) {
    if (item.status !== 'paid') continue;
    if (item.category === 'transfer') continue;
    if (item.kind !== 'expense') continue;
    if (compareISO(item.date, today) > 0) continue;
    out[item.category] += item.amount;
  }
  return out;
}

function buildCategoryRows(data: AppData, spent: Record<CategoryId, Paise>): CategoryRow[] {
  const planned = new Map<CategoryId, Paise>();
  for (const line of data.budget) planned.set(line.category, line.allocated);

  return CATEGORIES.filter((c) => c.id !== 'income').map((c) => {
    const plannedAmount = planned.get(c.id) ?? 0;
    const spentAmount = spent[c.id] ?? 0;
    return {
      category: c.id,
      label: c.label,
      hue: c.hue,
      essential: c.essential,
      planned: plannedAmount,
      spent: spentAmount,
      remaining: plannedAmount - spentAmount,
      percentUsed:
        plannedAmount > 0 ? clamp((spentAmount / plannedAmount) * 100, 0, 999) : spentAmount > 0 ? 100 : 0,
    };
  });
}

function goalProgress(goal: Goal, today: ISODate): GoalProgress {
  const remaining = Math.max(0, goal.target - goal.saved);
  const daysLeft = Math.max(0, diffDays(today, goal.deadline));
  const elapsed = Math.max(1, diffDays(goal.createdAt, today));
  const currentRate = Math.round(goal.saved / elapsed);
  const requiredPerDay = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
  const daysToFundAtCurrentRate =
    currentRate > 0 ? Math.ceil(remaining / currentRate) : Number.POSITIVE_INFINITY;
  const funded = remaining === 0;

  return {
    goal,
    saved: goal.saved,
    remaining,
    percent: goal.target > 0 ? clamp((goal.saved / goal.target) * 100, 0, 100) : 0,
    daysLeft,
    requiredPerDay,
    currentRate,
    onTrack: funded || requiredPerDay <= currentRate,
    funded,
    daysToFundAtCurrentRate,
    projectedDate:
      Number.isFinite(daysToFundAtCurrentRate) && daysToFundAtCurrentRate >= 0
        ? addDays(today, daysToFundAtCurrentRate)
        : null,
  };
}