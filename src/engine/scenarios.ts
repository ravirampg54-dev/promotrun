import { addDays, compareISO, diffDays, formatDayLabel } from './dates';
import type { ISODate } from './dates';
import { formatINR } from './money';
import type { Paise } from './money';
import { derive } from './derive';
import type { Derived } from './derive';
import type { ForecastResult } from './forecast';
import type { AllowanceResult } from './allowance';
import type { RiskAssessment } from './risk';
import type { HealthResult } from './health';
import type { AppData, CategoryId, Goal, Item, Recurrence } from './types';

/* ------------------------------------------------------------------ *
 * A scenario is a list of *draft actions*. Nothing here touches the    *
 * store: `applyScenario` returns a brand new AppData object, and the  *
 * UI only calls it to draw the preview. Confirming calls the store     *
 * action once, which then re-runs the same logic on the real data.     *
 * ------------------------------------------------------------------ */

export type ScenarioAction =
  | {
      kind: 'add-item';
      actionId: string;
      item: Partial<Item> & Pick<Item, 'title' | 'amount' | 'kind'>;
    }
  | { kind: 'remove-item'; actionId: string; itemId: string }
  | { kind: 'cancel-item'; actionId: string; itemId: string }
  | { kind: 'resume-item'; actionId: string; itemId: string }
  | { kind: 'pay-item'; actionId: string; itemId: string }
  | { kind: 'set-reserve'; actionId: string; amount: Paise }
  | { kind: 'set-opening'; actionId: string; amount: Paise }
  | { kind: 'contribute-goal'; actionId: string; goalId: string; amount: Paise }
  | { kind: 'delay-goal'; actionId: string; goalId: string; extraDays: number }
  | { kind: 'resize-goal'; actionId: string; goalId: string; target: Paise }
  | { kind: 'drop-goal'; actionId: string; goalId: string }
  | { kind: 'move-item'; actionId: string; itemId: string; date: ISODate };

export interface ScenarioVariant {
  id: string;
  name: string;
  blurb: string;
  actions: ScenarioAction[];
}

export interface ScenarioEvaluation {
  data: AppData;
  derived: Derived;
  forecast: ForecastResult;
  allowance: AllowanceResult;
  risk: RiskAssessment;
  health: HealthResult;
}

export interface ScenarioComparisonRow {
  id: string;
  name: string;
  blurb: string;
  actions: ScenarioAction[];
  derived: Derived;
  endClosing: Paise;
  minClosing: Paise;
  safeDaily: Paise;
  shortfallDays: number;
  riskLevel: RiskAssessment['level'];
  healthTotal: number;
  goalDelayDays: number;
  winner: boolean;
  note: string;
}

/** Human label for an action, used in the change list. */
export function describeAction(action: ScenarioAction): string {
  switch (action.kind) {
    case 'add-item':
      return `${action.item.kind === 'income' ? 'Add income' : 'Add expense'} · ${action.item.title} ${formatINR(
        action.item.amount,
      )}`;
    case 'remove-item':
      return 'Remove this item';
    case 'cancel-item':
      return 'Cancel going forward';
    case 'resume-item':
      return 'Resume this item';
    case 'pay-item':
      return 'Mark as paid';
    case 'set-reserve':
      return `Reserve ${formatINR(action.amount)}`;
    case 'set-opening':
      return `Opening balance ${formatINR(action.amount)}`;
    case 'contribute-goal':
      return `Save ${formatINR(action.amount)} towards the goal`;
    case 'delay-goal':
      return `Move the goal by ${action.extraDays} days`;
    case 'resize-goal':
      return `Resize goal to ${formatINR(action.target)}`;
    case 'drop-goal':
      return 'Drop this goal';
    case 'move-item':
      return `Move to ${formatDayLabel(action.date)}`;
    default:
      return 'Change';
  }
}

/**
 * Pure. Returns a new AppData with the actions applied. The input object is
 * deep-cloned first, so nothing in the caller's state can be touched.
 */
