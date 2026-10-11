import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/store/store';
import { RUPEE, formatINR } from '@/engine/money';
import { todayISO } from '@/engine/dates';
import { Button } from '@/components/ui/Button';
import { AmountInput, Field, Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/controls';
import { Divider } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { presetAmounts } from '@/schemas';

interface Draft {
  name: string;
  city: string;
  opening: string;
  reserve: string;
  income: string;
  duration: number;
}

const STEPS = [
  { id: 'welcome', title: 'Your money, made visible', body: 'A 30-day survival simulator for living on ₹10,000.' },
  { id: 'opening', title: 'What are you starting with?', body: 'The cash you actually have today. Everything else builds on this number.' },
  { id: 'reserve', title: 'How much is untouchable?', body: 'Money set aside so one bad day cannot become a crisis.' },
  { id: 'income', title: 'What is coming in?', body: 'Anything expected before the run ends. We will not spend it twice.' },
  { id: 'bills', title: 'What is already committed?', body: 'Add the essentials you already know about. You can refine them later.' },
  { id: 'ready', title: 'Ready when you are', body: 'Check the numbers, then start the run.' },
] as const;

export function Onboarding() {
  const navigate = useNavigate();
  const today = todayISO();
  const updateSettings = useStore((s) => s.updateSettings);
  const finishOnboarding = useStore((s) => s.finishOnboarding);
  const loadDemo = useStore((s) => s.loadDemo);
  const addItem = useStore((s) => s.addItem);
  const addGoal = useStore((s) => s.addGoal);

  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState<Draft>({
    name: '',
    city: '',
    opening: '10000',
    reserve: '1500',
    income: '10000',
    duration: 30,
  });
  const [bills, setBills] = React.useState([
    { title: 'Rent / share', amount: '3500', date: `${today}` },
    { title: 'Phone plan', amount: '499', date: `${today}` },
  ]);
  const [goals, setGoals] = React.useState([{ title: '', amount: '' }]);

  const openingPaise = Math.round(Number(draft.opening || 0) * 100) || 0;
  const reservePaise = Math.round(Number(draft.reserve || 0) * 100) || 0;
  const incomePaise = Math.round(Number(draft.income || 0) * 100) || 0;

  const preview = React.useMemo(() => {
    const reserved = reservePaise + bills.reduce((acc, b) => acc + (Math.round(Number(b.amount || 0) * 100) || 0), 0);
    const free = Math.max(0, openingPaise + incomePaise - reserved);
    return {
      reserved,
      free,
      perDay: draft.duration > 0 ? Math.floor(free / draft.duration) : 0,
      safeReserve: Math.min(reservePaise, openingPaise + incomePaise),
    };
  }, [openingPaise, reservePaise, incomePaise, bills, draft.duration]);

  const canAdvance =
    step === 0 ||
    (step === 1 && draft.name.trim().length > 0) ||
    (step === 2 && openingPaise > 0) ||
    (step >= 3 && reservePaise <= openingPaise + incomePaise);

  function finish(demo: boolean) {
    if (demo) {
      loadDemo();
      toast.success('Demo data loaded', { description: 'A full month in Pune, ready to poke at.' });
      navigate('/', { replace: true });
      return;
    }
    updateSettings({
      openingBalance: openingPaise,
      reserveTarget: preview.safeReserve,
      allowanceFloor: RUPEE(150),
      plannedIncome: incomePaise,
      durationDays: draft.duration,
      startDate: today,
    });
    finishOnboarding({ name: draft.name.trim() || 'You', city: draft.city.trim(), demo: false });

    for (const bill of bills) {
      const amount = Math.round(Number(bill.amount || 0) * 100);
      if (bill.title.trim() && amount > 0) {
        addItem({
          title: bill.title.trim(),
          amount,
          kind: 'expense',
          category: 'bills',
          date: bill.date || today,
          status: 'scheduled',
          recurring: true,
          recurrence: { type: 'monthly', startDate: bill.date || today, interval: 1, endDate: null, cancelledFrom: null, paused: false },
          essential: true,
        });
      }
    }
    for (const goal of goals) {
      const amount = Math.round(Number(goal.amount || 0) * 100);
      if (goal.title.trim() && amount > 0) {
        addGoal({
          title: goal.title.trim(),
          target: amount,
          saved: 0,
          deadline: `${today.slice(0, 8)}${String(Number(today.slice(8, 10)) + draft.duration).padStart(2, '0')}`,
          priority: 'medium',
        });
      }
    }
    toast.success('Your 30-day run is ready', {
      description: `${formatINR(preview.perDay)} a day, if nothing changes.`,
    });
    navigate('/', { replace: true });
  }

  const current = STEPS[step];

  return (
    <div className="min-h-dvh bg-background">
      <div className="grain pointer-events-none absolute inset-x-0 top-0 h-72 opacity-60" aria-hidden />
      <div className="relative mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 py-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground shadow-glow">
            ₹
          </span>
          <div>
            <p className="font-extrabold tracking-tight">₹10K</p>
            <p className="text-xs text-muted-foreground">30-Day Financial Survival Simulator</p>
          </div>
        </div>

        <Progress value={((step + 1) / STEPS.length) * 100} aria-label="Onboarding progress" />

        <div className="flex-1 animate-fade-up" key={step}>
          <h1 className="text-2xl font-extrabold tracking-tight text-balance">{current.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{current.body}</p>

          <div className="mt-6 flex flex-col gap-4">
            {step === 0 ? (
              <ul className="flex flex-col gap-2.5">
                {[
                  'See what is genuinely safe to spend today, after bills and reserve.',
                  'Project the whole month day by day — not a vague guess.',
                  'Try a decision in the simulator before you make it.',
                  'No accounts, no bank links, no shame. Everything stays on this device.',
                ].map((line) => (
                  <li key={line} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-status-lime" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {step === 1 ? (
              <>
                <Field label="What should we call you?" htmlFor="name" error={draft.name.length === 0 && step > 1 ? 'Required' : undefined}>
                  <Input id="name" value={draft.name} placeholder="Aarav" onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
                </Field>
                <Field label="City (optional)" htmlFor="city">
                  <Input id="city" value={draft.city} placeholder="Pune" onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
                </Field>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Field label="Cash in hand today" htmlFor="opening">
                  <AmountInput id="opening" value={draft.opening} onChange={(e) => setDraft({ ...draft, opening: e.target.value })} autoFocus />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {presetAmounts.map((p) => (
                    <Button key={p.paise} size="sm" variant={Number(draft.opening) === p.paise / 100 ? 'default' : 'outline'} onClick={() => setDraft({ ...draft, opening: String(p.paise / 100) })}>
                      {p.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Field label="Emergency reserve" htmlFor="reserve" hint="Held back before anything discretionary is allowed.">
                  <AmountInput id="reserve" value={draft.reserve} onChange={(e) => setDraft({ ...draft, reserve: e.target.value })} autoFocus />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {['0', '500', '1000', '1500', '2000'].map((v) => (
                    <Button key={v} size="sm" variant={draft.reserve === v ? 'default' : 'outline'} onClick={() => setDraft({ ...draft, reserve: v })}>
                      ₹{v}
                    </Button>
                  ))}
                </div>
                {reservePaise > openingPaise + incomePaise ? (
                  <p className="text-xs font-semibold text-status-amber">
                    That reserve is more than everything you have. We will cap it at {formatINR(preview.safeReserve)}.
                  </p>
                ) : null}
              </>
            ) : null}

            {step === 4 ? (
              <>
                <Field label="Expected income before day 30" htmlFor="income" hint="Salary, freelance, pocket money — anything that will land.">
                  <AmountInput id="income" value={draft.income} onChange={(e) => setDraft({ ...draft, income: e.target.value })} autoFocus />
                </Field>
                <Field label="Run length" htmlFor="duration">
                  <div className="flex flex-wrap gap-2">
                    {[15, 30, 45, 60].map((d) => (
                      <Button key={d} size="sm" variant={draft.duration === d ? 'default' : 'outline'} onClick={() => setDraft({ ...draft, duration: d })}>
                        {d} days
                      </Button>
                    ))}
                  </div>
                </Field>
                <Divider label="Already committed" />
                <div className="flex flex-col gap-2">
                  {bills.map((bill, i) => (
                    <div key={i} className="grid grid-cols-[1fr_120px] gap-2">
                      <Input
                        value={bill.title}
                        placeholder="Rent, phone, wifi…"
                        onChange={(e) => setBills(bills.map((b, j) => (j === i ? { ...b, title: e.target.value } : b)))}
                      />
                      <AmountInput
                        value={bill.amount}
                        onChange={(e) => setBills(bills.map((b, j) => (j === i ? { ...b, amount: e.target.value } : b)))}
                      />
                    </div>
                  ))}
                  <Button size="sm" variant="subtle" onClick={() => setBills([...bills, { title: '', amount: '', date: today }])}>
                    Add another
                  </Button>
                </div>
                <Divider label="Savings goals" />
                <div className="flex flex-col gap-2">
                  {goals.map((goal, i) => (
                    <div key={i} className="grid grid-cols-[1fr_120px] gap-2">
                      <Input
                        value={goal.title}
                        placeholder="Course fee, trip, laptop…"
                        onChange={(e) => setGoals(goals.map((g, j) => (j === i ? { ...g, title: e.target.value } : g)))}
                      />
                      <AmountInput
                        value={goal.amount}
                        onChange={(e) => setGoals(goals.map((g, j) => (j === i ? { ...g, amount: e.target.value } : g)))}
                      />
                    </div>
                  ))}
                  <Button size="sm" variant="subtle" onClick={() => setGoals([...goals, { title: '', amount: '' }])}>
                    Add a goal
                  </Button>
                </div>
              </>
            ) : null}

            {step === 5 ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border bg-surface-2/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Safe to spend today
                  </p>
                  <p className="text-4xl font-extrabold tnum text-primary">{formatINR(preview.perDay)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    per day for {draft.duration} days, after {formatINR(preview.reserved)} of reserve and commitments.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Opening cash</p>
                    <p className="text-lg font-bold tnum">{formatINR(openingPaise)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Expected income</p>
                    <p className="text-lg font-bold tnum text-status-lime">{formatINR(incomePaise)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Committed bills</p>
                    <p className="text-lg font-bold tnum">{bills.filter((b) => b.title).length}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Goals</p>
                    <p className="text-lg font-bold tnum">{goals.filter((g) => g.title).length}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  You can change every one of these numbers later in Settings.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-5">
          {step === 5 ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={() => finish(false)} className="flex-1">
                Start my 30 days <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => finish(true)} className="sm:w-auto">
                <Sparkles className="size-4" /> Explore with demo data
              </Button>
            </div>
          ) : (
            <Button size="lg" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)} className="w-full">
              Continue <ArrowRight className="size-4" />
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className={cn('text-xs font-semibold text-muted-foreground hover:text-foreground', step === 0 && 'invisible')}
            >
              Back
            </button>
          ) : null}
          <p className="text-center text-[11px] text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>
      </div>
    </div>
  );
}