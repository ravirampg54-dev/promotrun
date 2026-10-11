import { describe, expect, it } from 'vitest';
import { derive } from '../derive';
import { buildForecast, diffForecasts } from '../forecast';
import { computeBalance, settingsHorizon } from '../balance';
import { computeAllowance } from '../allowance';
import {
  END,
  START,
  TODAY,
  makeData,
  makeItem,
  makeRecurrence,
  makeSettings,
} from './factories';

describe('balance', () => {
  it('is opening + received income − paid expenses', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 1_000_000 }),
      items: [
        makeItem({
          title: 'Salary',
          amount: 600_000,
          kind: 'income',
          category: 'income',
          status: 'paid',
          date: '2025-03-01',
        }),
        makeItem({
          title: 'Rent',
          amount: 300_000,
          category: 'rent',
          essential: true,
          status: 'paid',
          date: '2025-03-05',
        }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.balance.opening).toBe(1_000_000);
    expect(d.balance.incomeReceived).toBe(600_000);
    expect(d.balance.expensesPaid).toBe(300_000);
    expect(d.balance.currentBalance).toBe(1_300_000);
  });

  it('never counts a savings transfer as an expense', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 500_000 }),
      items: [
        makeItem({
          title: 'Move to goal',
          amount: 200_000,
          category: 'transfer',
          status: 'paid',
          date: '2025-03-02',
        }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.balance.transfers).toBe(200_000);
    expect(d.balance.expensesPaid).toBe(0);
    expect(d.balance.currentBalance).toBe(500_000);
    // ...but the money is no longer free to spend
    expect(d.balance.availableCash).toBe(500_000);
  });

  it('counts a zero balance as zero and never goes negative from clamping', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 0, reserveTarget: 0 }),
      items: [
        makeItem({
          title: 'Groceries',
          amount: 0,
          category: 'food',
          essential: true,
          status: 'paid',
          date: '2025-03-02',
        }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.balance.currentBalance).toBe(0);
    expect(d.balance.availableCash).toBe(0);
    expect(d.allowance.daily).toBe(0);
  });

  it('does not subtract a scheduled bill until it is paid', () => {
    const bill = makeItem({
      title: 'Rent',
      amount: 300_000,
      category: 'rent',
      essential: true,
      date: '2025-03-25',
    });
    const data = makeData({
      settings: makeSettings({ openingBalance: 400_000 }),
      items: [bill],
    });

    const before = derive(data, TODAY);
    expect(before.balance.currentBalance).toBe(400_000);
    // ...but it is protected, so the allowance only counts what is left after it
    expect(before.balance.unpaidEssential).toBe(300_000);
    expect(before.allowance.discretionaryPool).toBe(100_000);
    expect(before.allowance.daily).toBe(Math.floor(100_000 / 21));

    const paidData = makeData({
      settings: makeSettings({ openingBalance: 400_000 }),
      items: [{ ...bill, status: 'paid' }],
    });
    const after = derive(paidData, TODAY);
    expect(after.balance.currentBalance).toBe(100_000);
    expect(after.balance.unpaidEssential).toBe(0);
  });

  it('exposes protected funds as a labelled breakdown', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 600_000, reserveTarget: 100_000 }),
      items: [
        makeItem({
          title: 'Electricity',
          amount: 80_000,
          category: 'utilities',
          essential: true,
          date: '2025-03-20',
        }),
      ],
    });
    const d = derive(data, TODAY);
    const ids = d.balance.breakdown.map((b) => b.id);
    expect(ids).toContain('reserve');
    expect(ids).toContain('essentials');
    expect(d.balance.protectedFunds).toBe(180_000);
  });
});

