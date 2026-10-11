import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatINR } from '@/engine/money';
import { hueColor } from '@/lib/utils';
import type { CategoryRow } from '@/engine/derive';
import { cn } from '@/lib/utils';

export function CategoryDoughnut({
  rows,
  height = 200,
  className,
}: {
  rows: CategoryRow[];
  height?: number;
  className?: string;
}) {
  const data = rows
    .filter((row) => row.spent > 0)
    .map((row) => ({ name: row.label, value: row.spent, hue: row.hue }));
  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (data.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground', className)}
        style={{ height }}
      >
        Nothing spent yet
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { name: string; value: number; hue: number };
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-card">
                  <p className="font-bold">{d.name}</p>
                  <p className="tnum text-muted-foreground">
                    {formatINR(d.value)} · {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                  </p>
                </div>
              );
            }}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="hsl(var(--card))"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={hueColor(entry.hue)} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SpendBars({
  rows,
  height = 240,
  className,
}: {
  rows: CategoryRow[];
  height?: number;
  className?: string;
}) {
  const data = rows
    .filter((row) => row.planned > 0 || row.spent > 0)
    .map((row) => ({
      name: row.label.replace(' & ', ' /\n').replace('Electricity & water', 'Utilities'),
      short: row.label.split(' ')[0],
      planned: row.planned,
      spent: row.spent,
      over: row.spent > row.planned,
      hue: row.hue,
    }));

  if (data.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground', className)}
        style={{ height }}
      >
        Set a budget to see planned vs spent
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }} barGap={2}>
          <XAxis
            dataKey="short"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => formatINR(value, { compact: true })}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted-foreground))', fillOpacity: 0.06 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { short: string; planned: number; spent: number; over: boolean };
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-card">
                  <p className="mb-1 font-bold">{d.short}</p>
                  <p className="tnum text-muted-foreground">
                    spent {formatINR(d.spent)} / planned {formatINR(d.planned)}
                  </p>
                  {d.over ? (
                    <p className="mt-1 font-semibold text-status-red">
                      {formatINR(d.spent - d.planned)} over plan
                    </p>
                  ) : null}
                </div>
              );
            }}
          />
          <Bar dataKey="planned" name="Planned" fill="hsl(var(--surface-3))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="spent" name="Spent" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.short} fill={entry.over ? 'hsl(var(--status-red))' : hueColor(entry.hue)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}