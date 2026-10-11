import { categoryLabel } from '@/engine/categories';
import { formatDayLabel } from '@/engine/dates';
import { formatINR } from '@/engine/money';
import { describeRecurrence } from '@/engine/recurrence';
import type { AppData } from '@/engine/types';

function escapeCsv(value: string | number): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function itemsToCsv(data: AppData): string {
  const rows: (string | number)[][] = [
    ['Date', 'Title', 'Type', 'Category', 'Amount (INR)', 'Status', 'Essential', 'Repeats'],
  ];
  for (const item of [...data.items].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([
      item.date,
      item.title,
      item.kind,
      categoryLabel(item.category),
      (item.amount / 100).toFixed(2),
      item.status,
      item.essential ? 'yes' : 'no',
      describeRecurrence(item.recurrence),
    ]);
  }
  return toCsv(rows);
}

export function goalsToCsv(data: AppData): string {
  const rows: (string | number)[][] = [['Goal', 'Target (INR)', 'Saved (INR)', 'Deadline', 'Priority']];
  for (const goal of data.goals) {
    rows.push([
      goal.title,
      (goal.target / 100).toFixed(2),
      (goal.saved / 100).toFixed(2),
      goal.deadline,
      goal.priority,
    ]);
  }
  return toCsv(rows);
}

export function budgetToCsv(data: AppData): string {
  const rows: (string | number)[][] = [['Category', 'Planned (INR)']];
  for (const line of data.budget) {
    rows.push([categoryLabel(line.category), (line.allocated / 100).toFixed(2)]);
  }
  return toCsv(rows);
}

export function downloadFile(filename: string, contents: string): void {
  const blob = new Blob([`﻿${contents}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** A short, human summary to paste into a notes app. */
export function summaryText(data: AppData, today: string, allowances: number): string {
  return [
    `₹10K plan — day summary (${formatDayLabel(today)})`,
    `Opening: ${formatINR(data.settings.openingBalance)}`,
    `Reserve: ${formatINR(data.settings.reserveTarget)}`,
    `Safe daily: ${formatINR(allowances)}`,
    '',
    ...data.items
      .filter((i) => i.date === today)
      .map((i) => `• ${i.title} — ${formatINR(i.amount)} (${i.status})`),
  ].join('\n');
}