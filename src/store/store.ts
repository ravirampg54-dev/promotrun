import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { addDays, todayISO } from '@/engine/dates';
import type { ISODate } from '@/engine/dates';
import { derive } from '@/engine/derive';
import type { Derived } from '@/engine/derive';
import type { CategoryId, Goal, Item, Settings } from '@/engine/types';
import { commitScenario } from '@/engine/scenarios';
import type { ScenarioAction } from '@/engine/scenarios';
import type { RiskLevel } from '@/engine/risk';
import {
  STORE_VERSION,
  defaultSettings,
  demoData,
  initialState,
  migrate,
  uid,
} from './shape';
import type { AppNotification, StoreState } from './shape';

export type ItemDraft = Omit<Item, 'id' | 'createdAt'> & Partial<Pick<Item, 'id' | 'createdAt'>>;
export type GoalDraft = Omit<Goal, 'id' | 'createdAt'> & Partial<Pick<Goal, 'id' | 'createdAt'>>;

export interface StoreActions {
  /* profile + settings */
  setProfile: (patch: Partial<StoreState['profile']>) => void;
  finishOnboarding: (patch: Partial<StoreState['profile']>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  startFreshRun: () => void;
  setToday: (date: ISODate) => void;
  jumpDays: (delta: number) => void;

  /* items */
  addItem: (draft: ItemDraft) => string;
  updateItem: (id: string, patch: Partial<Item>) => void;
  removeItem: (id: string) => void;
  setItemStatus: (id: string, status: Item['status']) => void;
  togglePaid: (id: string) => void;
  duplicateItem: (id: string) => string | null;

  /* goals */
  addGoal: (draft: GoalDraft) => string;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  contributeGoal: (id: string, amount: number) => void;

  /* budget */
  setBudgetLine: (category: CategoryId, allocated: number) => void;
  clearBudget: () => void;

  /* simulator */
  applyScenarioActions: (commitId: string, actions: readonly ScenarioAction[]) => boolean;

  /* notifications */
  syncNotifications: (risk: Derived['risk']) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

  /* misc */
  setEmergencyMode: (on: boolean) => void;
  loadDemo: () => void;
  resetAll: () => void;
}

export type AppStore = StoreState & StoreActions;

const now = () => new Date().toISOString();

/**
 * localStorage is unavailable in private-mode Safari, in Node (tests) and when
 * a browser blocks storage. Falling back to an in-memory map keeps the app
 * usable instead of throwing on every write.
 */
const memoryStorage = new Map<string, string>();

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      if (typeof localStorage === 'undefined') return memoryStorage.get(name) ?? null;
      return localStorage.getItem(name);
    } catch {
      return memoryStorage.get(name) ?? null;
    }
  },
  setItem: (name, value) => {
    try {
      if (typeof localStorage === 'undefined') {
        memoryStorage.set(name, value);
        return;
      }
      localStorage.setItem(name, value);
    } catch {
      memoryStorage.set(name, value);
    }
  },
  removeItem: (name) => {
    try {
      if (typeof localStorage === 'undefined') {
        memoryStorage.delete(name);
        return;
      }
      localStorage.removeItem(name);
    } catch {
      memoryStorage.delete(name);
    }
  },
};

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      finishOnboarding: (patch) =>
        set((s) => ({ profile: { ...s.profile, ...patch, onboarded: true } })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      startFreshRun: () =>
        set((s) => ({
          today: todayISO(),
          settings: { ...defaultSettings(todayISO()) },
          profile: { ...s.profile, onboarded: true },
        })),

      setToday: (date) => set({ today: date }),

      jumpDays: (delta) => set((s) => ({ today: addDays(s.today, delta) })),

      addItem: (draft) => {
        const id = draft.id ?? uid('item');
        const item: Item = {
          ...draft,
          id,
          createdAt: draft.createdAt ?? get().today,
        } as Item;
        set((s) => ({ items: [...s.items, item], lastSavedAt: now() }));
        return id;
      },

      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((item) => (item.id === id ? { ...item, ...patch, id } : item)),
          lastSavedAt: now(),
        })),

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((item) => item.id !== id), lastSavedAt: now() })),

      setItemStatus: (id, status) =>
        set((s) => ({
          items: s.items.map((item) => (item.id === id ? { ...item, status } : item)),
          lastSavedAt: now(),
        })),

      togglePaid: (id) =>
        set((s) => ({
          items: s.items.map((item) =>
            item.id === id ? { ...item, status: item.status === 'paid' ? 'scheduled' : 'paid' } : item,
          ),
          lastSavedAt: now(),
        })),

      duplicateItem: (id) => {
        const source = get().items.find((item) => item.id === id);
        if (!source) return null;
        const copyId = uid('item');
        set((s) => ({
          items: [
            ...s.items,
            { ...source, id: copyId, title: `${source.title} (copy)`, createdAt: s.today },
          ],
          lastSavedAt: now(),
        }));
        return copyId;
      },

      addGoal: (draft) => {
        const id = draft.id ?? uid('goal');
        set((s) => ({
          goals: [...s.goals, { ...draft, id, createdAt: draft.createdAt ?? s.today } as Goal],
          lastSavedAt: now(),
        }));
        return id;
      },

      updateGoal: (id, patch) =>
        set((s) => ({
          goals: s.goals.map((goal) => (goal.id === id ? { ...goal, ...patch, id } : goal)),
          lastSavedAt: now(),
        })),

      removeGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((goal) => goal.id !== id), lastSavedAt: now() })),

      contributeGoal: (id, amount) =>
        set((s) => ({
          goals: s.goals.map((goal) =>
            goal.id === id ? { ...goal, saved: Math.max(0, goal.saved + amount) } : goal,
          ),
          lastSavedAt: now(),
        })),

      setBudgetLine: (category, allocated) =>
        set((s) => {
          const exists = s.budget.some((line) => line.category === category);
          return {
            budget: exists
              ? s.budget.map((line) =>
                  line.category === category ? { ...line, allocated: Math.max(0, allocated) } : line,
                )
              : [...s.budget, { category, allocated: Math.max(0, allocated) }],
            lastSavedAt: now(),
          };
        }),

      clearBudget: () => set({ budget: [], lastSavedAt: now() }),

      /**
       * The only door into real state for a scenario. The commitId guard makes
       * a double-tap impossible: the second call returns false and does nothing.
       */
      applyScenarioActions: (commitId, actions) => {
        if (get().appliedCommits.includes(commitId)) return false;
        const s = get();
        const next = commitScenario(toData(s), actions);
        set({
          items: next.items,
          goals: next.goals,
          settings: next.settings,
          budget: next.budget,
          appliedCommits: [...s.appliedCommits, commitId].slice(-50),
          lastSavedAt: now(),
        });
        return true;
      },

      syncNotifications: (risk) => {
        const s = get();
        const fresh = risk.warnings.filter((w) => !s.seenWarnings.includes(w.id));
        if (fresh.length === 0) return;
        const created: AppNotification[] = fresh.map((warning) => ({
          id: warning.id,
          title: warning.title,
          body: warning.nextStep,
          level: warning.level as RiskLevel,
          createdAt: now(),
          read: false,
        }));
        set({
          notifications: [...created, ...s.notifications].slice(0, 40),
          seenWarnings: [...s.seenWarnings, ...fresh.map((w) => w.id)].slice(-100),
        });
      },

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),

      markAllNotificationsRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      clearNotifications: () => set({ notifications: [] }),

      setEmergencyMode: (on) => set({ emergencyMode: on }),

      loadDemo: () => {
        const today = todayISO();
        const demo = demoData(today);
        set({
          ...initialState(today),
          profile: demo.profile,
          settings: demo.settings,
          items: demo.items,
          goals: demo.goals,
          budget: demo.budget,
        });
      },

      resetAll: () => {
        const today = todayISO();
        set({ ...initialState(today) });
      },
    }),
    {
name: 'rupee10k.v3',
      version: STORE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        version: state.version,
        today: state.today,
        profile: state.profile,
        settings: state.settings,
        items: state.items,
        goals: state.goals,
        budget: state.budget,
        notifications: state.notifications,
        seenWarnings: state.seenWarnings,
        appliedCommits: state.appliedCommits,
        emergencyMode: state.emergencyMode,
        lastSavedAt: state.lastSavedAt,
      }),
      migrate: (persisted, _version) => migrate(persisted, todayISO()),
      onRehydrateStorage: () => (state) => {
        // keep "today" honest after the tab was closed for a while
        if (state) state.setToday(state.profile.onboarded ? todayISO() : state.today);
      },
    },
  ),
);

function toData(state: StoreState) {
  return {
    profile: state.profile,
    settings: state.settings,
    items: state.items,
    goals: state.goals,
    budget: state.budget,
  };
}

/* ------------------------------------------------------------------ *
 * Selectors — the only place components are allowed to get numbers.   *
 * ------------------------------------------------------------------ */

/** Pure derivation of the whole store. Cheap enough to call on render. */
export function computeDerived(
  state: Pick<StoreState, 'items' | 'goals' | 'settings' | 'budget' | 'today'>,
): Derived {
  return derive(
    {
      profile: { name: '', city: '', onboarded: true, demo: false },
      settings: state.settings,
      items: state.items,
      goals: state.goals,
      budget: state.budget,
    },
    state.today,
  );
}

export function dataOf(state: StoreState) {
  return toData(state);
}