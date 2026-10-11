import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** ₹1,250.50 → "1250.50" for text inputs */
export function amountToInput(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? `${rupees}` : rupees.toFixed(2);
}

export function hueColor(hue: number, sat = 70, light = 55, alpha = 1): string {
  return `hsl(${hue} ${sat}% ${light}% / ${alpha})`;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pluralise(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Stable ids for list keys and action ids. */
let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}