import {
  ArrowLeftRight,
  BarChart3,
  Eye,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  PiggyBank,
  Settings as SettingsIcon,
  Target,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** shown in the mobile bottom bar (max 5 including More) */
  primary?: boolean;
  blurb: string;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, primary: true, blurb: 'Safe to spend today' },
  { to: '/transactions', label: 'Money in / out', icon: ArrowLeftRight, primary: true, blurb: 'Everything that moved' },
  { to: '/simulator', label: 'Simulator', icon: Eye, blurb: 'Try a decision before you make it' },
  { to: '/budget', label: 'Budget', icon: Wallet, blurb: 'Plan the month' },
  { to: '/bills', label: 'Bills', icon: PiggyBank, blurb: 'Subscriptions and due dates' },
  { to: '/goals', label: 'Goals', icon: Target, blurb: 'What you are saving for' },
  { to: '/insights', label: 'Insights', icon: BarChart3, blurb: 'The whole month, day by day' },
  { to: '/health', label: 'Health', icon: HeartPulse, blurb: 'How sturdy the plan is' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, blurb: 'Assumptions and data' },
];

export const PRIMARY_NAV = NAV.filter((n) => n.primary);
export const SECONDARY_NAV = NAV.filter((n) => !n.primary);

export const MORE_ITEMS: NavItem[] = [
  NAV.find((n) => n.to === '/simulator')!,
  NAV.find((n) => n.to === '/budget')!,
  NAV.find((n) => n.to === '/bills')!,
  NAV.find((n) => n.to === '/goals')!,
  NAV.find((n) => n.to === '/insights')!,
  NAV.find((n) => n.to === '/health')!,
];

export const ROUTE_TO_ICON: Record<string, LucideIcon> = NAV.reduce<Record<string, LucideIcon>>(
  (acc, item) => ({ ...acc, [item.to]: item.icon }),
  {},
);

export const GaugeIcon = Gauge;