describe('forecast', () => {
  it('chains the daily closing balance day to day', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 300_000 }),
      items: [
        makeItem({ title: 'Day 1', amount: 100_000, category: 'food', date: TODAY }),
        makeItem({ title: 'Day 2', amount: 50_000, category: 'food', date: '2025-03-11' }),
      ],
    });
    const d = derive(data, TODAY);
    const [first, second] = d.forecast.days;
    expect(first.opening).toBe(300_000);
    expect(first.expense).toBe(100_000);
    expect(first.closing).toBe(200_000);
    expect(second.opening).toBe(200_000);
    expect(second.closing).toBe(150_000);
    expect(d.forecast.endClosing).toBe(150_000);
    expect(d.forecast.netChange).toBe(-150_000);
  });

  it('flags a projected negative balance and names the first short day', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 100_000 }),
      items: [
        makeItem({
          title: 'Rent',
          amount: 300_000,
          category: 'rent',
          essential: true,
          date: '2025-03-12',
        }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.forecast.shortfallDays).toBeGreaterThan(0);
    expect(d.forecast.firstShortfallDate).toBe('2025-03-12');
    expect(d.forecast.firstShortfallDay).toBe(12);
    expect(d.forecast.minClosing).toBe(-200_000);
    expect(d.risk.level).toBe('critical');
  });

  it('handles two bills falling on the same day', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 500_000 }),
      items: [
        makeItem({ title: 'Rent', amount: 200_000, category: 'rent', essential: true, date: '2025-03-15' }),
        makeItem({ title: 'Wifi', amount: 99_900, category: 'bills', essential: true, date: '2025-03-15' }),
        makeItem({ title: 'Bus pass', amount: 50_000, category: 'transport', essential: true, date: '2025-03-15' }),
      ],
    });
    const d = derive(data, TODAY);
    const day = d.forecast.days.find((x) => x.date === '2025-03-15');
    expect(day?.items).toHaveLength(3);
    expect(day?.expense).toBe(349_900);
    expect(day?.closing).toBe(150_100);
  });

  it('keeps a paid recurring subscription projecting into the future', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 1_000_000 }),
      items: [
        makeItem({
          title: 'Streaming',
          amount: 64_900,
          category: 'bills',
          essential: false,
          recurring: true,
          recurrence: makeRecurrence({ type: 'monthly', startDate: '2025-03-08' }),
          date: '2025-03-08',
          status: 'paid',
        }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.balance.expensesPaid).toBe(64_900);
    // paying March does not cancel April, but April is outside a 30-day run
    expect(d.forecast.days.flatMap((day) => day.items)).toHaveLength(0);

    const longer = makeData({
      settings: makeSettings({ openingBalance: 1_000_000, durationDays: 45 }),
      items: data.items,
    });
    const future = derive(longer, TODAY).forecast.days.flatMap((day) => day.items);
    expect(future.map((i) => i.date)).toEqual(['2025-04-08']);
  });

  it('a cancelled subscription stops future occurrences but keeps the past', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 1_000_000 }),
      items: [
        makeItem({
          title: 'Streaming',
          amount: 64_900,
          category: 'bills',
          recurring: true,
          recurrence: makeRecurrence({
            type: 'monthly',
            startDate: '2025-03-08',
            cancelledFrom: '2025-03-15',
          }),
          date: '2025-03-08',
          status: 'paid',
        }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.forecast.days.flatMap((day) => day.items)).toHaveLength(0);
    expect(d.balance.expensesPaid).toBe(64_900); // the March charge already happened
  });

  it('a paused subscription contributes nothing at all', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 1_000_000 }),
      items: [
        makeItem({
          title: 'Gym',
          amount: 150_000,
          category: 'health',
          recurring: true,
          recurrence: makeRecurrence({ type: 'monthly', startDate: '2025-03-05', paused: true }),
          date: '2025-03-05',
        }),
      ],
    });
    expect(derive(data, TODAY).forecast.totalExpense).toBe(0);
  });

  it('pulls an unpaid overdue bill onto today', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 400_000 }),
      items: [
        makeItem({
          title: 'Electricity',
          amount: 120_000,
          category: 'utilities',
          essential: true,
          date: '2025-03-04', // already past
        }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.balance.overdueAmount).toBe(120_000);
    expect(d.forecast.days[0].date).toBe(TODAY);
    expect(d.forecast.days[0].overdue).toBe(true);
    expect(d.forecast.days[0].expense).toBe(120_000);
    expect(d.risk.warnings.some((w) => w.id === 'risk:overdue')).toBe(true);
  });

  it('only counts a paid item once when it is marked paid mid-month', () => {
    const scheduled = makeItem({
      title: 'Rent',
      amount: 300_000,
      category: 'rent',
      essential: true,
      date: '2025-03-15',
    });
    const paid = { ...scheduled, status: 'paid' as const };

    const before = derive(
      makeData({ settings: makeSettings({ openingBalance: 400_000 }), items: [scheduled] }),
      TODAY,
    );
    const after = derive(
      makeData({ settings: makeSettings({ openingBalance: 400_000 }), items: [paid] }),
      TODAY,
    );

    expect(before.balance.currentBalance).toBe(400_000);
    expect(after.balance.currentBalance).toBe(100_000);
    // paid: it left the balance and left the forecast
    expect(after.forecast.days.find((d) => d.date === '2025-03-15')?.expense).toBe(0);
  });

  it('moving to a later day pushes the expense, not the total', () => {
    const base = makeItem({ title: 'Fees', amount: 300_000, category: 'education', date: '2025-03-12' });
    const early = derive(
      makeData({ settings: makeSettings({ openingBalance: 250_000 }), items: [base] }),
      TODAY,
    );
    const moved = { ...base, date: '2025-03-20' };
    const late = derive(
      makeData({ settings: makeSettings({ openingBalance: 250_000 }), items: [moved] }),
      TODAY,
    );

    expect(early.forecast.days.find((d) => d.date === '2025-03-12')?.closing).toBe(-50_000);
    expect(early.forecast.firstShortfallDate).toBe('2025-03-12');
    expect(late.forecast.firstShortfallDate).toBe('2025-03-20');
    expect(early.forecast.totalExpense).toBe(late.forecast.totalExpense);
    // the closing balance on day 30 is identical — only the day differs
    expect(early.forecast.endClosing).toBe(late.forecast.endClosing);
  });

  it('editing a past transaction changes today’s opening balance', () => {
    const past = makeItem({
      title: 'Dinner',
      amount: 60_000,
      category: 'food',
      status: 'paid',
      date: '2025-03-07',
    });
    const before = derive(
      makeData({ settings: makeSettings({ openingBalance: 500_000 }), items: [past] }),
      TODAY,
    );
    const edited = { ...past, amount: 25_000 };
    const after = derive(
      makeData({ settings: makeSettings({ openingBalance: 500_000 }), items: [edited] }),
      TODAY,
    );

    expect(before.balance.currentBalance).toBe(440_000);
    expect(after.balance.currentBalance).toBe(475_000);
    // the forecast starts at today, so only the opening changes
    expect(after.forecast.days[0].opening).toBe(475_000);
  });

  it('handles decimal paise through a whole month without drift', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 100_000 }),
      items: Array.from({ length: 30 }, (_, i) => {
        const date = `2025-03-${`${i + 1}`.padStart(2, '0')}`;
        return makeItem({
          title: `Chai ${i}`,
          amount: 3333, // ₹33.33
          category: 'food',
          date,
          // the ones before today already happened; the rest are still to pay
          status: i < 9 ? ('paid' as const) : ('scheduled' as const),
        });
      }),
    });
    const d = derive(data, TODAY);
    expect(d.balance.expensesPaid).toBe(3333 * 9);
    expect(d.forecast.totalExpense).toBe(3333 * 21); // only the remaining days are projected
    expect(d.forecast.endClosing).toBe(d.balance.currentBalance - 3333 * 21);
    expect(Number.isInteger(d.forecast.endClosing)).toBe(true);
  });

  it('ends exactly on day 30 when today is the last day', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 100_000 }),
    });
    const d = derive(data, '2025-03-30');
    expect(d.dayNumber).toBe(30);
    expect(d.remainingDays).toBe(1);
    expect(d.forecast.days).toHaveLength(1);
    expect(d.forecast.days[0].day).toBe(30);
    expect(d.allowance.remainingDays).toBe(1);
  });

  it('reports zero remaining days once the run is over', () => {
    const d = derive(makeData({ settings: makeSettings({ openingBalance: 100_000 }) }), '2025-04-05');
    expect(d.remainingDays).toBe(0);
    expect(d.forecast.days).toHaveLength(1); // today is still shown, closed
  });

  it('computes the horizon from the duration', () => {
    expect(settingsHorizon({ startDate: START, durationDays: 30 }).end).toBe(END);
    expect(settingsHorizon({ startDate: START, durationDays: 7 }).end).toBe('2025-03-07');
  });

  it('cautious mode drops every discretionary line', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 1_000_000 }),
      items: [
        makeItem({ title: 'Rent', amount: 300_000, category: 'rent', essential: true, date: '2025-03-12' }),
        makeItem({ title: 'Concert', amount: 200_000, category: 'entertainment', date: '2025-03-14' }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.forecast.totalExpense).toBe(500_000);
    expect(d.cautious.totalExpense).toBe(300_000);
    expect(d.cautious.endClosing).toBeGreaterThan(d.forecast.endClosing);
  });
});

