import * as React from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatINR } from '@/engine/money';
import type { Paise } from '@/engine/money';
import type { RiskLevel } from '@/engine/risk';
import { levelClasses } from '@/store/selectors';

/* --------------------------------- Badge -------------------------------- */

export function Badge({
  className,
  tone = 'neutral',
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'primary' | 'lime' | 'amber' | 'red' | 'sky';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-2 text-muted-foreground border-border',
    primary: 'bg-primary/12 text-primary border-primary/30',
    lime: 'bg-status-lime/12 text-status-lime border-status-lime/30',
    amber: 'bg-status-amber/12 text-status-amber border-status-amber/30',
    red: 'bg-status-red/12 text-status-red border-status-red/30',
    sky: 'bg-status-sky/12 text-status-sky border-status-sky/30',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const styles = levelClasses(level);
  return (
    <Badge className={cn('uppercase tracking-wide', styles.bg, styles.text, styles.border, className)}>
      <span className={cn('size-1.5 rounded-full', styles.dot)} aria-hidden />
      {level}
    </Badge>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonCard() {
  return (
    <div className="card-surface space-y-3 p-5">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function LoadingBlock({ label = 'Working it out…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

/* ------------------------------- EmptyState ------------------------------ */

export function EmptyState({
  title,
  body,
  icon,
  action,
  className,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-surface-1/40 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-balance">{body}</p>
      </div>
      {action}
    </div>
  );
}

/* --------------------------------- Stat --------------------------------- */

export function Stat({
  label,
  value,
  hint,
  tone,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'positive' | 'negative' | 'muted';
  icon?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    default: 'text-foreground',
    positive: 'text-status-lime',
    negative: 'text-status-red',
    muted: 'text-muted-foreground',
  };
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn('text-xl font-extrabold tnum', tones[tone ?? 'default'])}>{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/* ------------------------------- MoneyText ------------------------------ */

export function Money({
  paise,
  sign,
  showPaise,
  className,
  tone,
}: {
  paise: Paise;
  sign?: boolean;
  /** render paise when the amount has them */
  showPaise?: boolean;
  className?: string;
  tone?: 'default' | 'positive' | 'negative' | 'muted';
}) {
  const tones = {
    default: '',
    positive: 'text-status-lime',
    negative: 'text-status-red',
    muted: 'text-muted-foreground',
  };
  return (
    <span className={cn('tnum', tones[tone ?? 'default'], className)}>
      {formatINR(paise, { sign, paise: showPaise })}
    </span>
  );
}

/* ------------------------------- RiskNotice ----------------------------- */

export function RiskNotice({
  level,
  title,
  children,
  className,
}: {
  level: RiskLevel;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = levelClasses(level);
  return (
    <div className={cn('flex gap-3 rounded-lg border p-3', styles.bg, styles.border, className)}>
      <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', styles.text)} aria-hidden />
      <div className="min-w-0">
        <p className={cn('text-sm font-bold', styles.text)}>{title}</p>
        {children ? <div className="mt-1 text-sm text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------- Segmented ------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'default',
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; hint?: string }[];
  className?: string;
  size?: 'sm' | 'default';
}) {
  return (
    <div
      role="radiogroup"
      className={cn('inline-flex w-full items-center gap-1 rounded-lg border bg-surface-2 p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-md px-3 font-semibold transition-all',
              size === 'sm' ? 'py-1 text-xs' : 'py-1.5 text-sm',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------- Divider ------------------------------- */

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return <div className={cn('h-px w-full bg-border', className)} />;
}