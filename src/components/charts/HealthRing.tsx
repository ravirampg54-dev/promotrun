import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/engine/risk';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function HealthRing({
  score,
  tone,
  size = 132,
  label,
  caption,
  className,
}: {
  score: number;
  tone: RiskLevel;
  size?: number;
  label?: string;
  caption?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, score));
  const offset = CIRCUMFERENCE * (1 - pct / 100);
  const color = {
    low: 'hsl(var(--status-lime))',
    moderate: 'hsl(var(--status-sky))',
    high: 'hsl(var(--status-amber))',
    critical: 'hsl(var(--status-red))',
  }[tone];

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Health score ${Math.round(pct)} out of 100`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          fill="none"
          stroke="hsl(var(--surface-3))"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold tnum leading-none">{Math.round(pct)}</span>
        {label ? <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span> : null}
        {caption ? <span className="text-[11px] text-muted-foreground">{caption}</span> : null}
      </div>
    </div>
  );
}

export function DayProgress({
  day,
  total,
  className,
}: {
  day: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? (day / total) * 100 : 0;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="tnum">
          Day {Math.min(day, total)} <span className="text-muted-foreground">of {total}</span>
        </span>
        <span className="text-muted-foreground tnum">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}