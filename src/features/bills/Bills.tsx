import * as React from 'react';
import { toast } from 'sonner';
import { Check, Pause, Play, Trash2, Ban } from 'lucide-react';
import { useStore } from '@/store/store';
import { billRows, useDerived } from '@/store/selectors';
import { formatINR } from '@/engine/money';
import { formatDayLabel } from '@/engine/dates';
import { categoryLabel } from '@/engine/categories';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, EmptyState, Money } from '@/components/ui/primitives';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

export function Bills() {
  const items = useStore((s) => s.items);
  const today = useStore((s) => s.today);
  const updateItem = useStore((s) => s.updateItem);
  const removeItem = useStore((s) => s.removeItem);
  const derived = useDerived();
  const confirm = useConfirm();

  const rows = React.useMemo(() => billRows(items, today), [items, today]);
  const active = rows.filter((r) => r.status === 'active');
  const paused = rows.filter((r) => r.status === 'paused' || r.status === 'cancelled');
  const monthlyCost = active.reduce(
    (acc, r) => acc + (r.item.recurrence?.type === 'monthly' ? r.item.amount / (r.item.recurrence.interval ?? 1) : r.item.recurrence?.type === 'weekly' ? (r.item.amount * 52) / 12 / (r.item.recurrence.interval ?? 1) : 0),
    0,
  );
  const annualSaved = paused.reduce((acc, r) => acc + r.annualCost, 0);

  function togglePause(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const pausedNow = Boolean(item.recurrence?.paused);
    updateItem(id, {
      recurring: item.recurring,
      recurrence: item.recurrence ? { ...item.recurrence, paused: !pausedNow } : item.recurrence,
    });
    toast(pausedNow ? 'Resumed' : 'Paused', {
      description: pausedNow
        ? `${item.title} will charge again from ${formatDayLabel(item.date)}`
        : `${item.title} will not charge again. Past charges stay exactly as they were.`,
    });
  }

  function cancel(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    updateItem(id, {
      recurring: false,
      recurrence: item.recurrence ? { ...item.recurrence, cancelledFrom: today, paused: false } : null,
    });
    toast.success(`${item.title} cancelled`, {
      description: 'Future occurrences stop. Nothing already paid is touched.',
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Active commitments</p>
            <p className="text-2xl font-extrabold tnum">{active.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Monthly cost</p>
            <p className="text-2xl font-extrabold tnum">{formatINR(Math.round(monthlyCost))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unpaid essentials</p>
            <p className="text-2xl font-extrabold tnum">{formatINR(derived.balance.unpaidEssential)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Annual cost paused</p>
            <p className="text-2xl font-extrabold tnum text-status-lime">{formatINR(annualSaved)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coming up</CardTitle>
          <CardDescription>Next charge for everything still running</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {active.length === 0 ? (
            <EmptyState title="No recurring bills" body="Anything you add with a repeat schedule shows up here with its next charge date." />
          ) : (
            active.map((row) => (
              <BillRow
                key={row.item.id}
                row={row}
                today={today}
                onPay={() => {
                  updateItem(row.item.id, { status: 'paid' });
                  toast.success(`${row.item.title} marked paid`);
                }}
                onPause={() => togglePause(row.item.id)}
                onCancel={async () => {
                  const ok = await confirm({
                    title: `Cancel ${row.item.title}?`,
                    description: 'Future charges stop from today. Nothing already paid changes, and you can resume later.',
                    confirmLabel: 'Cancel it',
                    destructive: true,
                  });
                  if (ok) cancel(row.item.id);
                }}
                onDelete={async () => {
                  const ok = await confirm({
                    title: `Delete ${row.item.title}?`,
                    description: 'This removes the entry and every future occurrence from the forecast.',
                    confirmLabel: 'Delete',
                    destructive: true,
                  });
                  if (ok) {
                    removeItem(row.item.id);
                    toast.success('Removed');
                  }
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      {paused.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Paused &amp; cancelled</CardTitle>
            <CardDescription>
              Stopped, not deleted — the money you already spent still counts where it was spent.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {paused.map((row) => (
              <div key={row.item.id} className="flex items-center gap-3 rounded-lg border border-dashed p-3 opacity-80">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.item.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.status} · {categoryLabel(row.item.category)}
                  </p>
                </div>
                <span className="text-sm tnum text-muted-foreground">{formatINR(row.item.amount)}</span>
                <Button size="sm" variant="outline" onClick={() => togglePause(row.item.id)}>
                  <Play /> Resume
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>How cancellation works here</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Pause</span> stops future charges without
            changing the record of anything already paid.
          </p>
          <p>
            <span className="font-semibold text-foreground">Cancel</span> stops occurrences from today
            onward. Charges that already happened stay in your balance exactly where they were.
          </p>
          <p>
            <span className="font-semibold text-foreground">Delete</span> is the only destructive option —
            it removes the entry from the forecast entirely.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BillRow({
  row,
  today,
  onPay,
  onPause,
  onCancel,
  onDelete,
}: {
  row: ReturnType<typeof billRows>[number];
  today: string;
  onPay: () => void;
  onPause: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const overdue = row.item.date < today && row.item.status !== 'paid';
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border p-3',
        overdue && 'border-status-red/40 bg-status-red/5',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{row.item.title}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{categoryLabel(row.item.category)}</span>
          <span>·</span>
          <span>{row.cadence}</span>
          {row.nextDate ? (
            <>
              <span>· next {formatDayLabel(row.nextDate)}</span>
            </>
          ) : null}
          {row.item.essential ? <Badge tone="neutral">essential</Badge> : null}
          {overdue ? <Badge tone="red">overdue</Badge> : null}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold tnum">{formatINR(row.item.amount)}</p>
        {row.annualCost > 0 ? (
          <p className="text-[11px] text-muted-foreground tnum">{formatINR(row.annualCost)}/yr</p>
        ) : null}
      </div>
      <div className="flex w-full gap-1.5 sm:w-auto">
        <Button
          size="sm"
          variant={row.item.status === 'paid' ? 'subtle' : 'default'}
          onClick={onPay}
          aria-pressed={row.item.status === 'paid'}
        >
          <Check /> {row.item.status === 'paid' ? 'Paid' : 'Mark paid'}
        </Button>
        <Button size="icon-sm" variant="outline" onClick={onPause} aria-label={`Pause ${row.item.title}`}>
          <Pause />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={onCancel} aria-label={`Cancel ${row.item.title}`}>
          <Ban />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label={`Delete ${row.item.title}`}>
          <Trash2 />
        </Button>
      </div>
      <span className="sr-only">
        <Money paise={row.item.amount} />
      </span>
    </div>
  );
}