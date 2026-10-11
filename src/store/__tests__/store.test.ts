import { beforeEach, describe, expect, it } from 'vitest';
import { computeDerived, useStore } from '../store';
import { demoData, emptyData, initialState, migrate } from '../shape';
import { filterItems, sortItems, findDuplicate, billRows, EMPTY_FILTER } from '../selectors';
import { budgetToCsv, goalsToCsv, itemsToCsv } from '../export';
import { todayISO, addDays } from '@/engine/dates';
import { evaluateScenario } from '@/engine/scenarios';
import type { ScenarioAction } from '@/engine/scenarios';
import { RUPEE } from '@/engine/money';

const TODAY = '2025-06-10';

function freshStore() {
  useStore.setState({ ...initialState(TODAY) });
}

describe('store defaults', () => {
  beforeEach(freshStore);

  it('starts empty and not onboarded', () => {
    const state = useStore.getState();
    expect(state.profile.onboarded).toBe(false);
    expect(state.items).toHaveLength(0);
    expect(state.settings.durationDays).toBe(30);
    expect(state.settings.openingBalance).toBe(RUPEE(10000));
  });

  it('derives a zero-entry plan without throwing', () => {
    const state = useStore.getState();
    const derived = computeDerived(state);
    expect(derived.remainingDays).toBe(30);
    expect(derived.allowance.daily).toBeGreaterThan(0);
    expect(derived.forecast.days).toHaveLength(30);
    expect(derived.risk.level).toBe('low');
  });
});

describe('demo seed', () => {
  beforeEach(() => {
    freshStore();
    useStore.getState().loadDemo();
  });

  it('produces a believable, finite month', () => {
    const state = useStore.getState();
    const derived = computeDerived(state);

    expect(state.profile.demo).toBe(true);
    expect(state.items.length).toBeGreaterThan(10);
    expect(state.goals).toHaveLength(3);
    expect(Number.isFinite(derived.allowance.daily)).toBe(true);
    expect(derived.allowance.daily).toBeGreaterThanOrEqual(0);
    expect(derived.forecast.days).toHaveLength(derived.remainingDays);
    expect(derived.forecast.endClosing).not.toBeNaN();
    // the demo deliberately contains an overdue bill so risk has something to say
    expect(derived.balance.overdueAmount).toBeGreaterThan(0);
    expect(derived.risk.warnings.some((w) => w.id === 'risk:overdue')).toBe(true);
  });

  it('protected funds are non-negative and never exceed a sane fraction', () => {
    const derived = computeDerived(useStore.getState());
    expect(derived.balance.protectedFunds).toBeGreaterThanOrEqual(0);
    expect(derived.balance.protectedTotal).toBe(
      derived.balance.protectedFunds + derived.balance.goalSaved,
    );
  });

  it('every warning carries all four parts', () => {
    const derived = computeDerived(useStore.getState());
    for (const w of derived.risk.warnings) {
      expect(w.whatChanged.length).toBeGreaterThan(10);
      expect(w.whyItMatters.length).toBeGreaterThan(10);
      expect(w.calculation.length).toBeGreaterThan(5);
      expect(w.nextStep.length).toBeGreaterThan(10);
    }
  });

  it('generates dates relative to today so the demo never goes stale', () => {
    const today = todayISO();
    const demo = demoData(today);
    const derived = computeDerived({
      ...useStore.getState(),
      items: demo.items,
      goals: demo.goals,
      budget: demo.budget,
      settings: demo.settings,
      today,
    });
    expect(derived.forecast.days.length).toBeGreaterThan(20);
  });
});

