import { describe, expect, it } from 'vitest';
import { occurrencesBetween, nextOccurrence, describeRecurrence } from '../recurrence';
import { makeRecurrence } from './factories';

describe('recurrence', () => {
  it('fires once for a one-time rule', () => {
    const rule = makeRecurrence({ type: 'once', startDate: '2025-03-05' });
    expect(occurrencesBetween(rule, '2025-03-01', '2025-03-30')).toEqual(['2025-03-05']);
    expect(occurrencesBetween(rule, '2025-03-06', '2025-03-30')).toEqual([]);
  });

  it('fires weekly on the same weekday', () => {
    const rule = makeRecurrence({ type: 'weekly', startDate: '2025-03-05' });
    expect(occurrencesBetween(rule, '2025-03-01', '2025-03-30')).toEqual([
      '2025-03-05',
      '2025-03-12',
      '2025-03-19',
      '2025-03-26',
    ]);
  });

  it('honours a fortnightly-style interval', () => {
    const rule = makeRecurrence({ type: 'weekly', startDate: '2025-03-05', interval: 2 });
    expect(occurrencesBetween(rule, '2025-03-01', '2025-03-30')).toEqual([
      '2025-03-05',
      '2025-03-19',
    ]);
  });

  it('fires monthly and clamps to short months', () => {
    const rule = makeRecurrence({ type: 'monthly', startDate: '2025-01-31' });
    const dates = occurrencesBetween(rule, '2025-01-01', '2025-04-30');
    expect(dates).toEqual(['2025-01-31', '2025-02-28', '2025-03-28', '2025-04-28']);
  });

  it('stops at endDate', () => {
    const rule = makeRecurrence({
      type: 'monthly',
      startDate: '2025-03-05',
      endDate: '2025-03-20',
    });
    expect(occurrencesBetween(rule, '2025-03-01', '2025-03-30')).toEqual(['2025-03-05']);
  });

  it('cancel stops future occurrences only', () => {
    const rule = makeRecurrence({
      type: 'monthly',
      startDate: '2025-03-05',
      cancelledFrom: '2025-03-17',
    });
    // the 5th still happened; the 5th of next month never will
    expect(occurrencesBetween(rule, '2025-03-01', '2025-05-30')).toEqual(['2025-03-05']);
  });

  it('pause stops everything', () => {
    const rule = makeRecurrence({
      type: 'weekly',
      startDate: '2025-03-05',
      paused: true,
    });
    expect(occurrencesBetween(rule, '2025-03-01', '2025-03-30')).toEqual([]);
  });

  it('never returns anything for an inverted window', () => {
    const rule = makeRecurrence({ type: 'weekly', startDate: '2025-03-05' });
    expect(occurrencesBetween(rule, '2025-03-30', '2025-03-01')).toEqual([]);
  });

  it('finds the next occurrence strictly after a date', () => {
    const rule = makeRecurrence({ type: 'monthly', startDate: '2025-03-12' });
    expect(nextOccurrence(rule, '2025-03-10')).toBe('2025-03-12');
    expect(nextOccurrence(rule, '2025-03-12')).toBe('2025-04-12');
    expect(
      nextOccurrence(
        makeRecurrence({ type: 'monthly', startDate: '2025-03-12', endDate: '2025-04-12' }),
        '2025-04-12',
      ),
    ).toBeNull();
    expect(nextOccurrence(makeRecurrence({ type: 'once', startDate: '2025-03-12' }), '2025-03-12')).toBeNull();
  });

  it('describes itself in plain language', () => {
    expect(describeRecurrence(null)).toBe('One time');
    expect(describeRecurrence(makeRecurrence({ type: 'once', startDate: '2025-03-05' }))).toBe(
      'One time',
    );
    expect(describeRecurrence(makeRecurrence({ type: 'weekly', startDate: '2025-03-05' }))).toBe(
      'Every week',
    );
    expect(
      describeRecurrence(makeRecurrence({ type: 'weekly', startDate: '2025-03-05', interval: 3 })),
    ).toBe('Every 3 weeks');
    expect(describeRecurrence(makeRecurrence({ type: 'monthly', startDate: '2025-03-05' }))).toBe(
      'Every month',
    );
  });
});