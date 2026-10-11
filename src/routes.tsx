import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from '@/store/store';
import { AppShell } from '@/components/layout/AppShell';
import { Overview } from '@/features/overview/Overview';
import { SkeletonCard } from '@/components/ui/primitives';
import { Transactions } from '@/features/transactions/Transactions';

const Onboarding = lazy(() =>
  import('@/features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })),
);
const BudgetPlanner = lazy(() =>
  import('@/features/budget/BudgetPlanner').then((m) => ({ default: m.BudgetPlanner })),
);
const Simulator = lazy(() =>
  import('@/features/simulator/Simulator').then((m) => ({ default: m.Simulator })),
);
const Goals = lazy(() => import('@/features/goals/Goals').then((m) => ({ default: m.Goals })));
const Bills = lazy(() => import('@/features/bills/Bills').then((m) => ({ default: m.Bills })));
const Health = lazy(() => import('@/features/health/Health').then((m) => ({ default: m.Health })));
const Insights = lazy(() =>
  import('@/features/insights/Insights').then((m) => ({ default: m.Insights })),
);
const Settings = lazy(() =>
  import('@/features/settings/Settings').then((m) => ({ default: m.Settings })),
);

function RouteFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading screen">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export function AppRoutes() {
  const onboarded = useStore((s) => s.profile.onboarded);
  const location = useLocation();

  if (!onboarded) {
    return (
      <Lazy>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            path="*"
            element={<Navigate to="/onboarding" replace state={{ from: location.pathname }} />}
          />
        </Routes>
      </Lazy>
    );
  }

  return (
    <AppShell>
      <Lazy>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budget" element={<BudgetPlanner />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/health" element={<Health />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/onboarding" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Lazy>
    </AppShell>
  );
}