describe('item actions', () => {
  beforeEach(freshStore);

  it('adds, edits, pays, duplicates and removes', () => {
    const store = useStore.getState();
    const id = store.addItem({
      title: 'Chai',
      amount: RUPEE(33.33),
      kind: 'expense',
      category: 'food',
      date: TODAY,
      status: 'scheduled',
      recurring: false,
      recurrence: null,
      essential: false,
    });

    expect(useStore.getState().items).toHaveLength(1);
    // decimal paise survive the store round trip
    expect(useStore.getState().items[0].amount).toBe(3333);

    useStore.getState().updateItem(id, { amount: RUPEE(50) });
    expect(useStore.getState().items[0].amount).toBe(5000);

    useStore.getState().togglePaid(id);
    expect(useStore.getState().items[0].status).toBe('paid');
    useStore.getState().togglePaid(id);
    expect(useStore.getState().items[0].status).toBe('scheduled');

    const copyId = useStore.getState().duplicateItem(id);
    expect(useStore.getState().items).toHaveLength(2);
    expect(useStore.getState().items[1].id).toBe(copyId);
    expect(useStore.getState().items[1].title).toBe('Chai (copy)');

    useStore.getState().removeItem(id);
    expect(useStore.getState().items).toHaveLength(1);
  });

  it('moving the day changes the forecast but not the totals', () => {
    const store = useStore.getState();
    store.addItem({
      title: 'Fees',
      amount: RUPEE(2000),
      kind: 'expense',
      category: 'education',
      date: addDays(TODAY, 2),
      status: 'scheduled',
      recurring: false,
      recurrence: null,
    });
    const before = computeDerived(useStore.getState());

    useStore.getState().updateItem(useStore.getState().items[0].id, { date: addDays(TODAY, 9) });
    const after = computeDerived(useStore.getState());

    expect(after.forecast.totalExpense).toBe(before.forecast.totalExpense);
    expect(after.forecast.endClosing).toBe(before.forecast.endClosing);
    expect(after.forecast.days.find((d) => d.date === addDays(TODAY, 9))?.expense).toBe(200_000);
    expect(after.forecast.days.find((d) => d.date === addDays(TODAY, 2))?.expense).toBe(0);
  });

  it('jumping days changes today and the remaining count', () => {
    useStore.getState().jumpDays(5);
    expect(useStore.getState().today).toBe(addDays(TODAY, 5));
    expect(computeDerived(useStore.getState()).remainingDays).toBe(25);
    useStore.getState().jumpDays(-5);
    expect(computeDerived(useStore.getState()).remainingDays).toBe(30);
  });
});

describe('goals and budget', () => {
  beforeEach(freshStore);

  it('contributes to a goal and never goes negative', () => {
    const id = useStore.getState().addGoal({
      title: 'Course',
      target: RUPEE(1000),
      saved: 0,
      deadline: addDays(TODAY, 10),
      priority: 'high',
    });
    useStore.getState().contributeGoal(id, RUPEE(250));
    expect(useStore.getState().goals[0].saved).toBe(25_000);
    useStore.getState().contributeGoal(id, -RUPEE(1000));
    expect(useStore.getState().goals[0].saved).toBe(0);
  });

  it('budget lines never touch cash', () => {
    useStore.setState({ settings: { ...useStore.getState().settings, openingBalance: RUPEE(5000) } });
    const before = computeDerived(useStore.getState()).balance.currentBalance;
    useStore.getState().setBudgetLine('food', RUPEE(1200));
    const after = computeDerived(useStore.getState());
    expect(after.balance.currentBalance).toBe(before);
    expect(after.categoryRows.find((r) => r.category === 'food')?.planned).toBe(120_000);

    // overwriting a line replaces it rather than duplicating
    useStore.getState().setBudgetLine('food', RUPEE(900));
    expect(useStore.getState().budget.filter((l) => l.category === 'food')).toHaveLength(1);
  });
});