describe('allowance', () => {
  it('divides the free pool by the days that are left', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 1_000_000, reserveTarget: 100_000 }),
    });
    const d = derive(data, TODAY); // 21 days left
    expect(d.remainingDays).toBe(21);
    expect(d.allowance.discretionaryPool).toBe(900_000);
    expect(d.allowance.daily).toBe(Math.floor(900_000 / 21));
    expect(d.allowance.daily).toBe(42857); // ₹428.57
  });

  it('never goes below zero and says when everything is committed', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 300_000, reserveTarget: 200_000 }),
      items: [
        makeItem({ title: 'Rent', amount: 300_000, category: 'rent', essential: true, date: '2025-03-12' }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.allowance.daily).toBe(0);
    expect(d.allowance.fullyCommitted).toBe(true);
  });

  it('counts future income before dividing', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 200_000 }),
      items: [
        makeItem({
          title: 'Freelance',
          amount: 420_000,
          kind: 'income',
          category: 'income',
          date: '2025-03-20',
        }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.balance.projectedBalance).toBe(620_000);
    expect(d.allowance.daily).toBe(Math.floor(620_000 / 21));
  });

  it('flags an allowance below the configured floor', () => {
    const d = derive(
      makeData({ settings: makeSettings({ openingBalance: 300_000, allowanceFloor: 100_000 }) }),
      TODAY,
    );
    expect(d.allowance.isBelowFloor).toBe(true);
    expect(d.risk.level).toBe('moderate');
    expect(d.risk.warnings.find((w) => w.id === 'risk:allowance')?.calculation).toContain('÷ 21 days');
  });

  it('exposes the formula it used', () => {
    const d = derive(makeData({ settings: makeSettings({ openingBalance: 500_000 }) }), TODAY);
    const { computeAllowance: _unused } = { computeAllowance };
    void _unused;
    expect(d.allowance.formula).toContain('÷ 21 days');
    expect(computeAllowance({ balance: d.balance, remainingDays: 1 }).daily).toBe(500_000);
  });
});

