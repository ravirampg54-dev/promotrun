import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import { formatINR } from '../money';
import {
  applyScenario,
  compareScenarios,
  commitScenario,
  describeAction,
  evaluateScenario,
  goalDelayEstimate,
  isGoalPastDeadline,
} from '../scenarios';
import type { ScenarioAction } from '../scenarios';
import { END, START, TODAY, makeData, makeGoal, makeItem, makeSettings } from './factories';

function baseData() {
  return makeData({
    settings: makeSettings({ openingBalance: 600_000, reserveTarget: 100_000 }),
    items: [
      makeItem({
        title: 'Rent',
        amount: 300_000,
        category: 'rent',
        essential: true,
        date: '2025-03-15',
      }),
      makeItem({
        title: 'Concert tickets',
        amount: 150_000,
        category: 'entertainment',
        date: '2025-03-18',
      }),
      makeItem({
        title: 'Streaming',
        amount: 64_900,
        category: 'bills',
        recurring: true,
        recurrence: { type: 'monthly', startDate: '2025-03-12', interval: 1, paused: false, cancelledFrom: null, endDate: null },
        date: '2025-03-12',
      }),
    ],
  });
}

describe('scenario preview', () => {
  it('never mutates the source data', () => {
    const data = baseData();
    const snapshot = JSON.parse(JSON.stringify(data));

    const actions: ScenarioAction[] = [
      {
        kind: 'add-item',
        actionId: 'a1',
        item: { title: 'Concert tickets', amount: 150_000, kind: 'expense', category: 'entertainment', date: '2025-03-18' },
      },
      { kind: 'cancel-item', actionId: 'a2', itemId: data.items[2].id },
      { kind: 'set-reserve', actionId: 'a3', amount: 250_000 },
    ];

    const preview = applyScenario(data, actions);

    expect(JSON.parse(JSON.stringify(data))).toEqual(snapshot);
    expect(preview).not.toBe(data);
    expect(preview.items).not.toBe(data.items);
    expect(preview.settings).not.toBe(data.settings);
    expect(preview.items).toHaveLength(data.items.length + 1);
    expect(preview.settings.reserveTarget).toBe(250_000);
    expect(data.settings.reserveTarget).toBe(100_000);
  });

  it('adding a duplicate entry is a separate item, not a merge', () => {
    const data = baseData();
    const duplicate: ScenarioAction = {
      kind: 'add-item',
      actionId: 'dup',
      item: { title: 'Concert tickets', amount: 150_000, kind: 'expense', category: 'entertainment', date: '2025-03-18' },
    };
    const preview = applyScenario(data, [duplicate]);
    expect(preview.items).toHaveLength(4);
    expect(preview.items.filter((i) => i.title === 'Concert tickets')).toHaveLength(2);
    // both hit the forecast
    const evaluated = evaluateScenario(data, [duplicate], TODAY);
    expect(evaluated.forecast.totalExpense).toBe(300_000 + 150_000 + 150_000 + 64_900);
  });

  it('preview and commit produce identical numbers', () => {
    const data = baseData();
    const actions: ScenarioAction[] = [
      { kind: 'cancel-item', actionId: 'a1', itemId: data.items[2].id },
    ];
    const preview = evaluateScenario(data, actions, TODAY);
    const committed = commitScenario(data, actions);
    const after = evaluateScenario(committed, [], TODAY);

    expect(after.forecast.endClosing).toBe(preview.forecast.endClosing);
    expect(after.allowance.daily).toBe(preview.allowance.daily);
    expect(after.risk.level).toBe(preview.risk.level);
  });

  it('committing twice would double the change — so the store guards the id', () => {
    const data = baseData();
    const actions: ScenarioAction[] = [
      { kind: 'add-item', actionId: 'once', item: { id: 'fixed-id', title: 'Bus pass', amount: 20_000, kind: 'expense', category: 'transport', date: TODAY } },
    ];
    const once = commitScenario(data, actions);
    expect(once.items.filter((i) => i.id === 'fixed-id')).toHaveLength(1);
    // the caller must not replay the same commit; the store de-dupes by id
    const replay = commitScenario(once, actions);
    expect(replay.items.filter((i) => i.id === 'fixed-id')).toHaveLength(2);
    expect(() => commitScenario(once, actions)).not.toThrow();
  });
});

