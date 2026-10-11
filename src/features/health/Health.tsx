import { Link } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import { formatINR } from '@/engine/money';
import { useDerived, levelClasses } from '@/store/selectors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, RiskNotice, RiskBadge } from '@/components/ui/primitives';
import { Progress } from '@/components/ui/controls';
import { HealthRing } from '@/components/charts/HealthRing';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function Health() {
  const derived = useDerived();
  const health = derived.health;
  const styles = levelClasses(derived.risk.level);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center">
          <HealthRing score={health.total} tone={health.tone} label={health.band} size={150} />
          <div className="flex flex-1 flex-col gap-3">
            <div>
              <h2 className="text-lg font-extrabold">How sturdy is this month?</h2>
              <p className="mt-1 text-sm text-muted-foreground">{derived.risk.headline}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <RiskBadge level={derived.risk.level} />
              <Badge tone="neutral">
                {derived.forecast.shortfallDays === 0
                  ? 'no short days'
                  : `${derived.forecast.shortfallDays} short day${derived.forecast.shortfallDays === 1 ? '' : 's'}`}
              </Badge>
              <Badge tone="neutral">lowest {formatINR(derived.forecast.minClosing)}</Badge>
            </div>
            <p className="flex items-start gap-2 rounded-lg bg-surface-2/50 p-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {health.disclaimer}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What the score is made of</CardTitle>
          <CardDescription>Five weighted components, each normalised against your own plan</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {health.components.map((component) => (
            <div key={component.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">
                  {component.label}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    weight {component.weight}
                  </span>
                </span>
                <span
                  className={cn(
                    'text-sm font-bold tnum',
                    component.score >= 75
                      ? 'text-status-lime'
                      : component.score >= 50
                        ? 'text-status-amber'
                        : 'text-status-red',
                  )}
                >
                  {component.score}
                </span>
              </div>
              <Progress
                value={component.score}
                aria-label={`${component.label} score`}
                barClassName={
                  component.score >= 75
                    ? 'bg-status-lime'
                    : component.score >= 50
                      ? 'bg-status-amber'
                      : 'bg-status-red'
                }
              />
              <p className="text-xs text-muted-foreground">{component.explanation}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Warnings, in order</CardTitle>
          <CardDescription>
            Each one states what changed, why it matters, the calculation, and the next step.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {derived.risk.warnings.length === 0 ? (
            <div className={cn('rounded-lg border p-4', styles.bg, styles.border)}>
              <p className="text-sm font-bold text-status-lime">Nothing to fix right now.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Every essential is covered, the projection stays above zero, and your daily allowance is
                above the line you set. Spend as planned and check back when something changes.
              </p>
            </div>
          ) : (
            derived.risk.warnings.map((w) => (
              <RiskNotice key={w.id} level={w.level} title={w.title}>
                <dl className="flex flex-col gap-1.5">
                  <div>
                    <dt className="inline font-semibold text-foreground">What changed: </dt>
                    <dd className="inline">{w.whatChanged}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-foreground">Why it matters: </dt>
                    <dd className="inline">{w.whyItMatters}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-foreground">Calculation: </dt>
                    <dd className="inline font-mono text-[11px]">{w.calculation}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-foreground">Next step: </dt>
                    <dd className="inline font-semibold text-foreground">{w.nextStep}</dd>
                  </div>
                </dl>
              </RiskNotice>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/25">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Something to change?</p>
            <p className="text-sm text-muted-foreground">
              Run it through the simulator first — you will see the day-30 number before you commit.
            </p>
          </div>
          <Button asChild>
            <Link to="/simulator">
              Open simulator <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}