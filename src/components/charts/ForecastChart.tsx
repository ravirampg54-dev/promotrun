import * as React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatINR } from '@/engine/money';
import { formatDayLabel } from '@/engine/dates';
import type { ForecastResult } from '@/engine/forecast';
import { useStore } from '@/store/store';
import { cn } from '@/lib/utils';

export interface ForecastSeries {
  key: string;
  label: string;
  forecast: ForecastResult;
  color: string;
  dashed?: boolean;
}

interface Row {
  day: number;
  date: string;
  label: string;
  base: number | null;
  cautious: number | null;
  scenario: number | null;
  reserve: number;
  shortfall: boolean;
  income: number;
  expense: number;
  today: boolean;
}

function ChartTooltip({
  active,
  payload,
  label,
  rows,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string; name: string; payload?: Row }[];
  label?: string;
  rows: Row[];
}) {
  if (!active || !payload?.length) return null;
  const row = rows.find((r) => r.day === payload[0]?.payload?.day) ?? rows.find((r) => r.label === label);
  if (!row) return null;
  return (
    <div className="min-w-[190px] rounded-lg border bg-popover/95 p-3 text-xs shadow-card backdrop-blur">
      <p className="mb-2 font-bold">
        Day {row.day} · {formatDayLabel(row.date)}
        {row.today ? ' · today' : ''}
      </p>
      <dl className="space-y-1">
        {payload
          .filter((p) => p.value !== null && p.value !== undefined && p.dataKey !== 'reserve')
          .map((p) => (
            <div key={p.dataKey} className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
                {p.name}
              </dt>
              <dd className="font-semibold tnum">{formatINR(p.value)}</dd>
            </div>
          ))}
      </dl>
      <div className="mt-2 flex items-center justify-between border-t pt-2 text-muted-foreground">
        <span>In / out</span>
        <span className="tnum">
          {formatINR(row.income)} / {formatINR(row.expense)}
        </span>
      </div>
      {row.shortfall ? (
        <p className="mt-2 rounded bg-status-red/12 px-2 py-1 font-semibold text-status-red">
          Balance goes negative here
        </p>
      ) : null}
    </div>
  );
}

export function ForecastChart({
  series,
  height = 260,
  showReserve = true,
  className,
}: {
  series: ForecastSeries[];
  height?: number;
  showReserve?: boolean;
  className?: string;
}) {
  const reserve = useStore((s) => s.settings.reserveTarget);

  const rows: Row[] = React.useMemo(() => {
    const base = series[0];
    if (!base) return [];
    const byDay = new Map<number, Row>();
    for (const s of series) {
      for (const day of s.forecast.days) {
        const existing = byDay.get(day.day);
        if (existing) {
          (existing as unknown as Record<string, unknown>)[s.key] = day.closing;
        } else {
          byDay.set(day.day, {
            day: day.day,
            date: day.date,
            label: `D${day.day}`,
            base: null,
            cautious: null,
            scenario: null,
            reserve,
            shortfall: day.shortfall,
            income: day.income,
            expense: day.expense,
            today: day.isToday,
          });
        }
        if (day.isToday) byDay.set(day.day, { ...(byDay.get(day.day) as Row), today: true });
      }
    }
    return [...byDay.values()].sort((a, b) => a.day - b.day);
  }, [series, reserve]);

  const todayRow = rows.find((r) => r.today);
  const shortfallRows = rows.filter((r) => r.shortfall);
  const contiguous = (list: Row[]): [Row, Row] | null => {
    if (list.length === 0) return null;
    let start = list[0];
    let end = list[0];
    let prev = list[0];
    for (const row of list.slice(1)) {
      if (row.day !== prev.day + 1) {
        start = prev;
        end = prev;
      }
      prev = row;
      end = row;
    }
    return [start, end];
  };
  const shortfallRange = contiguous(shortfallRows);
  const zeroLine = rows.some((r) => r.base !== null && r.base < 0);

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="shortfallFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--status-red))" stopOpacity={0.22} />
              <stop offset="100%" stopColor="hsl(var(--status-red))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tickFormatter={(value: number) => (value % 5 === 0 || value === 1 ? `D${value}` : '')}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={62}
            tickFormatter={(value: number) => formatINR(value, { compact: true })}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.35, strokeDasharray: '4 4' }}
            content={<ChartTooltip rows={rows} />}
          />
          {zeroLine && <ReferenceLine y={0} stroke="hsl(var(--status-red))" strokeOpacity={0.6} />}
          {showReserve && (
            <ReferenceLine
              y={reserve}
              stroke="hsl(var(--status-amber))"
              strokeDasharray="5 5"
              strokeOpacity={0.7}
              label={{ value: 'reserve', position: 'insideTopRight', fill: 'hsl(var(--status-amber))', fontSize: 10 }}
            />
          )}
          {shortfallRange && (
            <ReferenceArea
              x1={shortfallRange[0].day}
              x2={shortfallRange[1].day}
              fill="url(#shortfallFill)"
              strokeOpacity={0}
            />
          )}
          {todayRow && (
            <ReferenceLine
              x={todayRow.day}
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              label={{ value: 'today', position: 'top', fill: 'hsl(var(--primary))', fontSize: 10 }}
            />
          )}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.key === 'base' ? 2.5 : 1.8}
              strokeDasharray={s.dashed ? '6 5' : undefined}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Filled area used on the overview hero card. */
export function Sparkline({
  forecast,
  height = 60,
  className,
}: {
  forecast: ForecastResult;
  height?: number;
  className?: string;
}) {
  const data = forecast.days.map((d) => ({ day: d.day, closing: d.closing }));
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="closing"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#sparkFill)"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}