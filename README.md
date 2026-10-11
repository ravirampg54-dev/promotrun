# ₹10K — 30-Day Financial Survival Simulator

> Every financial decision has consequences. Make them visible before spending.

A budget simulator for anyone living on a fixed amount for 30 days. It answers one
question honestly: **what is genuinely safe to spend today** — after rent, bills,
your reserve, and the goals you have not reached yet.

No backend, no bank links, no accounts. Everything runs in the browser and never
leaves it.

---

## Setup

Requires **Node 20.19+ or 22.12+** (required by Vite 7).

Built with React 19, Vite 7, TypeScript 7, Tailwind 3, Zustand 5, and Radix UI.

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Typecheck (`tsc --noEmit`) then production build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run typecheck` | TypeScript only |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run check` | typecheck → test → build, in that order |

## Deploy

`dist/` is a static folder — anything works.

**Vercel**

```bash
npx vercel        # framework: Vite, output: dist
```

**Netlify**

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

Add a `public/_redirects` (or `vercel.json`) containing `/* /index.html 200` so
client-side routes such as `/simulator` survive a hard refresh.

**Static host** — upload `dist/` and configure the same SPA fallback.

---

## Architecture

```
src/
├── engine/            pure TypeScript. No React, no DOM.
│   ├── dates.ts       ISO calendar days, no timezone drift
│   ├── money.ts       integer paise + Indian digit grouping
│   ├── types.ts       the domain model
│   ├── categories.ts  the category table
│   ├── recurrence.ts  once / weekly / monthly occurrence generation
│   ├── schedule.ts    ledger → dated occurrences
│   ├── balance.ts     balance, protected funds, availability
│   ├── forecast.ts    the chained 30-day timeline
│   ├── allowance.ts   safe daily spend
│   ├── risk.ts        thresholds + four-part warnings
│   ├── health.ts      the 5-component score
│   ├── scenarios.ts   pure preview + comparison + goal delay math
│   ├── derive.ts      one function: state → every number the UI shows
│   └── __tests__/     86 Vitest specs
├── store/             Zustand 5 + persist, selectors, demo seed, CSV export
├── schemas/           Zod schemas for every form
├── components/
│   ├── ui/            Button, Card, Dialog, Tabs, Select, Progress, Switch…
│   ├── layout/        Sidebar, BottomNav, TopBar, notifications, More sheet
│   └── charts/        ForecastChart, CategoryDoughnut, SpendBars, HealthRing
├── features/          one folder per screen
└── styles/            tokens.css (navy scale, violet accent), globals.css
```

### The four rules

1. **The engine is pure.** `src/engine/` imports nothing from React and touches
   no browser API. That is why it is testable, and why the tests cover all the
   arithmetic you care about.
2. **Money is integer paise.** `123456` paise, never `1234.56`. Floats exist only
   inside `formatINR`. This is why ₹33.33 stays ₹33.33 after 30 days of maths.
3. **Components never calculate money.** They call `useDerived()`, which calls
   `derive()`, which calls the engine. Every screen reads the same number.
4. **A preview never mutates state.** `applyScenario()` deep-clones first and
   returns a new object. The store's `applyScenarioActions(commitId, …)` refuses
   to run the same commit twice.

---

## The formulas

```
currentBalance   = opening + income received − expenses paid
projectedBalance = currentBalance + future income − future discretionary spend
protectedFunds   = reserve target + unpaid essential commitments
goalSavings      = money already moved into savings goals

safeDailyAllowance = max(0, (projectedBalance − goalSavings − protectedFunds) / remainingDays)

daily closing      = opening + income − expense     (chained day to day)
```

### Invariants the tests enforce

- Budget allocations never move cash. They only shape the forecast.
- A savings transfer is **not** an expense — it removes money from the allowance.
- A reserved bill is protected today and subtracted only when it is marked paid.
- Cancelling stops **future** occurrences only; anything already paid stays in
  the balance exactly where it was.
- An unpaid item whose date has passed is pulled forward to today and flagged
  overdue, because you still owe that money.
- Paying a recurring bill does not cancel its next occurrence.

### Risk levels

| Level | Trigger |
| --- | --- |
| **Critical** | any projected closing balance below zero |
| **High** | lowest projected balance falls into the reserve (or something is overdue) |
| **Moderate** | safe daily spend falls below your comfort line, a goal missed its deadline, or a category is over plan |
| **Low** | none of the above |

