import * as React from 'react';
import { CalendarDays, Info } from 'lucide-react';
import { useStore } from '@/store/store';
import { useDerived } from '@/store/selectors';
import { formatINR } from '@/engine/money';
import { formatDayLabel, formatFullDate } from '@/engine/dates';
import { buildForecast } from '@/engine/forecast';
import type { DayPoint } from '@/engine/types';
import { useAppData } from '@/store/selectors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, Money, RiskBadge, Segmented, Stat } from '@/components/ui/primitives';
import { ForecastChart } from '@/components/charts/ForecastChart';
import { CategoryDoughnut } from '@/components/charts/CategoryCharts';
import { cn } from '@/lib/utils';

type Mode = 'base' | 'cautious';

export function Insights() {
  const derived = useDerived();
  const data = useAppData();
  const today = useStore((s) => s.today);
  const [mode, setMode] = React.useState<Mode>('base');
  const [selectedDay, setSelectedDay] = React.useState<DayPoint | null>(null);

  const cautious = React.useMemo(
    () =>
      buildForecast({
        startDate: derived.horizonStart,
        endDate: derived.horizonEnd,
        today,
        openingBalance: derived.balance.currentBalance,
        reserve: data.settings.reserveTarget,
        mode: 'cautious',
        items: data.items,
      }),
    [derived, data, today],
  );

  const days = mode === 'base' ? derived.forecast.days : cautious.days;
  const active = mode === 'base' ? derived.forecast : cautious;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>The whole month</CardTitle>
              <CardDescription>
                Base plan vs the floor — what happens if every discretionary line simply stops.
              </CardDescription>
            </div>
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              options={[
                { value: 'base', label: 'Your plan' },
                { value: 'cautious', label: 'Cautious' },
              ]}
              className="w-auto"
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Day 30 balance" value={<Money paise={active.endClosing} tone={active.endClosing < 0 ? 'negative' : 'positive'} />} />
            <Stat label="Lowest point" value={formatINR(active.minClosing)} hint={formatDayLabel(active.minClosingDate)} tone={active.minClosing < 0 ? 'negative' : 'default'} />
            <Stat label="Total in" value={formatINR(active.totalIncome)} tone="positive" />
            <Stat label="Total out" value={formatINR(active.totalExpense)} tone="negative" />
          </div>

          <ForecastChart
            height={280}
            series={[
              { key: 'base', label: 'Your plan', forecast: derived.forecast, color: 'hsl(var(--primary))' },
              { key: 'cautious', label: 'Cautious floor', forecast: cautious, color: 'hsl(var(--status-lime))', dashed: true },
            ]}
          />

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-primary" aria-hidden /> Your plan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-status-lime" aria-hidden /> Cautious floor
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-status-amber" aria-hidden /> Reserve
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-status-red/30" aria-hidden /> Shortfall days
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" aria-hidden />
            Day by day
          </CardTitle>
          <CardDescription>Tap any day to see exactly what moves the balance.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-1.5">
              {days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    'flex w-14 shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] transition-colors',
                    selectedDay?.date === day.date && 'border-primary/50 bg-primary/10',
                    day.shortfall ? 'border-status-red/40 bg-status-red/10' : 'border-border/70',
                    day.isToday && 'ring-1 ring-primary/60',
                  )}
                >
                  <span className="text-muted-foreground tnum">D{day.day}</span>
                  <span className={cn('font-bold tnum', day.closing < 0 ? 'text-status-red' : 'text-foreground')}>
                    {formatINR(day.closing, { compact: true })}
                  </span>
                  <span className="flex h-1 w-full overflow-hidden rounded-full bg-surface-3">
                    {day.income > 0 ? <span className="h-full bg-status-lime/70" style={{ width: '50%' }} /> : null}
                    {day.expense > 0 ? <span className="h-full bg-status-red/60" style={{ width: '50%' }} /> : null}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedDay ? (
            <div className="animate-fade-up rounded-lg border bg-surface-2/40 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-bold">
                  Day {selectedDay.day} · {formatFullDate(selectedDay.date)}
                </h4>
                <span className="text-xs tnum text-muted-foreground">
                  opens {formatINR(selectedDay.opening)} → closes {formatINR(selectedDay.closing)}
                </span>
              </div>
              {selectedDay.shortfall ? (
                <p className="mt-2 rounded bg-status-red/12 px-2 py-1 text-xs font-semibold text-status-red">
                  This day closes below zero. Everything after it starts from a hole.
                </p>
              ) : null}
              {selectedDay.items.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nothing is scheduled on this day.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {selectedDay.items.map((item) => (
                    <li key={`${item.itemId}-${item.date}-${item.title}`} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn('size-1.5 shrink-0 rounded-full', item.kind === 'income' ? 'bg-status-lime' : item.essential ? 'bg-primary' : 'bg-muted-foreground/50')}
                          aria-hidden
                        />
                        <span className="truncate">{item.title}</span>
                        {item.overdue ? <Badge tone="red">overdue</Badge> : null}
                      </span>
                      <span className={cn('shrink-0 font-semibold tnum', item.kind === 'income' ? 'text-status-lime' : '')}>
                        {item.kind === 'income' ? '+' : '−'}
                        {formatINR(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Pick a day above to inspect it.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Where the money went</CardTitle>
            <CardDescription>Paid expenses so far</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDoughnut rows={derived.categoryRows.filter((r) => r.spent > 0)} height={210} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reading the two lines</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              The solid line is your plan as written: every scheduled item, every recurring charge.
            </p>
            <p className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              The dashed line is the floor: essentials and income only. If the two lines cross, the
              discretionary spending is what is costing you.
            </p>
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Gap on day 30</span>
                <Money paise={derived.forecast.endClosing - cautious.endClosing} />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Risk on the cautious floor</span>
                <RiskBadge level={derived.risk.level} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}