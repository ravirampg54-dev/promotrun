import { formatINR, ratioPaise } from './money';
import type { Paise } from './money';
import type { BalanceSnapshot } from './balance';
import type { ForecastResult } from './forecast';
import type { AllowanceResult } from './allowance';
import type { RiskLevel } from './risk';
import type { BudgetLine, CategoryId, Goal, Item } from './types';

/**
 * An educational estimate of how sturdy your month looks — not a credit score.
 * Five components, each normalised to 0–1, then weighted.
 *
 *   essentials coverage   25
 *   cash flow             25
 *   reserve               20
 *   budget adherence      15
 *   savings               15
 */
export interface HealthWeights {
  essentials: number;
  cashFlow: number;
  reserve: number;
  budget: number;
  savings: number;
}

export const DEFAULT_WEIGHTS: HealthWeights = {
  essentials: 25,
  cashFlow: 25,
  reserve: 20,
  budget: 15,
  savings: 15,
};

export interface HealthComponent {
  id: keyof HealthWeights;
  label: string;
  /** 0–100 */
  score: number;
  weight: number;
  /** plain-language explanation of the measure behind the number */
  explanation: string;
}

export interface HealthInput {
  balance: BalanceSnapshot;
  forecast: ForecastResult;
  allowance: AllowanceResult;
  items: readonly Item[];
  goals: readonly Goal[];
  budget: readonly BudgetLine[];
  today: string;
  /** days of average spend we consider a healthy reserve buffer */
  reserveWeeks?: number;
  weights?: HealthWeights;
}

export interface HealthResult {
  total: number;
  band: 'Fragile' | 'Tight' | 'Steady' | 'Strong';
  components: HealthComponent[];
  /** risk colour ring, borrowed from the risk engine so the two never disagree */
  tone: RiskLevel;
  disclaimer: string;
}

export function computeHealth(input: HealthInput): HealthResult {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const reserveWeeks = input.reserveWeeks ?? 1;
  const { balance, forecast } = input;

  /* ------------------------- essentials coverage ------------------------- */
  // "can I cover everything already committed, reserve included?"
  const essentialsNeeded = balance.unpaidEssential + balance.reserve;
  const essentialsScore = clamp01(
    essentialsNeeded <= 0 ? 1 : ratioPaise(balance.currentBalance, essentialsNeeded),
  );

  /* ------------------------------ cash flow ------------------------------ */
  // how much of the horizon keeps the balance at or above zero, weighted by depth
  const positiveDays = forecast.days.filter((d) => !d.shortfall).length;
  const coverageRatio = forecast.remainingDays > 0 ? positiveDays / forecast.remainingDays : 1;
  const depth = balance.currentBalance > 0 ? clamp01(ratioPaise(forecast.minClosing, balance.currentBalance)) : 0;
  const cashFlowScore = clamp01(coverageRatio * 0.6 + depth * 0.4);

  /* ------------------------------- reserve ------------------------------- */
  // target = `reserveWeeks` of the plan's own average daily spend
  const avgDailySpend =
    forecast.remainingDays > 0 ? Math.floor(forecast.totalExpense / forecast.remainingDays) : 0;
  const recommendedReserve = Math.max(balance.reserve, avgDailySpend * 7 * reserveWeeks);
  const reserveScore = clamp01(ratioPaise(balance.reserve, recommendedReserve));

  /* -------------------------- budget adherence --------------------------- */
  const allocated = input.budget.reduce((acc, l) => acc + l.allocated, 0);
  const spent = totalSpendByCategory(input.items);
  const overspent = input.budget.reduce((acc, l) => {
    const s = spent[l.category] ?? 0;
    return acc + (s > l.allocated ? s - l.allocated : 0);
  }, 0);
  const adherence = allocated <= 0 ? 0.75 : clamp01(1 - ratioPaise(overspent, allocated));
  const budgetScore = adherence;

  /* ------------------------------- savings ------------------------------- */
  const goalProgress = input.goals.length
    ? input.goals.reduce((acc, g) => acc + clamp01(ratioPaise(g.saved, g.target)), 0) /
      input.goals.length
    : 0;
  const surplusRatio = forecast.totalIncome > 0 ? clamp01(forecast.netChange / forecast.totalIncome) : 0;
  const savingsScore = clamp01(goalProgress * 0.6 + surplusRatio * 0.4);

  const components: HealthComponent[] = [
    {
      id: 'essentials',
      label: 'Essentials coverage',
      score: Math.round(essentialsScore * 100),
      weight: weights.essentials,
      explanation:
        essentialsNeeded <= 0
          ? 'Nothing essential is outstanding.'
          : `You hold ${formatINR(balance.currentBalance)} against ${formatINR(
              essentialsNeeded,
            )} of essentials plus reserve.`,
    },
    {
      id: 'cashFlow',
      label: 'Cash flow',
      score: Math.round(cashFlowScore * 100),
      weight: weights.cashFlow,
      explanation: `${positiveDays} of ${forecast.remainingDays} days close above zero; the lowest point is ${formatINR(
        forecast.minClosing,
      )}.`,
    },
    {
      id: 'reserve',
      label: 'Reserve',
      score: Math.round(reserveScore * 100),
      weight: weights.reserve,
      explanation: `Reserve ${formatINR(balance.reserve)} against a suggested ${formatINR(
        recommendedReserve,
      )} (${reserveWeeks * 7} days of your planned spend).`,
    },
    {
      id: 'budget',
      label: 'Budget adherence',
      score: Math.round(budgetScore * 100),
      weight: weights.budget,
      explanation:
        allocated <= 0
          ? 'No budget set yet — adherence cannot be measured, so this is held neutral.'
          : `${formatINR(overspent)} spent over plan out of ${formatINR(allocated)} allocated.`,
    },
    {
      id: 'savings',
      label: 'Savings',
      score: Math.round(savingsScore * 100),
      weight: weights.savings,
      explanation:
        input.goals.length === 0
          ? 'No goals yet — create one and this starts moving.'
          : `Goals are ${Math.round(goalProgress * 100)}% funded and the plan nets ${formatINR(
              forecast.netChange,
            )} across the horizon.`,
    },
  ];

  const total = Math.round(
    components.reduce((acc, c) => acc + (c.score / 100) * c.weight, 0),
  );

  return {
    total: clamp(total, 0, 100),
    band: bandFor(total),
    components,
    tone: toneFor(total),
    disclaimer:
      'Educational estimate based on the plan you built here — not a credit score, and not reported anywhere.',
  };
}

function totalSpendByCategory(items: readonly Item[]): Partial<Record<CategoryId, Paise>> {
  const out: Partial<Record<CategoryId, Paise>> = {};
  for (const item of items) {
    if (item.category === 'transfer') continue;
    if (item.kind !== 'expense') continue;
    if (item.status !== 'paid') continue;
    out[item.category] = (out[item.category] ?? 0) + item.amount;
  }
  return out;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}

function bandFor(total: number): HealthResult['band'] {
  if (total >= 80) return 'Strong';
  if (total >= 60) return 'Steady';
  if (total >= 40) return 'Tight';
  return 'Fragile';
}

function toneFor(total: number): RiskLevel {
  if (total >= 75) return 'low';
  if (total >= 55) return 'moderate';
  if (total >= 35) return 'high';
  return 'critical';
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}