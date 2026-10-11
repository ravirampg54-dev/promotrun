import * as React from 'react';
import { toast } from 'sonner';
import { RotateCcw, Wand2 } from 'lucide-react';
import { useStore } from '@/store/store';
import { useDerived } from '@/store/selectors';
import { formatINR, formatINREditable, parseAmount, splitEvenly } from '@/engine/money';
import { CATEGORIES } from '@/engine/categories';
import type { CategoryId } from '@/engine/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { AmountInput } from '@/components/ui/Input';
import { Progress } from '@/components/ui/controls';
import { Badge, Divider, EmptyState, Money } from '@/components/ui/primitives';
import { SpendBars } from '@/components/charts/CategoryCharts';
import { cn } from '@/lib/utils';

const expenseCategories = CATEGORIES.filter((c) => c.flow === 'expense' && c.id !== 'transfer');

export function BudgetPlanner() {
  const derived = useDerived();
  const budget = useStore((s) => s.budget);
  const setBudgetLine = useStore((s) => s.setBudgetLine);
  const clearBudget = useStore((s) => s.clearBudget);
  const settings = useStore((s) => s.settings);

  const [editing, setEditing] = React.useState<Record<string, string>>({});
  const [mode, setMode] = React.useState<'total' | 'daily'>('total');

  const allocated = derived.categoryRows.reduce((acc, r) => acc + r.planned, 0);
  const income = settings.plannedIncome;
  const days = Math.max(1, derived.remainingDays);
  const essentials = derived.categoryRows.filter((r) => r.essential && r.category !== 'transfer');
  const essentialsPlanned = essentials.reduce((acc, r) => acc + r.planned, 0);

  const suggested = React.useCallback(
    (categoryId: CategoryId): number => {
      const row = derived.categoryRows.find((r) => r.category === categoryId);
      const planned = row?.planned ?? 0;
      const spent = row?.spent ?? 0;
      // plan the remainder of the horizon at the observed daily pace
      const runRate = days > 0 ? Math.round((spent / Math.max(1, days)) * derived.forecast.remainingDays) : spent;
      return mode === 'daily'
        ? Math.round(Math.max(runRate, spent > 0 ? runRate : 0) / days)
        : Math.max(planned, runRate);
    },
    [derived, days, mode],
  );

  function autoFill() {
    let left = income;
    for (const c of essentials) {
      const value = Math.min(left, Math.max(20_000, suggested(c.category)));
      setBudgetLine(c.category, value);
      left -= value;
    }
    // anything left goes to discretionary, biggest headroom first
    const spare = derived.categoryRows.filter((r) => !r.essential && r.category !== 'transfer');
    const perLine = spare.length > 0 ? Math.floor(Math.max(0, left) / spare.length) : 0;
    for (const c of spare) setBudgetLine(c.category, perLine);
    toast.success('Budget drafted', {
      description: 'Split from your planned income and what you actually spend. Adjust anything.',
    });
  }

  function commitEdit(categoryId: CategoryId) {
    const raw = editing[categoryId];
    if (raw === undefined) return;
    const parsed = parseAmount(raw);
    if (parsed !== null) setBudgetLine(categoryId, mode === 'daily' ? parsed * days : parsed);
    setEditing((e) => {
      const next = { ...e };
      delete next[categoryId];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Plan the month</CardTitle>
              <CardDescription>
                Allocations shape the forecast — they never touch your cash.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={mode === 'total' ? 'default' : 'outline'} onClick={() => setMode('total')}>
                Totals
              </Button>
              <Button size="sm" variant={mode === 'daily' ? 'default' : 'outline'} onClick={() => setMode('daily')}>
                Per day
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Planned income</p>
              <p className="text-lg font-bold tnum">{formatINR(income)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Allocated</p>
              <p className={cn('text-lg font-bold tnum', allocated > income ? 'text-status-red' : '')}>
                {formatINR(allocated)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Unallocated</p>
              <p className={cn('text-lg font-bold tnum', income - allocated < 0 ? 'text-status-red' : 'text-status-lime')}>
                {formatINR(income - allocated)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Budget left / day</p>
              <p className="text-lg font-bold tnum">
                {formatINR(Math.max(0, Math.floor((income - allocated) / days)))}
              </p>
            </div>
          </div>

          <Progress
            value={income > 0 ? (allocated / income) * 100 : 0}
            barClassName={allocated > income ? 'bg-status-red' : 'bg-status-lime'}
            aria-label="Budget allocated"
          />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={autoFill}>
              <Wand2 /> Draft from my plan
            </Button>
            <Button size="sm" variant="ghost" onClick={clearBudget} disabled={budget.length === 0}>
              <RotateCcw /> Clear budget
            </Button>
            {mode === 'total' ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const perDay = Math.floor(income / days);
                  for (const c of expenseCategories) {
                    if (!c.essential) continue;
                    setBudgetLine(c.id, splitEvenly(perDay, 1)[0]);
                  }
                  toast.message('Essentials funded at the daily rate', {
                    description: `${formatINR(perDay)} a day for the days that are left.`,
                  });
                }}
              >
                Fund essentials at daily rate
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {budget.length === 0 ? (
        <EmptyState
          title="No budget yet"
          body="A budget is a promise to yourself about where the money goes. Draft one from your real spending and edit from there."
          action={<Button onClick={autoFill}>Draft a budget</Button>}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Category lines</CardTitle>
            <CardDescription>
              Essentials come first — {formatINR(essentialsPlanned)} of {formatINR(allocated)} goes to things you cannot skip.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Divider label="Essentials" />
            {essentials.map((row) => (
              <BudgetRow
                key={row.category}
                row={row}
                mode={mode}
                days={days}
                draft={editing[row.category]}
                onDraft={(v) => setEditing((e) => ({ ...e, [row.category]: v }))}
                onCommit={() => commitEdit(row.category)}
                onSuggest={() => setBudgetLine(row.category, suggested(row.category))}
              />
            ))}
            <Divider label="Discretionary" />
            {derived.categoryRows
              .filter((r) => !r.essential && r.category !== 'transfer')
              .map((row) => (
                <BudgetRow
                  key={row.category}
                  row={row}
                  mode={mode}
                  days={days}
                  draft={editing[row.category]}
                  onDraft={(v) => setEditing((e) => ({ ...e, [row.category]: v }))}
                  onCommit={() => commitEdit(row.category)}
                  onSuggest={() => setBudgetLine(row.category, suggested(row.category))}
                />
              ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Planned vs spent</CardTitle>
          <CardDescription>Red means over plan, not failure — it just needs a decision</CardDescription>
        </CardHeader>
        <CardContent>
          <SpendBars rows={derived.categoryRows} height={260} />
        </CardContent>
      </Card>

      {allocated > income ? (
        <Card className="border-status-red/30 bg-status-red/5">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm">
              You have planned <Money paise={allocated - income} tone="negative" /> more than{' '}
              {formatINR(income)} comes in. The forecast already accounts for that.
            </p>
            <Badge tone="red">over-allocated</Badge>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function BudgetRow({
  row,
  mode,
  days,
  draft,
  onDraft,
  onCommit,
  onSuggest,
}: {
  row: ReturnType<typeof useDerived>['categoryRows'][number];
  mode: 'total' | 'daily';
  days: number;
  draft?: string;
  onDraft: (value: string) => void;
  onCommit: () => void;
  onSuggest: () => void;
}) {
  const divisor = mode === 'daily' ? Math.max(1, days) : 1;
  const display = draft ?? formatINREditable(Math.round(row.planned / divisor));
  const over = row.spent > row.planned && row.planned > 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: `hsl(${row.hue} 70% 55%)` }} aria-hidden />
          <span className="truncate text-sm font-semibold">{row.label}</span>
          {row.essential ? <Badge tone="neutral">essential</Badge> : null}
        </div>
        <div className="w-32 shrink-0">
          <AmountInput
            className="h-9 text-sm"
            aria-label={`${row.label} planned amount`}
            value={display}
            onChange={(e) => onDraft(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommit();
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Progress
          value={row.planned > 0 ? (row.spent / row.planned) * 100 : 0}
          className="h-1.5"
          barClassName={over ? 'bg-status-red' : row.planned > 0 && row.spent === row.planned ? 'bg-status-lime' : 'bg-primary'}
          aria-label={`${row.label} spent against plan`}
        />
        <span className="shrink-0 text-[11px] tnum text-muted-foreground">
          {formatINR(row.spent)} spent
          {row.planned > 0 ? ` / ${formatINR(row.planned)}` : ''}
        </span>
        {row.spent > 0 ? (
          <button type="button" onClick={onSuggest} className="shrink-0 text-[11px] font-semibold text-primary hover:underline">
            suggest {formatINR(Math.max(row.planned, suggestedFallback(row)))}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function suggestedFallback(row: { spent: number }): number {
  return Math.round(row.spent * 1.1);
}