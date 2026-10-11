import { z } from 'zod';
import { isISODate, todayISO } from '@/engine/dates';
import { parseAmount } from '@/engine/money';
import { CATEGORIES } from '@/engine/categories';

const categoryIds = CATEGORIES.map((c) => c.id) as [string, ...string[]];

export const isoDate = z
  .string()
  .refine(isISODate, { message: 'Use a real date, like 2025-03-14' });

/** Accepts "1,250.50" or 1250.5 and always lands on integer paise. */
export const amountInPaise = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const paise = typeof value === 'string' ? parseAmount(value) : null;
    if (paise === null || !Number.isFinite(paise)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter an amount like 1,250.50' });
      return z.NEVER;
    }
    return paise;
  })
  .refine((paise) => paise > 0, { message: 'Amount must be more than ₹0' });

export const optionalNote = z
  .string()
  .trim()
  .max(120, 'Keep notes under 120 characters')
  .optional()
  .or(z.literal('').transform(() => undefined));

/* ------------------------------- item -------------------------------- */

export const recurrenceSchema = z.object({
  type: z.enum(['once', 'weekly', 'monthly']),
  startDate: isoDate,
  endDate: isoDate.nullish(),
  cancelledFrom: isoDate.nullish(),
  paused: z.boolean().optional(),
  interval: z.number().int().min(1).max(12).optional(),
});

export const itemSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, 'Give this a name').max(60, 'Keep it under 60 characters'),
    amount: amountInPaise,
    kind: z.enum(['income', 'expense']),
    category: z.enum(categoryIds),
    date: isoDate,
    status: z.enum(['scheduled', 'paid']).default('scheduled'),
    recurring: z.boolean().default(false),
    interval: z.number().int().min(1).max(12).default(1),
    essential: z.boolean().default(false),
    note: optionalNote,
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'income' && value.category !== 'income') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'Income must be in the Income category',
      });
    }
    if (value.kind === 'expense' && value.category === 'income') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'Pick an expense category',
      });
    }
  });

export type ItemFormValues = z.input<typeof itemSchema>;
export type ItemFormOutput = z.output<typeof itemSchema>;

/* ------------------------------ budgets ------------------------------ */

export const budgetSchema = z.object({
  openingBalance: amountInPaise,
  reserveTarget: z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      const paise = typeof v === 'string' ? parseAmount(v) : Math.round(Number(v) * 100);
      if (paise === null || !Number.isFinite(paise) || paise < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter ₹0 or more' });
        return z.NEVER;
      }
      return paise;
    }),
  allowanceFloor: z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      const paise = typeof v === 'string' ? parseAmount(v) : Math.round(Number(v) * 100);
      if (paise === null || !Number.isFinite(paise) || paise < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter ₹0 or more' });
        return z.NEVER;
      }
      return paise;
    }),
  durationDays: z.coerce.number().int().min(7, 'Run it for at least 7 days').max(90, '90 days maximum'),
  startDate: isoDate,
  plannedIncome: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'string' ? (parseAmount(v) ?? 0) : Math.round(Number(v) * 100)))
    .refine((v) => v >= 0, { message: 'Enter ₹0 or more' }),
});

export type BudgetSettingsValues = z.input<typeof budgetSchema>;
export type BudgetSettingsOutput = z.output<typeof budgetSchema>;

/* ------------------------------- goals ------------------------------- */

export const goalSchema = z.object({
  title: z.string().trim().min(1, 'Name the goal').max(50, 'Keep it under 50 characters'),
  target: amountInPaise,
  saved: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'string' ? (parseAmount(v) ?? 0) : Math.round(Number(v) * 100)))
    .refine((v) => v >= 0, { message: 'Enter ₹0 or more' }),
  deadline: isoDate,
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export type GoalFormValues = z.input<typeof goalSchema>;

/* ------------------------------ profile ------------------------------ */

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'What should we call you?').max(30, 'Keep it under 30 characters'),
  city: z.string().trim().max(30).optional().or(z.literal('')),
});

export const onboardingSteps = [
  { id: 'welcome', title: 'Your money, made visible' },
  { id: 'opening', title: 'What are you starting with?' },
  { id: 'reserve', title: 'How much is untouchable?' },
  { id: 'income', title: 'What is coming in?' },
  { id: 'bills', title: 'What is already committed?' },
  { id: 'ready', title: 'Ready when you are' },
] as const;

export type OnboardingStepId = (typeof onboardingSteps)[number]['id'];

export const presetAmounts = [
  { label: '₹5,000', paise: 500_000 },
  { label: '₹10,000', paise: 1_000_000 },
  { label: '₹15,000', paise: 1_500_000 },
  { label: '₹20,000', paise: 2_000_000 },
];

export function defaultDate() {
  return todayISO();
}