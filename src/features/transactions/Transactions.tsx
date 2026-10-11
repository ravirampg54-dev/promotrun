import * as React from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Check, Copy, Filter, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useStore } from '@/store/store';
import type { ItemDraft } from '@/store/store';
import { EMPTY_FILTER, findDuplicate, filterItems, sortItems } from '@/store/selectors';
import type { ItemFilter, ItemSort } from '@/store/selectors';
import { CATEGORIES, categoryLabel, isEssentialCategory } from '@/engine/categories';
import { formatDayLabel, todayISO } from '@/engine/dates';
import { formatINR, formatINREditable, parseAmount } from '@/engine/money';
import type { CategoryId, Item } from '@/engine/types';
import { itemSchema } from '@/schemas';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { AmountInput, Field, Input, Textarea } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@/components/ui/controls';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

/**
 * The form always holds strings (amounts are typed as text). Zod converts the
 * amount into integer paise on submit — that is why the resolver is adapted.
 */
interface FormValues {
  title: string;
  amount: string;
  kind: 'income' | 'expense';
  category: string;
  date: string;
  status: 'scheduled' | 'paid';
  recurring: boolean;
  interval: number;
  essential: boolean;
  note?: string;
}

function ItemForm({ item, open, onClose }: { item: Item | null; open: boolean; onClose: () => void }) {
  const addItem = useStore((s) => s.addItem);
  const updateItem = useStore((s) => s.updateItem);
  const allItems = useStore((s) => s.items);
  const today = useStore((s) => s.today);

  const form = useForm<FormValues>({
    // zod transforms paise strings into numbers; the form only ever holds strings
    resolver: zodResolver(itemSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      title: item?.title ?? '',
      amount: item ? formatINREditable(item.amount) : '',
      kind: item?.kind ?? 'expense',
      category: item?.category ?? 'food',
      date: item?.date ?? today ?? todayISO(),
      status: item?.status ?? 'scheduled',
      recurring: item?.recurring ?? false,
      interval: item?.recurrence?.interval ?? 1,
      essential: item?.essential ?? false,
      note: item?.note ?? '',
    },
    mode: 'onBlur',
  });

  const kind = form.watch('kind');
  const recurring = form.watch('recurring');

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      title: item?.title ?? '',
      amount: item ? formatINREditable(item.amount) : '',
      kind: item?.kind ?? 'expense',
      category: item?.category ?? 'food',
      date: item?.date ?? today,
      status: item?.status ?? 'scheduled',
      recurring: item?.recurring ?? false,
      interval: item?.recurrence?.interval ?? 1,
      essential: item?.essential ?? false,
      note: item?.note ?? '',
    });
  }, [open, item, today, form]);

  const onSubmit = form.handleSubmit((values) => {
    const amount = parseAmount(values.amount);
    if (amount === null) return;
    const categoryId = values.category as CategoryId;
    const draft: ItemDraft = {
      id: item?.id,
      createdAt: item?.createdAt,
      title: values.title.trim(),
      amount,
      kind: values.kind,
      category: categoryId,
      date: values.date,
      status: values.status,
      recurring: values.recurring,
      recurrence: values.recurring
        ? {
            type: 'monthly',
            startDate: values.date,
            interval: values.interval ?? 1,
            endDate: null,
            cancelledFrom: null,
            paused: false,
          }
        : null,
      essential: values.kind === 'income' ? false : values.essential || isEssentialCategory(categoryId),
      note: values.note,
    };

    const duplicate = findDuplicate(allItems, draft);
    if (duplicate) {
      form.setError('title', {
        message: `Looks like the same entry as “${duplicate.title}” on ${formatDayLabel(duplicate.date)}.`,
      });
      return;
    }

    if (item) {
      updateItem(item.id, draft);
      toast.success('Entry updated', { description: `${draft.title} · ${formatINR(amount)}` });
    } else {
      addItem(draft);
      toast.success('Entry added', { description: `${draft.title} · ${formatINR(amount)}` });
    }
    onClose();
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit entry' : 'Add an entry'}</DialogTitle>
          <DialogDescription>
            Amounts are stored in paise, so ₹33.33 stays ₹33.33 forever.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="What was it" htmlFor="title" error={form.formState.errors.title?.message}>
            <Input
              id="title"
              autoFocus
              value={form.watch('title')}
              onChange={(e) => form.setValue('title', e.target.value, { shouldValidate: true })}
              placeholder="Evening chai"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" htmlFor="amount" error={form.formState.errors.amount?.message}>
              <AmountInput
                id="amount"
                value={form.watch('amount')}
                onChange={(e) => form.setValue('amount', e.target.value, { shouldValidate: true })}
                placeholder="0"
              />
            </Field>
            <Field label="Date" htmlFor="date" error={form.formState.errors.date?.message}>
              <Input
                id="date"
                type="date"
                value={form.watch('date')}
                onChange={(e) => form.setValue('date', e.target.value, { shouldValidate: true })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={form.watch('kind')}
                onValueChange={(v) => {
                  form.setValue('kind', v as 'income' | 'expense');
                  form.setValue('category', v === 'income' ? 'income' : 'food');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category" error={form.formState.errors.category?.message}>
              <Select value={form.watch('category')} onValueChange={(v) => form.setValue('category', v as CategoryId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => (kind === 'income' ? c.id === 'income' : c.id !== 'income')).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-semibold">Repeats</p>
              <p className="text-xs text-muted-foreground">Monthly until you cancel it</p>
            </div>
            <Switch checked={recurring} onCheckedChange={(v) => form.setValue('recurring', v)} />
          </div>

          {recurring ? (
            <Field label="Every" htmlFor="interval">
              <Select
                value={String(form.watch('interval') ?? 1)}
                onValueChange={(v) => form.setValue('interval', Number(v))}
              >
                <SelectTrigger id="interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 6, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 1 ? 'Every month' : `Every ${n} months`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {kind === 'expense' ? (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-semibold">Essential</p>
                <p className="text-xs text-muted-foreground">
                  Essentials are protected before your allowance is worked out
                </p>
              </div>
              <Switch checked={Boolean(form.watch('essential'))} onCheckedChange={(v) => form.setValue('essential', v)} />
            </div>
          ) : null}

          <Field label="Status">
            <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as 'paid' | 'scheduled')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Note (optional)" htmlFor="note">
            <Textarea id="note" value={form.watch('note') ?? ''} onChange={(e) => form.setValue('note', e.target.value)} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{item ? 'Save changes' : 'Add entry'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Transactions() {
  const items = useStore((s) => s.items);
  const togglePaid = useStore((s) => s.togglePaid);
  const removeItem = useStore((s) => s.removeItem);
  const duplicateItem = useStore((s) => s.duplicateItem);
  const emergency = useStore((s) => s.emergencyMode);
  const confirm = useConfirm();
  const today = useStore((s) => s.today);

  const [filter, setFilter] = React.useState<ItemFilter>(EMPTY_FILTER);
  const [sort, setSort] = React.useState<ItemSort>('date-desc');
  const [editing, setEditing] = React.useState<Item | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);

  const visible = React.useMemo(() => {
    const filtered = filterItems(items, filter).filter((i) => !emergency || i.essential || i.kind === 'income');
    return sortItems(filtered, sort);
  }, [items, filter, sort, emergency]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of visible) {
      const list = map.get(item.date);
      if (list) list.push(item);
      else map.set(item.date, [item]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  const totals = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const item of visible) {
      if (item.kind === 'income') income += item.amount;
      else expense += item.amount;
    }
    return { income, expense };
  }, [visible]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search entries…"
                value={filter.query}
                onChange={(e) => setFilter({ ...filter, query: e.target.value })}
                aria-label="Search entries"
              />
            </div>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus /> Add
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter.kind} onValueChange={(v) => setFilter({ ...filter, kind: v as ItemFilter['kind'] })}>
              <SelectTrigger className="h-9 w-auto min-w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v as ItemFilter['status'] })}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as ItemSort)}>
              <SelectTrigger className="h-9 w-auto min-w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest first</SelectItem>
                <SelectItem value="date-asc">Oldest first</SelectItem>
                <SelectItem value="amount-desc">Largest first</SelectItem>
                <SelectItem value="amount-asc">Smallest first</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFilter(EMPTY_FILTER)}
              disabled={filter.query === '' && filter.kind === 'all' && filter.status === 'all' && filter.categories.length === 0}
            >
              <X /> Clear
            </Button>
            <div className="ml-auto flex items-center gap-3 text-xs font-semibold tnum">
              <span className="text-status-lime">+{formatINR(totals.income)} in</span>
              <span className="text-status-red">−{formatINR(totals.expense)} out</span>
            </div>
          </div>

          {filter.categories.length === 0 ? (
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-1">
              <Filter className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {CATEGORIES.filter((c) => c.id !== 'income').map((c) => {
                const active = filter.categories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setFilter({
                        ...filter,
                        categories: active
                          ? filter.categories.filter((x) => x !== c.id)
                          : [...filter.categories, c.id],
                      })
                    }
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                      active ? 'border-primary/40 bg-primary/12 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? 'No entries yet' : 'Nothing matches those filters'}
          body={
            items.length === 0
              ? 'Add what you have already spent, and what is still to come. The forecast needs both.'
              : 'Try clearing the search or the category filters.'
          }
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Add first entry
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([date, group]) => (
            <section key={date} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {date === today ? 'Today' : formatDayLabel(date)}
                </h3>
                <span className="text-xs tnum text-muted-foreground">
                  {formatINR(group.reduce((acc, i) => acc + (i.kind === 'income' ? i.amount : -i.amount), 0), { sign: true })}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {group.map((item) => (
                  <li
                    key={item.id}
                    className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-border/80"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: `hsl(${CATEGORIES.find((c) => c.id === item.category)?.hue ?? 258} 70% 55%)` }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-semibold', item.status === 'paid' && 'text-foreground')}>
                        {item.title}
                      </p>
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {categoryLabel(item.category)}
                        {item.recurring ? ' · repeats' : ''}
                        {item.essential ? ' · essential' : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={cn(
                          'text-sm font-bold tnum',
                          item.kind === 'income' ? 'text-status-lime' : 'text-foreground',
                        )}
                      >
                        {item.kind === 'income' ? '+' : '−'}
                        {formatINR(item.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          togglePaid(item.id);
                          toast(item.status === 'paid' ? 'Marked as unpaid' : 'Marked as paid', {
                            description: item.title,
                          });
                        }}
                        title={item.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                        className={cn(
                          'rounded-md border p-1.5 transition-colors',
                          item.status === 'paid'
                            ? 'border-status-lime/40 bg-status-lime/10 text-status-lime'
                            : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Check className="size-3.5" />
                      </button>
                    </div>
                    <div className="hidden shrink-0 items-center gap-1 group-hover:flex group-focus-within:flex">
                      <button
                        type="button"
                        aria-label={`Edit ${item.title}`}
                        onClick={() => {
                          setEditing(item);
                          setFormOpen(true);
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Duplicate ${item.title}`}
                        onClick={() => {
                          const id = duplicateItem(item.id);
                          if (id) toast.success('Duplicated', { description: 'Edit the copy to change it.' });
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${item.title}`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Delete “${item.title}”?`,
                            description: 'This removes it from the balance and the forecast. It cannot be undone.',
                            confirmLabel: 'Delete',
                            destructive: true,
                          });
                          if (ok) {
                            removeItem(item.id);
                            toast.success('Entry deleted');
                          }
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-status-red/15 hover:text-status-red"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {visible.length > 0 ? (
        <div className="flex justify-center">
          <Badge tone="neutral">
            {visible.length} entr{visible.length === 1 ? 'y' : 'ies'}
          </Badge>
        </div>
      ) : null}

      <ItemForm item={editing} open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}