import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import { derive } from '../derive';
import { assessRisk } from '../risk';
import { computeHealth } from '../health';
import {
  END,
  START,
  TODAY,
  makeData,
  makeGoal,
  makeItem,
  makeSettings,
} from './factories';

describe('risk', () => {
  it('is Low when the plan holds', () => {
    const d = derive(
      makeData({
        settings: makeSettings({ openingBalance: 1_000_000, reserveTarget: 100_000 }),
      }),
      TODAY,
    );
    expect(d.risk.level).toBe('low');
    expect(d.risk.warnings).toHaveLength(0);
    expect(d.risk.headline).toMatch(/holds up/i);
  });

  it('is Critical when the projection goes negative, and explains all four parts', () => {
    const d = derive(
      makeData({
        settings: makeSettings({ openingBalance: 100_000 }),
        items: [
          makeItem({
            title: 'Flight',
            amount: 400_000,
            category: 'transport',
            essential: true,
            date: '2025-03-12',
          }),
        ],
      }),
      TODAY,
    );
    expect(d.risk.level).toBe('critical');
    const w = d.risk.warnings[0];
    expect(w.id).toBe('risk:shortfall');
    expect(w.whatChanged).toContain('day 12');
    expect(w.whyItMatters.length).toBeGreaterThan(20);
    expect(w.calculation).toContain('lowest projected closing');
    expect(w.nextStep.length).toBeGreaterThan(10);
  });

  it('is High when the balance dips into the reserve but stays positive', () => {
    const d = derive(
      makeData({
        settings: makeSettings({ openingBalance: 500_000, reserveTarget: 200_000 }),
        items: [
          makeItem({
            title: 'Rent',
            amount: 350_000,
            category: 'rent',
            essential: true,
            date: '2025-03-15',
          }),
        ],
      }),
      TODAY,
    );
    expect(d.forecast.shortfallDays).toBe(0);
    expect(d.risk.level).toBe('high');
    expect(d.risk.driver?.id).toBe('risk:reserve');
    expect(d.risk.driver?.calculation).toContain('gap');
  });

  it('is Moderate when only the allowance floor is breached', () => {
    const d = derive(
      makeData({
        settings: makeSettings({ openingBalance: 300_000, reserveTarget: 150_000, allowanceFloor: 100_000 }),
      }),
      TODAY,
    );
    expect(d.allowance.daily).toBeLessThan(100_000);
    expect(d.risk.level).toBe('moderate');
    expect(d.risk.warnings.map((w) => w.id)).toContain('risk:allowance');
  });

  it('says what changed when a baseline is supplied', () => {
    const data = makeData({ settings: makeSettings({ openingBalance: 500_000 }) });
    const before = derive(data, TODAY);
    const worse = makeData({
      settings: makeSettings({ openingBalance: 100_000 }),
      items: [
        makeItem({
          title: 'Rent',
          amount: 300_000,
          category: 'rent',
          essential: true,
          date: '2025-03-14',
        }),
      ],
    });
    const after = derive(worse, TODAY);
    const assessment = assessRisk({
      balance: after.balance,
      forecast: after.forecast,
      allowance: after.allowance,
      goals: [],
      budget: [],
      spentByCategory: {},
      tuning: { allowanceFloor: 10_000, reserve: 0 },
      today: TODAY,
      baseline: { forecast: before.forecast, allowance: before.allowance },
    });
    expect(assessment.warnings[0].whatChanged).toContain('used to hold');
  });

  it('flags a missed goal deadline with the real numbers behind it', () => {
    const d = derive(
      makeData({
        settings: makeSettings({ openingBalance: 500_000 }),
        goals: [
          makeGoal({
            title: 'Course',
            target: 200_000,
            saved: 50_000,
            deadline: '2025-03-05',
            createdAt: START,
          }),
        ],
      }),
      TODAY,
    );
    const w = d.risk.warnings.find((x) => x.id.startsWith('goal:'));
    expect(w).toBeDefined();
    expect(w?.title).toBe('Course missed its deadline');
    expect(w?.calculation).toContain('₹1,500'); // ₹1500/day for the 10 days that are left
  });

  it('does not warn about a goal that is fully funded', () => {
    const d = derive(
      makeData({
        settings: makeSettings({ openingBalance: 500_000 }),
        goals: [
          makeGoal({ target: 100_000, saved: 100_000, deadline: '2025-03-05', createdAt: START }),
        ],
      }),
      TODAY,
    );
    expect(d.risk.warnings.some((w) => w.id.startsWith('goal:'))).toBe(false);
  });

  it('flags a category that is over its planned budget', () => {
    const d = derive(
      makeData({
        settings: makeSettings({ openingBalance: 500_000 }),
        budget: [{ category: 'food', allocated: 200_000 }],
        items: [
          makeItem({
            title: 'Groceries',
            amount: 260_000,
            category: 'food',
            status: 'paid',
            date: '2025-03-05',
          }),
        ],
      }),
      TODAY,
    );
    const w = d.risk.warnings.find((x) => x.id === 'budget:food:overspent');
    expect(w?.level).toBe('moderate');
    expect(w?.calculation).toContain('₹60');
  });
});

