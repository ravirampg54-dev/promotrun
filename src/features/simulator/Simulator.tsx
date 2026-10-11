import * as React from 'react';
import { toast } from 'sonner';
import { Crown, Minus, Sparkles, Trash2, Trophy } from 'lucide-react';
import { useStore } from '@/store/store';
import { useAppData, useDerived, levelClasses } from '@/store/selectors';
import { compareScenarios, describeAction, evaluateScenario } from '@/engine/scenarios';
import type { ScenarioAction, ScenarioVariant } from '@/engine/scenarios';
import { formatINR, parseAmount } from '@/engine/money';
import { addDays } from '@/engine/dates';
import { uid } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { AmountInput, Field, Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Badge, EmptyState, Money } from '@/components/ui/primitives';
import { ForecastChart } from '@/components/charts/ForecastChart';
import { cn } from '@/lib/utils';

function buildPresets(data: ReturnType<typeof useAppData>, today: string): ScenarioVariant[] {
  const discretionary = data.items.filter((i) => i.kind === 'expense' && !i.essential);
  const recurring = data.items.filter((i) => i.recurring && i.kind === 'expense');
  const smallest = [...discretionary].sort((a, b) => a.amount - b.amount)[0];
  const sub = [...recurring].sort((a, b) => b.amount - a.amount)[0];
  const overdue = data.items.find((i) => i.kind === 'expense' && i.status !== 'paid' && i.date < today);

  const presets: ScenarioVariant[] = [];
  if (sub) {
    presets.push({
      id: 'cancel-subscription',
      name: `Cancel “${sub.title}”`,
      blurb: `Saves ${formatINR(sub.amount)} a month from the next charge onward.`,
      actions: [{ kind: 'cancel-item', actionId: 'cancel-sub', itemId: sub.id }],
    });
  }
  if (smallest) {
    presets.push({
      id: 'skip-expense',
      name: `Skip “${smallest.title}”`,
      blurb: `One-off: ${formatINR(smallest.amount)} stays in your pocket.`,
      actions: [{ kind: 'remove-item', actionId: 'skip-one', itemId: smallest.id }],
    });
  }
  if (discretionary.length >= 2) {
    const [a, b] = discretionary;
    presets.push({
      id: 'half-fun',
      name: 'Halve discretionary spend',
      blurb: `Cuts ${formatINR(a.amount)} and ${formatINR(b.amount)} in half for the rest of the run.`,
      actions: [
        { kind: 'move-item', actionId: 'half-a', itemId: a.id, date: a.date },
        { kind: 'remove-item', actionId: 'drop-a', itemId: a.id },
        { kind: 'move-item', actionId: 'half-b', itemId: b.id, date: b.date },
        { kind: 'remove-item', actionId: 'drop-b', itemId: b.id },
        {
          kind: 'add-item',
          actionId: 'half-a-new',
          item: { title: `${a.title} (half)`, amount: Math.round(a.amount / 2), kind: 'expense', category: a.category, date: a.date },
        },
        {
          kind: 'add-item',
          actionId: 'half-b-new',
          item: { title: `${b.title} (half)`, amount: Math.round(b.amount / 2), kind: 'expense', category: b.category, date: b.date },
        },
      ],
    });
  }
  presets.push({
    id: 'use-reserve',
    name: 'Spend the reserve',
    blurb: 'Cuts the reserve in half to free up cash today.',
    actions: [{ kind: 'set-reserve', actionId: 'half-reserve', amount: Math.round(data.settings.reserveTarget / 2) }],
  });
  if (overdue) {
    presets.push({
      id: 'pay-overdue',
      name: `Pay “${overdue.title}”`,
      blurb: 'Clears the overdue flag and updates the forecast honestly.',
      actions: [{ kind: 'pay-item', actionId: 'pay-overdue', itemId: overdue.id }],
    });
  }
  return presets;
}