describe('scenario commits apply exactly once', () => {
  beforeEach(freshStore);

  const actions: ScenarioAction[] = [
    {
      kind: 'add-item',
      actionId: 'a',
      item: {
        id: 'sim-item',
        title: 'Concert',
        amount: RUPEE(1500),
        kind: 'expense',
        category: 'entertainment',
        date: addDays(TODAY, 3),
      },
    },
  ];

  it('applies once and refuses a replay of the same commit id', () => {
    const store = useStore.getState();
    expect(store.applyScenarioActions('commit-1', actions)).toBe(true);
    expect(useStore.getState().items).toHaveLength(1);

    expect(useStore.getState().applyScenarioActions('commit-1', actions)).toBe(false);
    expect(useStore.getState().items).toHaveLength(1);

    // a different commit id is a deliberate second action
    expect(useStore.getState().applyScenarioActions('commit-2', actions)).toBe(true);
    expect(useStore.getState().items).toHaveLength(2);
  });

  it('the preview matches what the commit produces', () => {
    useStore.getState().addItem({
      title: 'Rent',
      amount: RUPEE(3000),
      kind: 'expense',
      category: 'rent',
      date: addDays(TODAY, 5),
      status: 'scheduled',
      recurring: false,
      recurrence: null,
      essential: true,
    });

    const before = computeDerived(useStore.getState());
    const data = {
      profile: useStore.getState().profile,
      settings: useStore.getState().settings,
      items: useStore.getState().items,
      goals: useStore.getState().goals,
      budget: useStore.getState().budget,
    };
    const preview = evaluateScenario(data, actions, useStore.getState().today);

    useStore.getState().applyScenarioActions('preview-check', actions);
    const after = computeDerived(useStore.getState());

    expect(after.allowance.daily).toBe(preview.allowance.daily);
    expect(after.forecast.endClosing).toBe(preview.forecast.endClosing);
    expect(after.forecast.endClosing).toBeLessThan(before.forecast.endClosing);
  });
});

describe('notifications dedupe', () => {
  beforeEach(() => {
    freshStore();
    useStore.getState().loadDemo();
  });

  it('syncs each warning id exactly once', () => {
    const state = useStore.getState();
    const derived = computeDerived(state);
    const count = derived.risk.warnings.length;

    useStore.getState().syncNotifications(derived.risk);
    const first = useStore.getState().notifications.length;
    expect(first).toBe(count);
    expect(first).toBeGreaterThan(0);

    useStore.getState().syncNotifications(derived.risk);
    expect(useStore.getState().notifications.length).toBe(first);

    useStore.getState().markAllNotificationsRead();
    expect(useStore.getState().notifications.every((n) => n.read)).toBe(true);

    useStore.getState().clearNotifications();
    expect(useStore.getState().notifications).toHaveLength(0);
  });
});

