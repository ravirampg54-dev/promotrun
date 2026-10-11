import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FloatingSimulate, BottomNav, Sidebar, TopBar } from './Navigation';
import { Dialog, DialogTitle, SheetContent } from '@/components/ui/Dialog';
import { MORE_ITEMS } from './nav';
import { useStore } from '@/store/store';
import { useDerived } from '@/store/selectors';
import { formatINR } from '@/engine/money';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const location = useLocation();
  const emergency = useStore((s) => s.emergencyMode);
  const derived = useDerived();

  React.useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <div className={cn('min-h-dvh bg-background', emergency && 'emergency-on')}>
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-surface-0 lg:block">
        <Sidebar />
      </aside>

      <div className="lg:pl-64">
        <TopBar />
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 lg:px-6 lg:pb-12">
          {children}
        </main>
      </div>

      <FloatingSimulate />
      <BottomNav onMore={() => setMoreOpen(true)} />

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent aria-describedby={undefined}>
          <DialogTitle className="sr-only">More screens</DialogTitle>
          <div className="mb-3">
            <p className="text-sm font-bold">Safe to spend today</p>
            <p className="text-2xl font-extrabold tnum text-primary">{formatINR(derived.allowance.daily)}</p>
          </div>
          <Divider />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {MORE_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border p-3 transition-colors hover:bg-surface-2',
                  location.pathname === item.to && 'border-primary/40 bg-primary/10',
                )}
              >
                <item.icon className="size-4 text-primary" aria-hidden />
                <span className="text-sm font-bold">{item.label}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{item.blurb}</span>
              </Link>
            ))}
          </div>
          <Button asChild variant="subtle" className="mt-3 w-full">
            <Link to="/settings">Settings &amp; assumptions</Link>
          </Button>
        </SheetContent>
      </Dialog>
    </div>
  );
}