function ComparisonTable({
  rows,
}: {
  rows: ReturnType<typeof compareScenarios>['rows'];
}) {
  const columns = [
    { key: 'endClosing', label: 'Day 30', render: (v: number) => formatINR(v) },
    { key: 'safeDaily', label: 'Safe / day', render: (v: number) => formatINR(v) },
    { key: 'minClosing', label: 'Lowest point', render: (v: number) => formatINR(v) },
    { key: 'shortfallDays', label: 'Short days', render: (v: number) => `${v}` },
    { key: 'riskLevel', label: 'Risk', render: (v: string) => v },
  ] as const;

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card pb-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Option
            </th>
            {columns.map((c) => (
              <th key={c.key} className="pb-2 pr-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={cn('align-top', row.winner && 'bg-status-lime/5')}>
              <td
                className={cn(
                  'sticky left-0 z-10 border-t border-border/70 py-2.5 pr-3',
                  row.winner ? 'bg-[hsl(var(--surface-2))]' : 'bg-card',
                )}
              >
                <div className="flex items-center gap-1.5">
                  {row.winner ? (
                    <Crown className="size-3.5 shrink-0 text-status-lime" aria-label="Best option" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.note}</p>
                  </div>
                </div>
              </td>
              {columns.map((c) => {
                const value = row[c.key] as never;
                const negative = c.key === 'shortfallDays' ? (value as number) > 0 : false;
                const bad = c.key === 'endClosing' || c.key === 'minClosing' || c.key === 'safeDaily' ? (value as number) < 0 : false;
                return (
                  <td
                    key={c.key}
                    className={cn(
                      'border-t border-border/70 py-2.5 pr-3 text-right tnum',
                      negative && 'text-status-red',
                      bad && 'text-status-red',
                      c.key === 'riskLevel' && 'font-semibold capitalize',
                    )}
                  >
                    {c.render(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BeforeAfter({
  actions,
  onClear,
}: {
  actions: ScenarioAction[];
  onClear: () => void;
}) {
  const data = useAppData();
  const today = useStore((s) => s.today);
  const evaluation = React.useMemo(
    () => evaluateScenario(data, actions, today),
    [data, actions, today],
  );
  const before = useDerived();
  const styles = levelClasses(evaluation.risk.level);
  const endChange = evaluation.forecast.endClosing - before.forecast.endClosing;
  const dayChange = evaluation.allowance.daily - before.allowance.daily;

  return (
    <Card className={cn('border-primary/30', actions.length === 0 && 'opacity-70')}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Before / after</CardTitle>
            <CardDescription>
              {actions.length === 0 ? 'Nothing selected yet' : `${actions.length} change${actions.length === 1 ? '' : 's'} staged`}
            </CardDescription>
          </div>
          {actions.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={onClear}>
              <Trash2 /> Clear
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-surface-2/40 p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Now</p>
            <p className="mt-1 text-2xl font-extrabold tnum">{formatINR(before.allowance.daily)}</p>
            <p className="text-[11px] text-muted-foreground">safe to spend today</p>
            <p className="mt-2 text-sm tnum">
              Day 30: <Money paise={before.forecast.endClosing} tone={before.forecast.endClosing < 0 ? 'negative' : 'positive'} />
            </p>
          </div>
          <div className={cn('rounded-lg border p-3', styles.bg, styles.border)}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">After</p>
            <p className={cn('mt-1 text-2xl font-extrabold tnum', styles.text)}>
              {formatINR(evaluation.allowance.daily)}
            </p>
            <p className="text-[11px] text-muted-foreground">safe to spend today</p>
            <p className="mt-2 text-sm tnum">
              Day 30:{' '}
              <Money paise={evaluation.forecast.endClosing} tone={evaluation.forecast.endClosing < 0 ? 'negative' : 'positive'} />
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Badge tone={dayChange >= 0 ? 'lime' : 'red'}>
            {formatINR(dayChange, { sign: true })} per day
          </Badge>
          <Badge tone={endChange >= 0 ? 'lime' : 'red'}>
            {formatINR(endChange, { sign: true })} on day 30
          </Badge>
          {evaluation.forecast.shortfallDays !== before.forecast.shortfallDays ? (
            <Badge tone={evaluation.forecast.shortfallDays < before.forecast.shortfallDays ? 'lime' : 'red'}>
              {evaluation.forecast.shortfallDays - before.forecast.shortfallDays} short days
            </Badge>
          ) : null}
        </div>

        <ForecastChart
          height={200}
          showReserve={false}
          series={[
            { key: 'base', label: 'Now', forecast: before.forecast, color: 'hsl(var(--muted-foreground))', dashed: true },
            { key: 'scenario', label: 'After', forecast: evaluation.forecast, color: 'hsl(var(--primary))' },
          ]}
        />

        {actions.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {actions.map((action) => (
              <li key={action.actionId} className="flex items-center gap-2 rounded-md bg-surface-2/50 px-2.5 py-1.5 text-xs">
                <Sparkles className="size-3 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{describeAction(action)}</span>
                <button
                  type="button"
                  aria-label="Remove change"
                  className="ml-auto shrink-0 text-muted-foreground hover:text-status-red"
                  onClick={() => onClear()}
                >
                  <Minus className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          Preview only. Nothing is saved until you apply it, and applying happens exactly once.
        </p>
      </CardContent>
    </Card>
  );
}

export function Simulator() {
  const data = useAppData();
  const today = useStore((s) => s.today);
  const applyScenarioActions = useStore((s) => s.applyScenarioActions);

  const presets = React.useMemo(() => buildPresets(data, today), [data, today]);
  const [custom, setCustom] = React.useState<ScenarioAction[]>([]);
  const [form, setForm] = React.useState({ title: '', amount: '', date: addDays(today, 1), category: 'entertainment' });
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const variants: ScenarioVariant[] = React.useMemo(() => {
    const list = presets.map((p) => ({ ...p, actions: [...p.actions, ...custom] }));
    list.push({
      id: 'all-presets',
      name: 'Everything above, together',
      blurb: 'All preset changes at once',
      actions: presets.flatMap((p) => p.actions).concat(custom),
    });
    if (custom.length > 0) {
      list.unshift({
        id: 'custom-only',
        name: 'Only my changes',
        blurb: 'The custom change without the presets',
        actions: custom,
      });
    }
    return list;
  }, [presets, custom]);

  const comparison = React.useMemo(() => compareScenarios(data, variants, today), [data, variants, today]);

  const addCustom = () => {
    const amount = parseAmount(form.amount);
    if (!form.title.trim() || amount === null) {
      toast.error('Add a name and an amount first');
      return;
    }
    setCustom([
      ...custom,
      {
        kind: 'add-item',
        actionId: uid('act'),
        item: {
          title: form.title.trim(),
          amount,
          kind: 'expense',
          category: form.category as never,
          date: form.date,
          essential: false,
        },
      },
    ]);
    setForm({ ...form, title: '', amount: '' });
    toast.success('Change staged', { description: 'It is a preview until you apply it.' });
  };

  const apply = () => {
    const ok = applyScenarioActions(uid('commit'), custom);
    if (ok) {
      setCustom([]);
      setConfirmOpen(false);
      toast.success('Applied to your plan', { description: 'Every screen now uses the new numbers.' });
    } else {
      toast.message('Already applied', { description: 'That change was committed once already.' });
      setConfirmOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
        <CardContent className="flex flex-col gap-2 p-4">
          <p className="text-sm font-bold">Every decision has a day-30 number.</p>
          <p className="text-sm text-muted-foreground">
            Pick a preset or build your own. The preview never touches your real plan until you press apply.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preset decisions</CardTitle>
            <CardDescription>Built from what is actually in your plan right now</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setCustom([...custom, ...preset.actions])}
                className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="text-sm font-bold">{preset.name}</span>
                <span className="text-xs text-muted-foreground">{preset.blurb}</span>
              </button>
            ))}
            {presets.length === 0 ? (
              <EmptyState title="No presets yet" body="Add a few expenses and the simulator will have real options to offer." />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Build your own</CardTitle>
            <CardDescription>Stage a one-off expense and watch the month reshape</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field label="What is it" htmlFor="sim-title">
              <Input
                id="sim-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Concert tickets"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" htmlFor="sim-amount">
                <AmountInput
                  id="sim-amount"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                />
              </Field>
              <Field label="On" htmlFor="sim-date">
                <Input id="sim-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
            </div>
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['entertainment', 'shopping', 'food', 'transport', 'education', 'health'].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c[0].toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button onClick={addCustom} className="flex-1">
                Stage this change
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const ids = data.items.filter((i) => i.kind === 'expense' && i.status !== 'paid');
                  if (ids.length === 0) return;
                  setCustom((prev) => [
                    ...prev,
                    ...ids.map((item) => ({ kind: 'remove-item' as const, actionId: uid('drop'), itemId: item.id })),
                  ]);
                }}
                disabled={!data.items.some((i) => i.kind === 'expense' && i.status !== 'paid')}
              >
                Drop all upcoming
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Staged changes: {custom.length}. They apply together, once.
            </p>
          </CardContent>
        </Card>
      </div>

      <BeforeAfter actions={custom} onClear={() => setCustom([])} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-primary" aria-hidden />
            Compare the options
          </CardTitle>
          <CardDescription>Same starting point, different decisions. Winner takes the highest day-30 balance.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ComparisonTable rows={comparison.rows} />
          <ForecastChart
            height={240}
            series={[
              { key: 'base', label: 'Do nothing', forecast: comparison.baseline.forecast, color: 'hsl(var(--muted-foreground))', dashed: true },
              ...comparison.rows.slice(0, 3).map((row, i) => ({
                key: 'scenario',
                label: row.name,
                forecast: row.derived.forecast,
                color: ['hsl(var(--primary))', 'hsl(var(--status-lime))', 'hsl(var(--status-sky))'][i],
              })),
            ]}
          />
          <p className="text-[11px] text-muted-foreground">
            Charts overlay the first three options. The dashed line is your plan as it stands.
          </p>
        </CardContent>
      </Card>

      <div className="sticky bottom-24 z-30 lg:bottom-6">
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 shadow-card backdrop-blur">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {custom.length === 0 ? 'Nothing staged' : `Apply ${custom.length} change${custom.length === 1 ? '' : 's'}`}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {custom.length === 0 ? 'Stage a preset or a custom change first' : describeAction(custom[0])}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setCustom([])} disabled={custom.length === 0}>
              Reset
            </Button>
            <Button size="sm" disabled={custom.length === 0} onClick={() => setConfirmOpen(true)}>
              Apply to my plan
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply these changes for real?</DialogTitle>
            <DialogDescription>
              Your items, goals and settings are updated once. The forecast, allowance and risk will
              recalculate from the new state.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {custom.map((action) => (
              <li key={action.actionId} className="rounded-md bg-surface-2/50 px-2.5 py-1.5 text-xs">
                {describeAction(action)}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Not yet
            </Button>
            <Button onClick={apply}>Apply once</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}