Every warning states four things: **what changed**, **why it matters**, **which
calculation fired**, and **the next step**. The calculator is shown inline as
monospace text, so nothing is a black box.

### Health score

0–100, weighted: essentials coverage 25, cash flow 25, reserve 20, budget
adherence 15, savings 15. Each component shows its own formula and its own
number. It is labelled as an educational estimate everywhere it appears — it is
not a credit score and is not reported anywhere.

---

## Screens

| Route | What it is for |
| --- | --- |
| `/` | Hero "safe to spend today" card, protected-funds breakdown, due today, risk, spending mix, goals |
| `/transactions` | CRUD, search, type/status/category filters, four sort orders, mark paid, duplicate, duplicate-entry guard |
| `/budget` | Draft a budget from real spending, edit per line, planned vs spent |
| `/simulator` | Preset + custom scenarios, live before/after, 3-way comparison with a winner, chart overlay |
| `/goals` | Progress, contribution rate, deadline maths calculated from that rate |
| `/bills` | Subscriptions and due dates — pause, cancel, mark paid |
| `/health` | Health ring, component breakdown, full warning list |
| `/insights` | Base vs cautious forecast, day-by-day inspector, category mix |
| `/settings` | Reserve, duration, theme, CSV export, reset, the formulas themselves |

Also: six-step onboarding with a demo mode, emergency mode (hides everything
non-essential, reversible, deletes nothing), and an in-app notification inbox that
deduplicates on warning id.

---

## Tests

```bash
npm test
```

112 specs across seven files. Five cover the pure engine:

- **`money.test.ts`** — Indian grouping, paise parsing, decimals, negatives, even splits
- **`recurrence.test.ts`** — once/weekly/monthly, short-month clamping, cancel vs pause, next occurrence
- **`forecast.test.ts`** — zero balance, expense above cash, negative projection, same-day bills, cancelled subscription, mark-paid, changing the day, editing a past transaction, day 30 end, decimal drift, cautious mode, allowance floor
- **`risk-health.test.ts`** — all four levels, four-part warnings, baselines, missed deadlines, funded goals, over-budget categories, health weights summing to 100
- **`scenarios.test.ts`** — preview does not mutate state, duplicate entries, apply-once, winner selection and tie-breaks, goal delay from the real contribution rate

The remaining two cover the store and components:

- **`store.test.ts`** — defaults, demo seed, item actions, goal and budget rules, apply-once scenario commits, notification dedupe, selectors, CSV export, persistence migration, reset
- **`Button.test.ts`** — `asChild` / Radix Slot rendering

The engine tests need no DOM or mocks, because the engine never needs them. The component test uses `renderToStaticMarkup`, so the suite still runs in a plain Node environment with no jsdom.

---

## Design

Deep-navy surface scale, violet primary accent, lime/amber/red reserved for
status only. Manrope with tabular numerals so every column of money lines up.
Rounded cards, hairline borders, subtle depth. Dark and light themes.

Desktop gets a sidebar showing the day counter, the safe-to-spend number and the
risk badge. Mobile gets a bottom bar plus a "More" sheet and a floating
Simulate button.

Accessibility: WCAG AA contrast, visible focus rings, keyboard-navigable menus and
dialogs, `aria-label`s on icon buttons, skeleton and empty states everywhere, and
a full `prefers-reduced-motion` opt-out that is also exposed as a setting.

---

## Known limitations

- Single-device only. State lives in `localStorage`; there is no sync, no account, no export-to-cloud.
- Recurrence supports once, weekly (n-weekly) and monthly (n-monthly). There is no "every 2 weeks" as a separate cadence type — it is the weekly rule with an interval.
- Monthly recurrence clamps to the last day of short months, so a 31st-of-the-month bill drifts to the 28th after February and stays there. This is deliberate, but it means the day-of-month is not restored on the 1st of the next month.
- The health score has no time dimension. It describes the current plan, not a trend.
- Bill payment reminders are in-app only — there is no push, email or calendar integration.
- "Cautious" mode is a floor (essentials only), not a statistical model. It is not a prediction, and nothing here is a forecast in the actuarial sense.
- The demo seed generates dates relative to the day you load it, so the numbers differ between devices. That is intentional.