export function applyScenario(data: AppData, actions: readonly ScenarioAction[]): AppData {
  const next: AppData = structuredClone(data);

  for (const action of actions) {
    switch (action.kind) {
      case 'add-item': {
        const seed = action.item;
        const item: Item = {
          id: seed.id ?? `draft-${action.actionId}`,
          title: seed.title,
          amount: seed.amount,
          kind: seed.kind,
          category: (seed.category ?? 'entertainment') as CategoryId,
          date: seed.date ?? data.settings.startDate,
          status: seed.status ?? 'scheduled',
          recurring: Boolean(seed.recurring),
          recurrence: (seed.recurrence ?? null) as Recurrence | null,
          essential: seed.essential ?? false,
          note: seed.note,
          createdAt: seed.createdAt ?? data.settings.startDate,
        };
        next.items = [...next.items, item];
        break;
      }
      case 'remove-item':
        next.items = next.items.filter((i) => i.id !== action.itemId);
        break;
      case 'cancel-item':
        next.items = next.items.map((i) =>
          i.id === action.itemId
            ? {
                ...i,
                recurrence: i.recurrence
                  ? { ...i.recurrence, cancelledFrom: i.date, paused: false }
                  : null,
                recurring: false,
              }
            : i,
        );
        break;
      case 'resume-item':
        next.items = next.items.map((i) =>
          i.id === action.itemId
            ? {
                ...i,
                recurring: i.recurrence ? i.recurrence.type !== 'once' : i.recurring,
                recurrence: i.recurrence
                  ? { ...i.recurrence, cancelledFrom: null, paused: false }
                  : null,
              }
            : i,
        );
        break;
      case 'pay-item':
        next.items = next.items.map((i) =>
          i.id === action.itemId ? { ...i, status: 'paid' } : i,
        );
        break;
      case 'set-reserve':
        next.settings = { ...next.settings, reserveTarget: Math.max(0, action.amount) };
        break;
      case 'set-opening':
        next.settings = { ...next.settings, openingBalance: action.amount };
        break;
      case 'contribute-goal':
        next.goals = next.goals.map((g) =>
          g.id === action.goalId ? { ...g, saved: g.saved + action.amount } : g,
        );
        break;
      case 'delay-goal':
        next.goals = next.goals.map((g) =>
          g.id === action.goalId ? { ...g, deadline: addDays(g.deadline, action.extraDays) } : g,
        );
        break;
      case 'resize-goal':
        next.goals = next.goals.map((g) =>
          g.id === action.goalId ? { ...g, target: Math.max(0, action.target) } : g,
        );
        break;
      case 'drop-goal':
        next.goals = next.goals.filter((g) => g.id !== action.goalId);
        break;
      case 'move-item':
        next.items = next.items.map((i) => (i.id === action.itemId ? { ...i, date: action.date } : i));
        break;
      default:
        break;
    }
  }

  return next;
}

export function evaluateScenario(
  data: AppData,
  actions: readonly ScenarioAction[],
  today: ISODate,
): ScenarioEvaluation {
  const next = applyScenario(data, actions);
  const derived = derive(next, today);
  return {
    data: next,
    derived,
    forecast: derived.forecast,
    allowance: derived.allowance,
    risk: derived.risk,
    health: derived.health,
  };
}

/**
 * Compare N variants against the same baseline.
 * Winner = the variant with the highest end-of-horizon balance; ties break on
 * fewer shortfall days, then a safer risk level, then a better health score.
 */
export function compareScenarios(
  data: AppData,
  variants: readonly ScenarioVariant[],
  today: ISODate,
): { baseline: ScenarioEvaluation; rows: ScenarioComparisonRow[]; winnerId: string | null } {
  const baseline = evaluateScenario(data, [], today);

  const rows = variants.map((variant) => {
    const evaluation = evaluateScenario(data, variant.actions, today);
    return {
      id: variant.id,
      name: variant.name,
      blurb: variant.blurb,
      actions: variant.actions,
      derived: evaluation.derived,
      endClosing: evaluation.forecast.endClosing,
      minClosing: evaluation.forecast.minClosing,
      safeDaily: evaluation.allowance.daily,
      shortfallDays: evaluation.forecast.shortfallDays,
      riskLevel: evaluation.risk.level,
      healthTotal: evaluation.health.total,
      goalDelayDays: 0,
      winner: false,
      note: '',
    };
  });

  const winner = pickWinner(rows);
  if (winner) winner.winner = true;

  for (const row of rows) {
    row.note = rowNote(row, baseline, winner?.id === row.id);
  }

  return { baseline, rows, winnerId: winner?.id ?? null };
}

function pickWinner(rows: ScenarioComparisonRow[]): ScenarioComparisonRow | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => {
    if (row.endClosing !== best.endClosing) return row.endClosing > best.endClosing ? row : best;
    if (row.shortfallDays !== best.shortfallDays)
      return row.shortfallDays < best.shortfallDays ? row : best;
    if (row.riskLevel !== best.riskLevel)
      return riskRank(row.riskLevel) < riskRank(best.riskLevel) ? row : best;
    return row.healthTotal > best.healthTotal ? row : best;
  });
}