describe('scenario actions', () => {
  it('removing an item drops it from the forecast', () => {
    const data = baseData();
    const before = evaluateScenario(data, [], TODAY);
    const after = evaluateScenario(data, [{ kind: 'remove-item', actionId: 'x', itemId: data.items[1].id }], TODAY);
    expect(after.forecast.endClosing - before.forecast.endClosing).toBe(150_000);
  });

  it('cancelling a subscription stops future occurrences but keeps what is paid', () => {
    const data = baseData();
    const paid = applyScenario(data, [{ kind: 'pay-item', actionId: 'p', itemId: data.items[2].id }]);
    const cancelled = applyScenario(paid, [{ kind: 'cancel-item', actionId: 'c', itemId: data.items[2].id }]);
    const evaluated = evaluateScenario(paid, [{ kind: 'cancel-item', actionId: 'c', itemId: data.items[2].id }], TODAY);

    expect(cancelled.items[2].recurrence?.cancelledFrom).toBe('2025-03-12');
    expect(
      evaluated.forecast.days.flatMap((d) => d.items).filter((i) => i.itemId === data.items[2].id),
    ).toHaveLength(0);
    expect(evaluated.derived.balance.expensesPaid).toBe(64_900);
  });

  it('marking a bill paid moves it from forecast to balance exactly once', () => {
    const data = baseData();
    const evaluated = evaluateScenario(data, [{ kind: 'pay-item', actionId: 'p', itemId: data.items[0].id }], TODAY);
    expect(evaluated.derived.balance.currentBalance).toBe(600_000 - 300_000);
    // the rent is no longer an outstanding commitment
    expect(evaluated.derived.balance.unpaidEssential).toBe(0);
    expect(evaluated.forecast.days.find((d) => d.date === '2025-03-15')?.items).toHaveLength(0);
    // and it was charged exactly once
    expect(evaluated.derived.balance.expensesPaid).toBe(300_000);
  });

  it('changing the reserve changes the allowance, not the balance', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 800_000, reserveTarget: 100_000 }),
    });
    const before = evaluateScenario(data, [], TODAY);
    const after = evaluateScenario(data, [{ kind: 'set-reserve', actionId: 'r', amount: 300_000 }], TODAY);
    expect(after.derived.balance.currentBalance).toBe(before.derived.balance.currentBalance);
    expect(before.allowance.daily).toBeGreaterThan(0);
    expect(after.allowance.daily).toBeLessThan(before.allowance.daily);
  });

  it('moves a goal and resizes it', () => {
    const data = makeData({
      goals: [makeGoal({ target: 200_000, saved: 40_000, deadline: END, createdAt: START })],
    });
    const delayed = applyScenario(data, [
      { kind: 'delay-goal', actionId: 'd', goalId: data.goals[0].id, extraDays: 7 },
    ]);
    expect(delayed.goals[0].deadline).toBe(addDays(END, 7));

    const resized = applyScenario(data, [
      { kind: 'resize-goal', actionId: 'r', goalId: data.goals[0].id, target: 100_000 },
    ]);
    expect(resized.goals[0].target).toBe(100_000);

    const dropped = applyScenario(data, [{ kind: 'drop-goal', actionId: 'x', goalId: data.goals[0].id }]);
    expect(dropped.goals).toHaveLength(0);
  });

  it('describes every action in plain language', () => {
    const actions: ScenarioAction[] = [
      { kind: 'add-item', actionId: '1', item: { title: 'Bus pass', amount: 20_000, kind: 'expense' } },
      { kind: 'remove-item', actionId: '2', itemId: 'a' },
      { kind: 'cancel-item', actionId: '3', itemId: 'a' },
      { kind: 'resume-item', actionId: '4', itemId: 'a' },
      { kind: 'pay-item', actionId: '5', itemId: 'a' },
      { kind: 'set-reserve', actionId: '6', amount: 100_000 },
      { kind: 'set-opening', actionId: '7', amount: 100_000 },
      { kind: 'contribute-goal', actionId: '8', goalId: 'g', amount: 50_000 },
      { kind: 'delay-goal', actionId: '9', goalId: 'g', extraDays: 5 },
      { kind: 'resize-goal', actionId: '10', goalId: 'g', target: 90_000 },
      { kind: 'drop-goal', actionId: '11', goalId: 'g' },
      { kind: 'move-item', actionId: '12', itemId: 'a', date: TODAY },
    ];
    for (const action of actions) {
      expect(describeAction(action).length).toBeGreaterThan(3);
    }
  });
});

