import { makeFormatter, nfInteger, nfPaise } from './format';

/**
 * Money. The single source of truth for currency in this app is the *integer
 * paise* (1 rupee = 100 paise). Floating point rupees only ever appear at the
 * formatting boundary.
 */

export type Paise = number;

export const PAISE_PER_RUPEE = 100;
export const RUPEE = (rupees: number): Paise => Math.round(rupees * PAISE_PER_RUPEE);

export function toRupees(paise: Paise): number {
  return paise / PAISE_PER_RUPEE;
}

/** rupees -> integer paise. Accepts a number or a user-typed string ("1,250.50"). */
export function toPaise(value: number | string): Paise {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * PAISE_PER_RUPEE);
  }
  const cleaned = value.replace(/[,\s_₹]/g, '');
  if (cleaned === '' || cleaned === '.') return 0;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * PAISE_PER_RUPEE);
}

/** Strict parse: null when the string is not a usable amount. */
export function parseAmount(value: string): Paise | null {
  const cleaned = value.replace(/[,\s_₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * PAISE_PER_RUPEE);
}

export interface FormatOptions {
  /** show paise when the amount has them (default false) */
  paise?: boolean;
  /** always prefix + (default false) */
  sign?: boolean;
  /** ₹1.2L style — chart axes only */
  compact?: boolean;
  /** drop the ₹ symbol (for inline use inside copy) */
  bare?: boolean;
}

/** Indian digit grouping: ₹1,23,456 — last three digits, then pairs. */
export function formatINR(paise: Paise, options: FormatOptions = {}): string {
  const { paise: showPaise = false, sign = false, compact = false, bare = false } = options;
  const rupees = paise / PAISE_PER_RUPEE;
  const usePaise = showPaise && Math.abs(paise) % PAISE_PER_RUPEE !== 0;
  const body = compact
    ? makeFormatter({ notation: 'compact', maximumFractionDigits: 1 })(Math.abs(rupees))
    : usePaise
      ? nfPaise(Math.abs(rupees))
      : nfInteger(Math.abs(rupees));

  const prefix = bare ? '' : '₹';
  if (paise < 0) return `−${prefix}${body}`;
  return `${sign ? '+' : ''}${prefix}${body}`;
}

/** Plain typed value for editing — no grouping, no symbol. */
export function formatINREditable(paise: Paise): string {
  const rupees = paise / PAISE_PER_RUPEE;
  if (Number.isInteger(rupees)) return `${rupees}`;
  return rupees.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function sumPaise(values: readonly Paise[]): Paise {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function clampPaise(
  paise: Paise,
  min: Paise = 0,
  max: Paise = Number.MAX_SAFE_INTEGER,
): Paise {
  if (!Number.isFinite(paise)) return min;
  return Math.min(Math.max(Math.round(paise), min), max);
}

export function ratioPaise(numerator: Paise, denominator: Paise): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

/** Per-day split that always sums back to the total (remainder lands on early days). */
export function splitEvenly(total: Paise, parts: number): Paise[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function percentOf(part: Paise, whole: Paise): number {
  if (whole <= 0) return 0;
  return (part / whole) * 100;
}

/** Human phrasing for a change, e.g. "−₹450" / "+₹1.2K". */
export function formatDelta(paise: Paise, options: FormatOptions = {}): string {
  return formatINR(paise, { sign: paise > 0, compact: true, ...options });
}