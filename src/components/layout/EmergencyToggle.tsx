import { Siren } from 'lucide-react';
import { useStore } from '@/store/store';
import { useDerived } from '@/store/selectors';
import { Switch } from '@/components/ui/controls';
import { cn } from '@/lib/utils';

/**
 * Emergency mode hides discretionary line items everywhere and pins the app to
 * essentials. It is reversible and never deletes anything.
 */
export function EmergencyToggle() {
  const on = useStore((s) => s.emergencyMode);
  const setOn = useStore((s) => s.setEmergencyMode);
  const derived = useDerived();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      title="Emergency mode hides everything that is not essential"
      className={cn(
        'flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors',
        on
          ? 'border-status-red/40 bg-status-red/12 text-status-red'
          : 'text-muted-foreground hover:bg-surface-2',
      )}
    >
      <Siren className="size-4" aria-hidden />
      <span className="hidden text-xs font-bold sm:inline">Emergency</span>
      <Switch checked={on} className="pointer-events-none h-4 w-7 [&>span]:size-3 data-[state=checked]:translate-x-3" />
      <span className="sr-only">
        {on ? `Emergency mode on. ${derived.risk.warnings.length} warnings active.` : 'Emergency mode off'}
      </span>
    </button>
  );
}