function riskRank(level: RiskAssessment['level']): number {
  return { critical: 3, high: 2, moderate: 1, low: 0 }[level];
}

function rowNote(
  row: ScenarioComparisonRow,
  baseline: ScenarioEvaluation,
  isWinner: boolean,
): string {
  const endChange = row.endClosing - baseline.forecast.endClosing;
  const dayChange = row.safeDaily - baseline.allowance.daily;
  const parts: string[] = [];
  if (endChange !== 0) parts.push(`${formatINR(endChange, { sign: true })} at day 30`);
  if (dayChange !== 0) parts.push(`${formatINR(dayChange, { sign: true })}/day safe to spend`);
  if (row.shortfallDays < baseline.forecast.shortfallDays)
    parts.push(`${baseline.forecast.shortfallDays - row.shortfallDays} short day(s) removed`);
  if (row.shortfallDays > baseline.forecast.shortfallDays)
    parts.push(`${row.shortfallDays - baseline.forecast.shortfallDays} more short day(s)`);
  if (parts.length === 0) return 'No measurable change to the plan.';
  return `${isWinner ? 'Best option. ' : ''}${parts.join(' · ')}.`;
}

/* --------------------------- goal delay math --------------------------- */

export interface GoalDelayEstimate {
  goalId: string;
  remaining: Paise;
  currentRate: Paise;
  requiredPerDay: Paise;
  daysToDeadline: number;
  /** days needed at the real contribution rate — Infinity when the rate is 0 */
  daysNeededAtCurrentRate: number;
  extraDays: number;
  projectedDate: ISODate | null;
  funded: boolean;
  message: string;
}

/**
 * Delay is always derived from the actual contribution rate, never a constant.
 * rate = saved / days since the goal was created.
 */
export function goalDelayEstimate(goal: Goal, today: ISODate): GoalDelayEstimate {
  const remaining = Math.max(0, goal.target - goal.saved);
  const elapsed = Math.max(1, diffDays(goal.createdAt, today));
  const currentRate = Math.max(0, Math.round(goal.saved / elapsed));
  const daysToDeadline = diffDays(today, goal.deadline);
  const requiredPerDay = daysToDeadline > 0 ? Math.ceil(remaining / daysToDeadline) : remaining;
  const daysNeededAtCurrentRate =
    currentRate > 0 ? Math.ceil(remaining / currentRate) : Number.POSITIVE_INFINITY;
  const funded = remaining === 0;
  const extraDays = Number.isFinite(daysNeededAtCurrentRate)
    ? daysNeededAtCurrentRate - daysToDeadline
    : Number.POSITIVE_INFINITY;

  const message = funded
    ? `${goal.title} is fully funded — nothing left to add.`
    : currentRate === 0
      ? `Nothing has gone into ${goal.title} yet. At ₹0/day it will never reach ${formatINR(
          goal.target,
        )} on its own.`
      : extraDays <= 0
        ? `At ${formatINR(currentRate)}/day — your current rate — ${goal.title} lands ${formatDayLabel(
            addDays(today, daysNeededAtCurrentRate),
          )}, inside the ${formatDayLabel(goal.deadline)} deadline.`
        : `At ${formatINR(currentRate)}/day — your current rate — ${goal.title} lands ${formatDayLabel(
            addDays(today, daysNeededAtCurrentRate),
          )}, ${extraDays} day(s) after the ${formatDayLabel(
            goal.deadline,
          )} deadline. ${formatINR(requiredPerDay)}/day would close the gap.`;

  return {
    goalId: goal.id,
    remaining,
    currentRate,
    requiredPerDay,
    daysToDeadline,
    daysNeededAtCurrentRate,
    extraDays,
    projectedDate:
      Number.isFinite(daysNeededAtCurrentRate) && daysNeededAtCurrentRate >= 0
        ? addDays(today, daysNeededAtCurrentRate)
        : null,
    funded,
    message,
  };
}

/** The store commits a scenario exactly once, through this. */
export function commitScenario(data: AppData, actions: readonly ScenarioAction[]): AppData {
  return applyScenario(data, actions);
}

export function isGoalPastDeadline(goal: Goal, today: ISODate): boolean {
  return goal.saved < goal.target && compareISO(goal.deadline, today) < 0;
}