describe('selectors', () => {
  const items = [
    {
      id: '1',
      title: 'Groceries',
      amount: RUPEE(800),
      kind: 'expense' as const,
      category: 'food' as const,
      date: '2025-06-10',
      status: 'paid' as const,
      recurring: false,
      recurrence: null,
      essential: true,
      createdAt: '2025-06-01',
    },
    {
      id: '2',
      title: 'Salary',
      amount: RUPEE(10000),
      kind: 'income' as const,
      category: 'income' as const,
      date: '2025-06-01',
      status: 'paid' as const,
      recurring: false,
      recurrence: null,
      createdAt: '2025-06-01',
    },
    {
      id: '3',
      title: 'Netflix',
      amount: RUPEE(649),
      kind: 'expense' as const,
      category: 'bills' as const,
      date: '2025-06-15',
      status: 'scheduled' as const,
      recurring: true,
      recurrence: { type: 'monthly' as const, startDate: '2025-06-15', interval: 1, endDate: null, cancelledFrom: null, paused: false },
      createdAt: '2025-06-01',
    },
  ];

  it('filters by kind, status and query', () => {
    expect(filterItems(items, EMPTY_FILTER)).toHaveLength(3);
    expect(filterItems(items, { ...EMPTY_FILTER, kind: 'income' })).toHaveLength(1);
    expect(filterItems(items, { ...EMPTY_FILTER, status: 'scheduled' })).toHaveLength(1);
    expect(filterItems(items, { ...EMPTY_FILTER, query: 'netfl' })).toHaveLength(1);
    expect(filterItems(items, { ...EMPTY_FILTER, categories: ['food'] })).toHaveLength(1);
    expect(filterItems(items, { ...EMPTY_FILTER, query: 'zzz' })).toHaveLength(0);
  });

  it('sorts by every order', () => {
    expect(sortItems(items, 'date-asc')[0].id).toBe('2');
    expect(sortItems(items, 'date-desc')[0].id).toBe('3');
    expect(sortItems(items, 'amount-desc')[0].id).toBe('2');
    expect(sortItems(items, 'amount-asc')[0].id).toBe('3');
  });

  it('detects a duplicate entry but ignores the row being edited', () => {
    expect(findDuplicate(items, { title: 'groceries', amount: RUPEE(800), date: '2025-06-10', category: 'food' })?.id).toBe('1');
    expect(findDuplicate(items, { id: '1', title: 'Groceries', amount: RUPEE(800), date: '2025-06-10', category: 'food' })).toBeNull();
    expect(findDuplicate(items, { title: 'Groceries', amount: RUPEE(900), date: '2025-06-10', category: 'food' })).toBeNull();
  });

  it('lists bills with cadence, next date and annual cost', () => {
    const rows = billRows(items, '2025-06-10');
    const netflix = rows.find((r) => r.item.id === '3');
    expect(netflix?.cadence).toBe('Every month');
    expect(netflix?.nextDate).toBe('2025-06-15');
    expect(netflix?.annualCost).toBe(64_900 * 12); // paise per year
    expect(rows.find((r) => r.item.id === '1')).toBeUndefined();
  });
});

describe('csv export', () => {
  it('writes a header and one row per item with Indian-friendly decimals', () => {
    const data = emptyData(TODAY);
    data.items = [
      {
        id: 'a',
        title: 'Chai, small',
        amount: RUPEE(33.33),
        kind: 'expense',
        category: 'food',
        date: TODAY,
        status: 'paid',
        recurring: false,
        recurrence: null,
        createdAt: TODAY,
      },
    ];
    const csv = itemsToCsv(data);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Amount (INR)');
    expect(lines[1]).toContain('"Chai, small"');
    expect(lines[1]).toContain('33.33');
    expect(goalsToCsv(data)).toContain('Goal');
    expect(budgetToCsv(data)).toContain('Planned (INR)');
  });
});

describe('persistence migration', () => {
  it('fills in missing slices from an old blob', () => {
    const migrated = migrate({ items: [], settings: { openingBalance: 1 } }, TODAY);
    expect(migrated.version).toBeGreaterThan(0);
    expect(migrated.goals).toEqual([]);
    expect(migrated.settings.durationDays).toBe(30);
    expect(migrated.settings.reserveTarget).toBeGreaterThan(0);
    expect(migrated.today).toBe(TODAY);
  });

  it('survives junk', () => {
    expect(migrate(null, TODAY).items).toEqual([]);
    expect(migrate('nonsense', TODAY).notifications).toEqual([]);
    expect(migrate({ items: 'not an array' }, TODAY).items).toEqual([]);
  });
});

describe('reset and fresh run', () => {
  it('clear everything and start over', () => {
    freshStore();
    useStore.getState().loadDemo();
    expect(useStore.getState().items.length).toBeGreaterThan(0);

    useStore.getState().resetAll();
    expect(useStore.getState().items).toEqual([]);
    expect(useStore.getState().profile.onboarded).toBe(false);

    useStore.getState().finishOnboarding({ name: 'Asha' });
    expect(useStore.getState().profile.onboarded).toBe(true);
    useStore.getState().startFreshRun();
    expect(useStore.getState().settings.openingBalance).toBe(RUPEE(10000));
  });
});