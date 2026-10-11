import * as React from 'react';
import { toast } from 'sonner';
import { CalendarClock, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { useStore } from '@/store/store';
import { goalDelay, useDerived } from '@/store/selectors';
import { formatINR, formatINREditable, parseAmount } from '@/engine/money';
import { addDays, diffDays } from '@/engine/dates';
import { goalDelayEstimate } from '@/engine/scenarios';
import type { Goal } from '@/engine/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { AmountInput, Field, Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/controls';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { Progress } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

function GoalForm({
  goal,
  open,
  onClose,
}: {
  goal: Goal | null;
  open: boolean;
  onClose: () => void;
}) {
  const addGoal = useStore((s) => s.addGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const today = useStore((s) => s.today);
  const duration = useStore((s) => s.settings.durationDays);

  const [values, setValues] = React.useState({
    title: '',
    target: '',
    saved: '',
    deadline: addDays(today, duration),
    priority: 'medium',
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setValues({
      title: goal?.title ?? '',
      target: goal ? formatINREditable(goal.target) : '',
      saved: goal ? formatINREditable(goal.saved) : '0',
      deadline: goal?.deadline ?? addDays(today, duration),
      priority: goal?.priority ?? 'medium',
    });
  }, [open, goal, today, duration]);

  function submit() {
    const target = parseAmount(values.target);
    const saved = parseAmount(values.saved) ?? 0;
    if (!values.title.trim()) {
      setError('Name the goal');
      return;
    }
    if (target === null || target <= 0) {
      setError('Enter a target above ₹0');
      return;
    }
    if (!values.deadline) {
      setError('Pick a deadline');
      return;
    }
    const payload = {
      title: values.title.trim(),
      target,
      saved: Math.min(saved, target),
      deadline: values.deadline,
      priority: values.priority as Goal['priority'],
    };
    if (goal) {
      updateGoal(goal.id, payload);
      toast.success('Goal updated', { description: `${payload.title} · ${formatINR(target)}` });
    } else {
      addGoal(payload);
      toast.success('Goal created', { description: `${payload.title} · ${formatINR(target)}` });
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit goal' : 'New goal'}</DialogTitle>
          <DialogDescription>
            Saved money leaves your allowance but stays yours — the engine only protects it, never spends it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field label="What is it for" htmlFor="goal-title">
            <Input id="goal-title" autoFocus value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} placeholder="Course fee" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target" htmlFor="goal-target">
              <AmountInput id="goal-target" value={values.target} onChange={(e) => setValues({ ...values, target: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Already saved" htmlFor="goal-saved">
              <AmountInput id="goal-saved" value={values.saved} onChange={(e) => setValues({ ...values, saved: e.target.value })} />
            </Field>
          </div>
          <Field label="Deadline" htmlFor="goal-deadline">
            <Input id="goal-deadline" type="date" value={values.deadline} onChange={(e) => setValues({ ...values, deadline: e.target.value })} />
          </Field>
          <Field label="Priority">
            <Select value={values.priority} onValueChange={(v) => setValues({ ...values, priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {error ? (
            <p className="text-xs font-semibold text-status-red" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{goal ? 'Save' : 'Create goal'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Goals() {
  const derived = useDerived();
  const removeGoal = useStore((s) => s.removeGoal);
  const contributeGoal = useStore((s) => s.contributeGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const confirm = useConfirm();
  const today = useStore((s) => s.today);

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Goal | null>(null);
  const [contributions, setContributions] = React.useState<Record<string, string>>({});

  const totalSaved = derived.goals.reduce((acc, g) => acc + g.saved, 0);
  const totalTarget = derived.goals.reduce((acc, g) => acc + g.goal.target, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Set aside</p>
            <p className="text-3xl font-extrabold tnum">{formatINR(totalSaved)}</p>
            <p className="text-sm text-muted-foreground">of {formatINR(totalTarget)} across {derived.goals.length} goals</p>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus /> New goal
          </Button>
        </CardContent>
      </Card>

      {derived.goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          body="Goals are the part of the plan that pays for tomorrow. Add one and it starts pulling money out of your daily allowance."
          action={<Button onClick={() => setOpen(true)}>Create your first goal</Button>}
          icon={<Target className="size-5" />}
        />
      ) : (
        <div className="grid gap-3">
          {derived.goals.map((g) => {
            const delay = goalDelayEstimate(g.goal, today);
            const late = diffDays(today, g.goal.deadline) < 0 && !g.funded;
            const draft = contributions[g.goal.id] ?? '';

            return (
              <Card key={g.goal.id} className={cn(late && 'border-status-amber/35')}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 truncate font-bold">
                        {g.goal.title}
                        {g.funded ? <Badge tone="lime">funded</Badge> : null}
                        {late ? <Badge tone="amber">past deadline</Badge> : null}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {g.funded
                          ? 'Nothing left to add.'
                          : `${formatINR(g.remaining)} to go · ${g.daysLeft} day${g.daysLeft === 1 ? '' : 's'} left`}
                      </p>
                    </div>
                    <span className="text-right text-lg font-extrabold tnum">{Math.round(g.percent)}%</span>
                  </div>

                  <Progress
                    value={g.percent}
                    barClassName={g.funded ? 'bg-status-lime' : g.onTrack ? 'bg-primary' : 'bg-status-amber'}
                    aria-label={`${g.goal.title} funded`}
                  />

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg border p-2">
                      <p className="text-muted-foreground">Saved</p>
                      <p className="font-bold tnum">{formatINR(g.saved)}</p>
                    </div>
                    <div className="rounded-lg border p-2">
                      <p className="text-muted-foreground">Your rate</p>
                      <p className="font-bold tnum">{formatINR(g.currentRate)}/d</p>
                    </div>
                    <div className="rounded-lg border p-2">
                      <p className="text-muted-foreground">Needed</p>
                      <p className="font-bold tnum">{formatINR(g.requiredPerDay)}/d</p>
                    </div>
                  </div>

                  <p className="rounded-lg bg-surface-2/50 p-2.5 text-xs text-muted-foreground">
                    {delay.message}
                  </p>

                  {!g.funded ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-32">
                        <Field label="Add now">
                          <AmountInput
                            className="h-10 text-sm"
                            aria-label={`Add to ${g.goal.title}`}
                            value={draft}
                            onChange={(e) => setContributions((c) => ({ ...c, [g.goal.id]: e.target.value }))}
                            placeholder="0"
                          />
                        </Field>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          const value = parseAmount(draft);
                          if (value === null || value <= 0) {
                            toast.error('Enter an amount above ₹0');
                            return;
                          }
                          contributeGoal(g.goal.id, value);
                          setContributions((c) => ({ ...c, [g.goal.id]: '' }));
                          toast.success(`${formatINR(value)} added to ${g.goal.title}`);
                        }}
                      >
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const suggest = g.requiredPerDay;
                          contributeGoal(g.goal.id, suggest);
                          toast.success(`Added ${formatINR(suggest)} — exactly what today needs`);
                        }}
                      >
                        <TrendingUp className="size-3.5" /> Add what today needs ({formatINR(g.requiredPerDay)})
                      </Button>
                      <div className="ml-auto flex gap-1">
                        {delay.extraDays > 0 && Number.isFinite(delay.extraDays) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              updateGoal(g.goal.id, { deadline: addDays(g.goal.deadline, delay.extraDays) });
                              toast.success('Deadline moved', {
                                description: `Based on your real ${formatINR(delay.currentRate)}/day rate.`,
                              });
                            }}
                          >
                            <CalendarClock className="size-3.5" /> Move {delay.extraDays}d
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(g.goal); setOpen(true); }}>
                          Edit
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${g.goal.title}`}
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Delete “${g.goal.title}”?`,
                              description: `${formatINR(g.saved)} goes back into your spendable cash.`,
                              confirmLabel: 'Delete goal',
                              destructive: true,
                            });
                            if (ok) {
                              removeGoal(g.goal.id);
                              toast.success('Goal deleted');
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(g.goal); setOpen(true); }}>
                        Edit
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How the delay is calculated</CardTitle>
          <CardDescription>No fixed guess — it uses your real contribution rate</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="font-mono text-xs leading-relaxed">
            rate = saved ÷ days since the goal started
            <br />
            days needed = remaining ÷ rate
            <br />
            delay = days needed − days to the deadline
          </p>
          <p className="mt-3">
            Change what you put in, and every delay message updates with it. For example{' '}
            <span className="font-semibold text-foreground tnum">
              {derived.goals.length > 0 ? formatINR(goalDelay(derived.goals[0].goal, today).currentRate) : '₹0'}
            </span>
            {derived.goals.length > 0 ? ' /day is your current rate on ' : ''}
            {derived.goals.length > 0 ? derived.goals[0].goal.title : 'your first goal'}.
          </p>
        </CardContent>
      </Card>

      <GoalForm goal={editing} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