describe('health', () => {
  it('scores a healthy month high and a broken one low', () => {
    const healthy = derive(
      makeData({
        settings: makeSettings({ openingBalance: 2_000_000, reserveTarget: 400_000 }),
        budget: [{ category: 'food', allocated: 300_000 }],
        goals: [makeGoal({ target: 200_000, saved: 150_000, deadline: END, createdAt: START })],
        items: [
          makeItem({
            title: 'Salary',
            amount: 600_000,
            kind: 'income',
            category: 'income',
            status: 'paid',
            date: '2025-03-01',
          }),
        ],
      }),
      TODAY,
    );
    // a plan that cannot cover its own rent, has no reserve and no savings
    const broken = derive(
      makeData({
        settings: makeSettings({ openingBalance: 100_000, reserveTarget: 0 }),
        items: [
          makeItem({
            title: 'Rent',
            amount: 300_000,
            category: 'rent',
            essential: true,
            date: '2025-03-14',
          }),
        ],
      }),
      TODAY,
    );

    expect(healthy.health.total).toBeGreaterThan(broken.health.total);
    expect(broken.health.total).toBeLessThan(40);
    expect(healthy.health.total).toBeLessThanOrEqual(100);
    expect(healthy.health.band).toBe('Strong');
    expect(broken.health.band).toBe('Fragile');
    expect(healthy.health.components).toHaveLength(5);
    expect(healthy.health.disclaimer).toMatch(/not a credit score/i);
  });

  it('weights sum to 100 and every component carries an explanation', () => {
    const d = derive(makeData({ settings: makeSettings({ openingBalance: 800_000 }) }), TODAY);
    const total = d.health.components.reduce((acc, c) => acc + c.weight, 0);
    expect(total).toBe(100);
    for (const component of d.health.components) {
      expect(component.score).toBeGreaterThanOrEqual(0);
      expect(component.score).toBeLessThanOrEqual(100);
      expect(component.explanation.length).toBeGreaterThan(5);
    }
  });

  it('holds budget adherence neutral when nothing is budgeted', () => {
    const health = computeHealth({
      balance: derive(makeData(), TODAY).balance,
      forecast: derive(makeData(), TODAY).forecast,
      allowance: derive(makeData(), TODAY).allowance,
      items: [],
      goals: [],
      budget: [],
      today: TODAY,
    });
    const budget = health.components.find((c) => c.id === 'budget');
    expect(budget?.score).toBe(75);
    expect(budget?.explanation).toMatch(/neutral/i);
  });

  it('keeps the ring colour consistent with the risk level', () => {
    const d = derive(
      makeData({
        settings: makeSettings({ openingBalance: 1_500_000, reserveTarget: 100_000 }),
      }),
      TODAY,
    );
    expect(d.risk.level).toBe('low');
    expect(d.health.tone).toBe('low');
  });
});

describe('goal moves', () => {
  it('moving a goal deadline changes required-per-day, not the balance', () => {
    const goal = makeGoal({ target: 300_000, saved: 100_000, deadline: '2025-03-20', createdAt: START });
    const before = derive(
      makeData({ settings: makeSettings({ openingBalance: 800_000 }), goals: [goal] }),
      TODAY,
    );
    const later = derive(
      makeData({
        settings: makeSettings({ openingBalance: 800_000 }),
        goals: [{ ...goal, deadline: addDays(goal.deadline, 10) }],
      }),
      TODAY,
    );

    expect(before.goals[0].daysLeft).toBe(10);
    expect(before.goals[0].requiredPerDay).toBe(20_000);
    expect(later.goals[0].requiredPerDay).toBe(10_000);
    expect(before.balance.currentBalance).toBe(later.balance.currentBalance);
  });

  it('a funded goal reports zero remaining and no work left', () => {
    const goal = makeGoal({ target: 100_000, saved: 100_000, deadline: END, createdAt: START });
    const d = derive(makeData({ goals: [goal] }), TODAY);
    expect(d.goals[0].funded).toBe(true);
    expect(d.goals[0].remaining).toBe(0);
    expect(d.goals[0].percent).toBe(100);
    expect(d.goals[0].requiredPerDay).toBe(0);
  });

  it('derives the current contribution rate from how long the goal has existed', () => {
    const goal = makeGoal({ target: 300_000, saved: 90_000, deadline: END, createdAt: START });
    const d = derive(makeData({ goals: [goal] }), TODAY); // 9 days elapsed
    expect(d.goals[0].currentRate).toBe(10_000); // ₹100/day
    expect(d.goals[0].daysToFundAtCurrentRate).toBe(21); // ₹2,100 left at ₹100/day
  });

  it('a past-deadline goal requires its full remainder per day', () => {
    const goal = makeGoal({ target: 100_000, saved: 10_000, deadline: '2025-03-01', createdAt: START });
    const d = derive(makeData({ goals: [goal] }), TODAY);
    expect(d.goals[0].daysLeft).toBe(0);
    expect(d.goals[0].requiredPerDay).toBe(90_000);
  });
});