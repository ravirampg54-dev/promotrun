import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import { formatINR } from '@/engine/money';
import { formatDayLabel } from '@/engine/dates';
import { useStore } from '@/store/store';
import { useDerived, levelClasses } from '@/store/selectors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, EmptyState, Money, RiskBadge, Stat } from '@/components/ui/primitives';
import { Sparkline } from '@/components/charts/ForecastChart';
import { CategoryDoughnut } from '@/components/charts/CategoryCharts';
import { Progress } from '@/components/ui/controls';
import { cn } from '@/lib/utils';

function HeroCard() {
  const derived = useDerived();
  const settings = useStore((s) => s.settings);
  const styles = levelClasses(derived.risk.level);
  const emergency = useStore((s) => s.emergencyMode);
  const allowance = derived.allowance;
  const poolShare =
    allowance.discretionaryPool + derived.balance.protectedTotal > 0
      ? (allowance.discretionaryPool /
          (allowance.discretionaryPool + derived.balance.protectedTotal)) *
        100
      : 0;

  return (
    <Card className="relative overflow-hidden border-primary/25">
      <div className="grain pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div
        className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Safe to spend today
            </p>
            <p
              className={cn(
                'mt-1 text-5xl font-extrabold leading-none tnum',
                allowance.daily === 0 ? styles.text : 'text-foreground',
              )}
            >
              {formatINR(allowance.daily, { paise: true })}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {allowance.daily === 0
                ? emergency
                  ? 'Emergency mode is on — essentials only.'
                  : 'Everything left is already committed.'
                : `${formatINR(allowance.discretionaryPool)} free across ${derived.remainingDays} day${
                    derived.remainingDays === 1 ? '' : 's'
                  }.`}
            </p>
          </div>
          <RiskBadge level={derived.risk.level} />
        </div>
      </CardHeader>

      <CardContent className="relative flex flex-col gap-4">
        <Sparkline forecast={derived.forecast} />

        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground">Free today</span>
            <span className="text-muted-foreground">Protected</span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="bg-primary transition-[width] duration-500"
              style={{ width: `${Math.max(0, Math.min(100, poolShare))}%` }}
            />
            <div
              className="bg-surface-3 transition-[width] duration-500"
              style={{ width: `${100 - Math.max(0, Math.min(100, poolShare))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tnum">
              {formatINR(allowance.discretionaryPool)}
            </span>{' '}
            spendable ·{' '}
            <span className="font-semibold text-foreground tnum">
              {formatINR(derived.balance.protectedTotal)}
            </span>{' '}
            spoken for
          </p>
        </div>

        <div className="grid gap-3 border-t pt-4 sm:grid-cols-3">
          <Stat
            label="In your pocket"
            value={<Money paise={derived.balance.currentBalance} />}
            hint={`${formatINR(derived.balance.incomeReceived)} in · ${formatINR(
              derived.balance.expensesPaid,
            )} out`}
          />
          <Stat
            label="Left on day 30"
            value={<Money paise={derived.forecast.endClosing} tone={derived.forecast.endClosing < 0 ? 'negative' : 'positive'} />}
            hint={`lowest ${formatINR(derived.forecast.minClosing)}`}
          />
          <Stat
            label="Comfort line"
            value={formatINR(settings.allowanceFloor)}
            hint={allowance.isBelowFloor ? 'you are below it' : 'you are above it'}
            tone={allowance.isBelowFloor ? 'negative' : 'positive'}
          />
        </div>

        <div className="rounded-lg bg-surface-2/60 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Why this number
          </p>
          <p className="font-mono text-xs leading-relaxed text-muted-foreground">
            {allowance.formula} = {formatINR(allowance.daily)}
          </p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {derived.balance.breakdown.map((slice) => (
              <li key={slice.id} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{slice.label}</span> — {slice.detail}
                </span>
                <span className="shrink-0 font-semibold tnum">{formatINR(slice.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function TodayList() {
  const derived = useDerived();
  const togglePaid = useStore((s) => s.togglePaid);
  const emergency = useStore((s) => s.emergencyMode);
  const allItems = useStore((s) => s.items);
  const day = derived.forecast.days.find((d) => d.isToday);
  const items = (day?.items ?? []).filter((i) => i.kind === 'expense');
  const byId = new Map(allItems.map((i) => [i.id, i]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" aria-hidden />
          Due today
        </CardTitle>
        <CardDescription>{formatDayLabel(derived.today)} · {items.length} item{items.length === 1 ? '' : 's'}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? (
          <EmptyState title="Nothing due today" body="No money leaves the account today. That is allowed." />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => {
              const source = byId.get(item.itemId);
              const hidden = emergency && !item.essential;
              return (
                <li
                  key={`${item.itemId}-${item.date}`}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-2.5',
                    hidden && 'opacity-50',
                    item.overdue && 'border-status-red/40 bg-status-red/5',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.essential ? 'Essential' : 'Discretionary'}
                      {item.overdue ? ' · already overdue' : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold tnum">{formatINR(item.amount)}</span>
                  <button
                    type="button"
                    onClick={() => source && togglePaid(source.id)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-[11px] font-bold transition-colors',
                      source?.status === 'paid'
                        ? 'border-status-lime/40 bg-status-lime/10 text-status-lime'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary',
                    )}
                  >
                    {source?.status === 'paid' ? 'Paid' : 'Mark paid'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RiskCard() {
  const derived = useDerived();
  const styles = levelClasses(derived.risk.level);
  const top = derived.risk.warnings[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          Risk right now
        </CardTitle>
        <CardDescription>{derived.risk.headline}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {derived.risk.warnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No warnings. Every essential is covered and your allowance is above the line you set.
          </p>
        ) : (
          derived.risk.warnings.slice(0, 2).map((w) => (
            <div key={w.id} className={cn('rounded-lg border p-3', styles.bg, styles.border)}>
              <p className={cn('text-sm font-bold', styles.text)}>{w.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{w.whatChanged}</p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground/90">{w.calculation}</p>
              <p className="mt-2 text-xs font-semibold">{w.nextStep}</p>
            </div>
          ))
        )}
        <Link
          to="/health"
          className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          See all {derived.risk.warnings.length} warning{derived.risk.warnings.length === 1 ? '' : 's'} <ArrowRight className="size-3.5" />
        </Link>
        {top ? <span className="sr-only">{top.whyItMatters}</span> : null}
      </CardContent>
    </Card>
  );
}

function SpendingCard() {
  const derived = useDerived();
  const emergency = useStore((s) => s.emergencyMode);
  const rows = derived.categoryRows.filter(
    (r) => r.spent > 0 && (!emergency || r.essential),
  );
  const spent = rows.reduce((acc, r) => acc + r.spent, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="size-4 text-primary" aria-hidden />
          Where it went
        </CardTitle>
        <CardDescription>
          {formatINR(spent)} spent so far{emergency ? ' · essentials only' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <CategoryDoughnut rows={rows} height={168} className="w-full sm:w-1/2" />
          <ul className="flex w-full flex-1 flex-col gap-1.5">
            {rows.slice(0, 6).map((row) => (
              <li key={row.category} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 truncate">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: `hsl(${row.hue} 70% 55%)` }}
                    aria-hidden
                  />
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="shrink-0 font-semibold tnum">{formatINR(row.spent)}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function GoalsCard() {
  const derived = useDerived();
  if (derived.goals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="size-4 text-primary" aria-hidden />
            Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No goals yet"
            body="A goal takes money out of your allowance — and makes the trade-off explicit."
            action={
              <Link to="/goals" className="text-sm font-semibold text-primary hover:underline">
                Create one
              </Link>
            }
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="size-4 text-primary" aria-hidden />
          Goals
        </CardTitle>
        <CardDescription>{formatINR(derived.balance.goalSaved)} already set aside</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {derived.goals.map((g) => (
          <div key={g.goal.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold">{g.goal.title}</span>
              <span className="shrink-0 text-xs tnum text-muted-foreground">
                {formatINR(g.saved)} / {formatINR(g.goal.target)}
              </span>
            </div>
            <Progress
              value={g.percent}
              barClassName={g.funded ? 'bg-status-lime' : g.onTrack ? 'bg-primary' : 'bg-status-amber'}
              aria-label={`${g.goal.title} progress`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function Overview() {
  const derived = useDerived();
  const profile = useStore((s) => s.profile);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">
            {profile.name ? `Day ${derived.dayNumber}, ${profile.name.split(' ')[0]}` : `Day ${derived.dayNumber}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {derived.remainingDays} day{derived.remainingDays === 1 ? '' : 's'} left of{' '}
            {derived.horizonStart && formatDayLabel(derived.horizonStart)} – {formatDayLabel(derived.horizonEnd)}
          </p>
        </div>
        <Badge tone="primary">
          <Sparkles className="size-3" /> {derived.health.band} · {derived.health.total}/100
        </Badge>
      </div>

      <HeroCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <TodayList />
        <RiskCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpendingCard />
        <GoalsCard />
      </div>
    </div>
  );
}