describe('scenario comparison', () => {
  it('picks a winner and explains the difference', () => {
    const data = baseData();
    const { baseline, rows, winnerId } = compareScenarios(
      data,
      [
        {
          id: 'skip-concert',
          name: 'Skip the concert',
          blurb: 'Stay in on the 18th',
          actions: [{ kind: 'remove-item', actionId: 'a', itemId: data.items[1].id }],
        },
        {
          id: 'cancel-streaming',
          name: 'Cancel streaming',
          blurb: 'Drop the subscription',
          actions: [{ kind: 'cancel-item', actionId: 'b', itemId: data.items[2].id }],
        },
        {
          id: 'stay-the-course',
          name: 'Change nothing',
          blurb: 'Spend as planned',
          actions: [],
        },
      ],
      TODAY,
    );

    expect(rows).toHaveLength(3);
    expect(winnerId).toBe('skip-concert');
    expect(rows.filter((r) => r.winner)).toHaveLength(1);
    expect(baseline.forecast.endClosing).toBe(600_000 - 300_000 - 150_000 - 64_900);
    expect(rows[0].endClosing).toBeGreaterThan(baseline.forecast.endClosing);
    expect(rows[0].note).toContain('Best option');
    expect(rows[0].safeDaily).toBeGreaterThan(rows[1].safeDaily);
  });

  it('ranks by fewer shortfalls when the end balance ties', () => {
    // Same total spend, same end balance — but the late version stays positive longer.
    const data = makeData({
      settings: makeSettings({ openingBalance: 300_000 }),
      items: [
        makeItem({ title: 'A', amount: 200_000, category: 'entertainment', date: '2025-03-11' }),
        makeItem({ title: 'B', amount: 200_000, category: 'entertainment', date: '2025-03-20' }),
      ],
    });
    const { rows, winnerId } = compareScenarios(
      data,
      [
        { id: 'keep-both', name: 'Keep both', blurb: '', actions: [] },
        {
          id: 'push-late',
          name: 'Push both to the 25th',
          blurb: '',
          actions: [
            { kind: 'move-item', actionId: 'm1', itemId: data.items[0].id, date: '2025-03-25' },
            { kind: 'move-item', actionId: 'm2', itemId: data.items[1].id, date: '2025-03-25' },
          ],
        },
      ],
      TODAY,
    );
    expect(rows[0].endClosing).toBe(rows[1].endClosing); // a genuine tie
    expect(rows[1].shortfallDays).toBeLessThan(rows[0].shortfallDays);
    expect(winnerId).toBe('push-late');
  });

  it('returns no winner for an empty variant list', () => {
    const { winnerId, rows } = compareScenarios(baseData(), [], TODAY);
    expect(winnerId).toBeNull();
    expect(rows).toHaveLength(0);
  });
});

describe('goal delay math', () => {
  it('is calculated from the actual contribution rate, not a constant', () => {
    // ₹100/day for the 9 days since it was created
    const goal = makeGoal({ target: 300_000, saved: 90_000, deadline: END, createdAt: START });
    const estimate = goalDelayEstimate(goal, TODAY);

    expect(estimate.currentRate).toBe(10_000); // ₹100/day
    expect(estimate.remaining).toBe(210_000);
    expect(estimate.daysToDeadline).toBe(20);
    expect(estimate.daysNeededAtCurrentRate).toBe(21);
    expect(estimate.extraDays).toBe(1); // one day late — not a fixed 30
    expect(estimate.projectedDate).toBe(addDays(TODAY, 21));
    expect(estimate.message).toContain('1 day(s) after');
  });

  it('a faster contribution rate needs no delay at all', () => {
    const goal = makeGoal({ target: 300_000, saved: 180_000, deadline: END, createdAt: START });
    const estimate = goalDelayEstimate(goal, TODAY);
    expect(estimate.currentRate).toBe(20_000);
    expect(estimate.daysNeededAtCurrentRate).toBe(6);
    expect(estimate.extraDays).toBeLessThan(0);
    expect(estimate.message).toContain('inside');
  });

  it('a zero contribution rate never finishes and says so', () => {
    const goal = makeGoal({ target: 300_000, saved: 0, deadline: END, createdAt: START });
    const estimate = goalDelayEstimate(goal, TODAY);
    expect(estimate.currentRate).toBe(0);
    expect(estimate.daysNeededAtCurrentRate).toBe(Number.POSITIVE_INFINITY);
    expect(estimate.projectedDate).toBeNull();
    expect(estimate.message).toContain('₹0/day');
  });

  it('a fully funded goal reports nothing left to do', () => {
    const goal = makeGoal({ target: 100_000, saved: 100_000, deadline: '2025-03-01', createdAt: START });
    const estimate = goalDelayEstimate(goal, TODAY);
    expect(estimate.funded).toBe(true);
    expect(estimate.message).toContain('fully funded');
    expect(isGoalPastDeadline(goal, TODAY)).toBe(false);
  });

  it('detects a missed deadline only when the goal is still short', () => {
    expect(isGoalPastDeadline(makeGoal({ target: 100_000, saved: 10_000, deadline: '2025-03-01', createdAt: START }), TODAY)).toBe(true);
    expect(isGoalPastDeadline(makeGoal({ target: 100_000, saved: 100_000, deadline: '2025-03-01', createdAt: START }), TODAY)).toBe(false);
  });

  it('requires a per-day figure to catch up when the deadline is today', () => {
    const goal = makeGoal({ target: 100_000, saved: 20_000, deadline: TODAY, createdAt: START });
    const estimate = goalDelayEstimate(goal, TODAY);
    expect(estimate.daysToDeadline).toBe(0);
    expect(estimate.requiredPerDay).toBe(80_000);
    expect(estimate.message).toContain(formatINR(80_000));
  });
});