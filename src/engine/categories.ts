import type { Category, CategoryId } from './types';

/** The default spending plan used by onboarding and the demo seed. */
export const CATEGORIES: Category[] = [
  { id: 'food', label: 'Food & groceries', essential: true, flow: 'expense', hue: 28 },
  { id: 'transport', label: 'Transport & fuel', essential: true, flow: 'expense', hue: 199 },
  { id: 'rent', label: 'Rent / share', essential: true, flow: 'expense', hue: 258 },
  { id: 'utilities', label: 'Electricity & water', essential: true, flow: 'expense', hue: 172 },
  { id: 'bills', label: 'Bills & subscriptions', essential: true, flow: 'expense', hue: 214 },
  { id: 'health', label: 'Health & medicine', essential: true, flow: 'expense', hue: 342 },
  { id: 'education', label: 'Courses & study', essential: false, flow: 'expense', hue: 224 },
  { id: 'entertainment', label: 'Fun & eating out', essential: false, flow: 'expense', hue: 330 },
  { id: 'shopping', label: 'Shopping & clothes', essential: false, flow: 'expense', hue: 292 },
  { id: 'emergency', label: 'Emergency fund', essential: true, flow: 'expense', hue: 96 },
  { id: 'transfer', label: 'Savings transfer', essential: false, flow: 'expense', hue: 150 },
  { id: 'income', label: 'Income', essential: false, flow: 'income', hue: 140 },
];

const BY_ID = new Map<CategoryId, Category>(CATEGORIES.map((c) => [c.id, c]));

export function category(id: CategoryId): Category {
  return BY_ID.get(id) ?? CATEGORIES[0];
}

export function categoryLabel(id: CategoryId): string {
  return category(id).label;
}

export function isEssentialCategory(id: CategoryId): boolean {
  return category(id).essential;
}

export function categoryHue(id: CategoryId): number {
  return category(id).hue;
}

export const EXPENSE_CATEGORIES = CATEGORIES.filter(
  (c) => c.flow === 'expense' && c.id !== 'transfer' && c.id !== 'emergency',
);

export const ESSENTIAL_CATEGORIES = CATEGORIES.filter((c) => c.essential && c.flow === 'expense');

export const DISCRETIONARY_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => !c.essential);