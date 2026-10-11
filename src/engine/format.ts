import {
  addDays,
  addMonthsClamped,
  compareISO,
  diffDays,
  eachDay,
  formatDayLabel,
  formatFullDate,
  isISODate,
  parseISODate,
  toISO,
} from './dates';

/**
 * Brings real Indian number grouping into the pure engine so tests and
 * non-React consumers get the same output the UI shows. Falls back to a
 * hand-rolled grouper when Intl lacks the 'en-IN' locale.
 */
export function makeFormatter(options: Intl.NumberFormatOptions): (n: number) => string {
  try {
    const fmt = new Intl.NumberFormat('en-IN', options);
    if (fmt.format(1234567.5).includes(',')) return (n: number) => fmt.format(n);
  } catch {
    /* fall through to the manual grouper */
  }
  const fractionDigits = options.minimumFractionDigits ?? 0;
  return (n: number) => {
    const fixed = Math.abs(n).toFixed(fractionDigits);
    const [whole, frac] = fixed.split('.');
    const sign = n < 0 ? '-' : '';
    const base = frac ? `${groupIndian(whole)}.${frac}` : groupIndian(whole);
    return `${sign}${base}`;
  };
}

export function groupIndian(whole: string): string {
  if (whole.length <= 3) return whole;
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

const nfInteger = makeFormatter({ minimumFractionDigits: 0, maximumFractionDigits: 0 });
const nfPaise = makeFormatter({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfCompact = makeFormatter({ notation: 'compact', maximumFractionDigits: 1 });

export {
  addDays,
  addMonthsClamped,
  compareISO,
  diffDays,
  eachDay,
  formatDayLabel,
  formatFullDate,
  isISODate,
  nfCompact,
  nfInteger,
  nfPaise,
  parseISODate,
  toISO,
};