describe('diffForecasts', () => {
  it('describes what changed between two plans', () => {
    const before = buildForecast({
      startDate: START,
      endDate: END,
      today: TODAY,
      openingBalance: 100_000,
      reserve: 0,
      mode: 'base',
      items: [],
    });
    const after = buildForecast({
      startDate: START,
      endDate: END,
      today: TODAY,
      openingBalance: 400_000,
      reserve: 0,
      mode: 'base',
      items: [],
    });
    const delta = diffForecasts(before, after);
    expect(delta.endClosingChange).toBe(300_000);
    expect(delta.minClosingChange).toBe(300_000);
    expect(delta.better).toBe(true);
  });
});

describe('balance edge cases', () => {
  it('treats an expense larger than cash as a shortfall, not a negative balance', () => {
    const data = makeData({
      settings: makeSettings({ openingBalance: 50_000 }),
      items: [
        makeItem({
          title: 'Flight home',
          amount: 450_000,
          category: 'transport',
          date: '2025-03-14',
        }),
      ],
    });
    const d = derive(data, TODAY);
    expect(d.balance.currentBalance).toBe(50_000);
    expect(d.forecast.endClosing).toBe(-400_000);
    expect(d.forecast.runwayDays).toBe(13); // the flight lands on day 14
    expect(d.risk.level).toBe('critical');
  });

  it('reports the horizon from balance helpers directly', () => {
    const snapshot = computeBalance({
      items: [],
      openingBalance: 0,
      reserveTarget: 0,
      goalSaved: 0,
      goalRemaining: 0,
      today: TODAY,
      horizonEnd: END,
    });
    expect(snapshot.remainingDays).toBe(21);
    expect(snapshot.currentBalance).toBe(0);
  });
});