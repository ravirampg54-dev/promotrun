import { toast } from 'sonner';
import { Database, Download, FlaskConical, Moon, RotateCcw, Sun, Trash2 } from 'lucide-react';
import { useStore } from '@/store/store';
import { useDerived } from '@/store/selectors';
import { budgetToCsv, downloadFile, goalsToCsv, itemsToCsv } from '@/store/export';
import { addDays, formatDayLabel } from '@/engine/dates';
import { formatINR } from '@/engine/money';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { AmountInput, Field, Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@/components/ui/controls';
import { Badge, Divider } from '@/components/ui/primitives';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

export function Settings() {
  const store = useStore();
  const derived = useDerived();
  const confirm = useConfirm();
  const data = {
    settings: store.settings,
    items: store.items,
    goals: store.goals,
    budget: store.budget,
    profile: store.profile,
  };

  const update = store.updateSettings;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Assumptions</CardTitle>
          <CardDescription>
            These four numbers drive everything else. Change one and watch the whole app move.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Opening balance" htmlFor="opening" hint="Cash on day 1">
              <AmountInput
                id="opening"
                value={String(store.settings.openingBalance / 100)}
                onChange={(e) => update({ openingBalance: Math.round(Number(e.target.value || 0) * 100) })}
              />
            </Field>
            <Field label="Emergency reserve" htmlFor="reserve" hint="Never spent by the plan">
              <AmountInput
                id="reserve"
                value={String(store.settings.reserveTarget / 100)}
                onChange={(e) => update({ reserveTarget: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })}
              />
            </Field>
            <Field label="Planned income for the run" htmlFor="planned" hint="Used by the budget planner">
              <AmountInput
                id="planned"
                value={String(store.settings.plannedIncome / 100)}
                onChange={(e) => update({ plannedIncome: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })}
              />
            </Field>
            <Field label="Comfort line for daily spending" htmlFor="floor" hint="Below this you get a Moderate warning">
              <AmountInput
                id="floor"
                value={String(store.settings.allowanceFloor / 100)}
                onChange={(e) => update({ allowanceFloor: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })}
              />
            </Field>
            <Field label="Run length" htmlFor="duration">
              <Select value={String(store.settings.durationDays)} onValueChange={(v) => update({ durationDays: Number(v) })}>
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[7, 14, 30, 45, 60, 90].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Run starts" htmlFor="start" hint="Day 1 of the plan">
              <Input
                id="start"
                type="date"
                value={store.settings.startDate}
                onChange={(e) => update({ startDate: e.target.value })}
              />
            </Field>
          </div>
          <div className="rounded-lg border bg-surface-2/40 p-3 text-xs text-muted-foreground">
            Run: {formatDayLabel(store.settings.startDate)} → {formatDayLabel(addDays(store.settings.startDate, store.settings.durationDays - 1))}
            {' · '}safe to spend today {formatINR(derived.allowance.daily)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Look at another day</CardTitle>
          <CardDescription>
            Move the clock forward or back to see how the plan behaves mid-month. Your entries stay
            exactly where they are.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[-7, -1, 1, 7].map((d) => (
              <Button key={d} size="sm" variant="outline" onClick={() => store.jumpDays(d)}>
                {d > 0 ? `+${d}` : d} day{d > 0 ? 's' : 's'}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => store.setToday(new Date().toISOString().slice(0, 10))}>
              Back to real today
            </Button>
            <Badge tone="primary" className="ml-auto">
              Viewing {formatDayLabel(derived.today)} · day {derived.dayNumber}
            </Badge>
          </div>
          {store.today !== new Date().toISOString().slice(0, 10) ? (
            <p className="text-xs font-semibold text-status-amber">
              You are previewing a different day. Nothing is saved until you edit an entry.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => update({ theme: store.settings.theme === 'dark' ? 'light' : 'dark' })}
            className="flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-surface-2"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              {store.settings.theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
              {store.settings.theme === 'dark' ? 'Dark' : 'Light'} theme
            </span>
            <Badge tone="neutral">switch</Badge>
          </button>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Database className="size-4" /> Reduce motion
            </span>
            <Switch checked={!store.settings.motion} onCheckedChange={(v) => update({ motion: !v })} />
          </div>
          <p className="text-xs text-muted-foreground">
            The app also honours your system <span className="font-mono">prefers-reduced-motion</span> setting.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>Everything lives in this browser. Export it any time.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              variant="outline"
              onClick={() => {
                downloadFile('rupee10k-transactions.csv', itemsToCsv(data));
                toast.success('Transactions exported');
              }}
            >
              <Download /> Transactions
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadFile('rupee10k-goals.csv', goalsToCsv(data));
                toast.success('Goals exported');
              }}
            >
              <Download /> Goals
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadFile('rupee10k-budget.csv', budgetToCsv(data));
                toast.success('Budget exported');
              }}
            >
              <Download /> Budget
            </Button>
          </div>
          <div className="rounded-lg border bg-surface-2/40 p-3 text-xs text-muted-foreground">
            {store.items.length} entries · {store.goals.length} goals · {store.budget.length} budget lines
            {store.lastSavedAt ? ` · last saved ${new Date(store.lastSavedAt).toLocaleString()}` : ''}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demo &amp; reset</CardTitle>
          <CardDescription>Destructive actions always ask first.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const ok = await confirm({
                title: 'Load the demo data?',
                description: 'Your current entries, goals and budget will be replaced with the sample month.',
                confirmLabel: 'Load demo',
              });
              if (ok) {
                store.loadDemo();
                toast.success('Demo data loaded');
              }
            }}
          >
            <FlaskConical /> Load demo data
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              store.startFreshRun();
              toast.success('New run started', { description: 'Entries kept, assumptions reset to ₹10,000.' });
            }}
          >
            <RotateCcw /> Start a fresh 30-day run
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              const ok = await confirm({
                title: 'Erase everything?',
                description: 'Every entry, goal and setting is deleted from this browser. There is no backup.',
                confirmLabel: 'Erase it all',
                destructive: true,
              });
              if (ok) {
                store.resetAll();
                toast.success('Everything cleared');
              }
            }}
          >
            <Trash2 /> Erase all data
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How the numbers work</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <Divider label="Formulas" />
          <p className="font-mono text-xs leading-relaxed">
            currentBalance = opening + income received − expenses paid
            <br />
            projectedBalance = currentBalance + future income − future discretionary spend
            <br />
            protectedFunds = reserve + unpaid essentials
            <br />
            safeDaily = (projectedBalance − goalSavings − protectedFunds) ÷ remainingDays
            <br />
            daily closing = opening + income − expenses, chained day to day
          </p>
          <Divider label="Rules" />
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>Budget allocations never move real cash.</li>
            <li>Savings transfers are not expenses — they only remove money from the allowance.</li>
            <li>Reserved bills are protected now and subtracted when they are paid.</li>
            <li>Cancelled items keep everything already paid and stop future occurrences.</li>
            <li>All money is stored as integer paise, so ₹33.33 stays ₹33.33.</li>
          </ul>
        </CardContent>
      </Card>

      <p className={cn('text-center text-xs text-muted-foreground')}>
        {store.profile.name ? `Built for ${store.profile.name}` : 'Built for people living on a fixed amount'} · v1.0
      </p>
    </div>
  );
}