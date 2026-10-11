import * as React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { formatINR } from '@/engine/money';
import { formatFullDate } from '@/engine/dates';
import { useStore } from '@/store/store';
import { useDerived, levelClasses } from '@/store/selectors';
import { NAV } from './nav';
import { Button } from '@/components/ui/Button';
import { Badge, RiskBadge } from '@/components/ui/primitives';
import { DayProgress } from '@/components/charts/HealthRing';
import { NotificationCenter } from './NotificationCenter';
import { EmergencyToggle } from './EmergencyToggle';
import { cn } from '@/lib/utils';

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="px-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
        {title}
      </p>
      {children}
    </div>
  );
}

function SidebarLink({ to, label, icon: Icon, onNavigate }: (typeof NAV)[number] & { onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive
            ? 'bg-primary/12 text-primary'
            : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const derived = useDerived();
  const settings = useStore((s) => s.settings);
  const profile = useStore((s) => s.profile);
  const styles = levelClasses(derived.risk.level);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <Link to="/" className="flex items-center gap-2.5 px-2" onClick={onNavigate}>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-base font-extrabold text-primary-foreground shadow-glow">
          ₹
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-extrabold tracking-tight">₹10K</span>
          <span className="block text-[11px] text-muted-foreground">30-day survival</span>
        </span>
      </Link>

      <SidebarSection title="Safe to spend today">
        <div className="rounded-xl border bg-surface-2/60 p-3">
          <p className={cn('text-2xl font-extrabold tnum', styles.text)}>
            {formatINR(derived.allowance.daily)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            across {derived.remainingDays} day{derived.remainingDays === 1 ? '' : 's'}
          </p>
          <div className="mt-3">
            <DayProgress day={derived.dayNumber} total={settings.durationDays} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">Risk</span>
            <RiskBadge level={derived.risk.level} />
          </div>
        </div>
      </SidebarSection>

      <SidebarSection title="Navigate">
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <SidebarLink key={item.to} {...item} onNavigate={onNavigate} />
          ))}
        </nav>
      </SidebarSection>

      <div className="mt-auto flex flex-col gap-2 px-2 pb-2">
        <div className="rounded-lg border bg-surface-2/40 p-3">
          <p className="text-[11px] text-muted-foreground">
            {profile.demo ? 'Demo data · ' : ''}
            {formatFullDate(derived.today)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Everything stays on this device.
          </p>
        </div>
      </div>
    </div>
  );
}

export function BottomNav({ onMore }: { onMore: () => void }) {
  const emergency = useStore((s) => s.emergencyMode);
  const primary = NAV.filter((n) => n.primary);

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-semibold transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <item.icon className="size-5" aria-hidden />
            <span className="truncate">{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onMore}
          className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-semibold text-muted-foreground"
        >
          <span className="relative">
            <Badge tone="primary" className="px-1.5 py-0 text-[9px]">
              +{NAV.length - primary.length}
            </Badge>
          </span>
          <span>More</span>
        </button>
      </div>
      {emergency ? <EmergencyBanner /> : null}
    </nav>
  );
}

function EmergencyBanner() {
  return (
    <div className="flex items-center justify-center gap-2 bg-status-red/15 px-4 py-1.5 text-xs font-bold text-status-red">
      Emergency mode — discretionary spending is hidden
    </div>
  );
}

export function TopBar() {
  const location = useLocation();
  const profile = useStore((s) => s.profile);
  const durationDays = useStore((s) => s.settings.durationDays);
  const current = NAV.find((n) => n.to === location.pathname);
  const derived = useDerived();

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 lg:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-extrabold tracking-tight">
            {current?.label ?? '₹10K'}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {current?.blurb ?? 'Make the consequences visible'}
            {profile.demo ? ' · demo data' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EmergencyToggle />
          <NotificationCenter />
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-2 lg:px-6">
        <DayProgress day={derived.dayNumber} total={durationDays} />
      </div>
    </header>
  );
}

export function FloatingSimulate() {
  return (
    <Button asChild size="lg" className="fixed bottom-20 right-4 z-40 rounded-full shadow-glow lg:bottom-6">
      <Link to="/simulator">Simulate</Link>
    </Button>
  );
}