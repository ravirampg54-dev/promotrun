import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonthsClamped,
  diffDays,
  eachDay,
  formatDayLabel,
  isISODate,
} from '../dates';
import {
  clampPaise,
  formatDelta,
  formatINR,
  formatINREditable,
  parseAmount,
  percentOf,
  splitEvenly,
  toPaise,
} from '../money';

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // leap year
  });

  it('clamps monthly recurrence to short months instead of overflowing', () => {
    expect(addMonthsClamped('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonthsClamped('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsClamped('2025-01-30', 12)).toBe('2026-01-30');
    // once February has been clamped, later months keep the clamped day
    expect(addMonthsClamped(addMonthsClamped('2025-01-31', 1), 1)).toBe('2025-03-28');
  });

  it('computes whole-day differences in both directions', () => {
    expect(diffDays('2025-03-01', '2025-03-30')).toBe(29);
    expect(diffDays('2025-03-30', '2025-03-01')).toBe(-29);
    expect(diffDays('2025-03-01', '2025-03-01')).toBe(0);
  });

  it('builds an inclusive day list and reverses safely', () => {
    expect(eachDay('2025-03-01', '2025-03-03')).toEqual([
      '2025-03-01',
      '2025-03-02',
      '2025-03-03',
    ]);
    expect(eachDay('2025-03-30', '2025-03-01')).toEqual([]);
  });

  it('validates and formats ISO calendar days', () => {
    expect(isISODate('2025-03-01')).toBe(true);
    expect(isISODate('2025-3-1')).toBe(false);
    expect(isISODate('not-a-date')).toBe(false);
    expect(formatDayLabel('2025-03-09')).toBe('9 Mar');
  });
});

describe('money', () => {
  it('keeps values as integer paise with no float drift', () => {
    expect(toPaise(10)).toBe(1000);
    expect(toPaise(0.1)).toBe(10);
    expect(toPaise(19.99)).toBe(1999);
    expect(toPaise('1,250.50')).toBe(125050);
    expect(toPaise('₹ 480')).toBe(48000);
    // the classic float trap: 0.1 + 0.2
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });

  it('parses strictly and rejects nonsense', () => {
    expect(parseAmount('120')).toBe(12000);
    expect(parseAmount('120.5')).toBe(12050);
    expect(parseAmount('120.555')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-50')).toBeNull();
  });

  it('formats with Indian digit grouping', () => {
    expect(formatINR(123456700)).toBe('₹12,34,567');
    expect(formatINR(10000000)).toBe('₹1,00,000');
    expect(formatINR(100000)).toBe('₹1,000');
    expect(formatINR(0)).toBe('₹0');
  });

  it('shows paise only when they exist and only when asked', () => {
    expect(formatINR(125050)).toBe('₹1,251');
    expect(formatINR(125050, { paise: true })).toBe('₹1,250.50');
    expect(formatINR(125000, { paise: true })).toBe('₹1,250');
  });

  it('handles negatives and explicit signs', () => {
    expect(formatINR(-50000)).toBe('−₹500');
    expect(formatINR(50000, { sign: true })).toBe('+₹500');
    expect(formatINR(0, { sign: true })).toBe('+₹0');
  });

  it('round-trips through the editable format', () => {
    expect(formatINREditable(125050)).toBe('1250.5');
    expect(toPaise(formatINREditable(125050))).toBe(125050);
  });

  it('splits evenly without losing or inventing paise', () => {
    const parts = splitEvenly(1000, 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
    expect(splitEvenly(1000, 0)).toEqual([]);
  });

  it('clamps, counts percentages and phrases deltas', () => {
    expect(clampPaise(-5)).toBe(0);
    expect(clampPaise(150, 0, 100)).toBe(100);
    expect(clampPaise(Number.NaN)).toBe(0);
    expect(percentOf(250, 1000)).toBe(25);
    expect(percentOf(250, 0)).toBe(0);
    expect(formatDelta(-45000)).toBe('−₹450');
    expect(formatDelta(45000)).toBe('+₹450');
  });
});