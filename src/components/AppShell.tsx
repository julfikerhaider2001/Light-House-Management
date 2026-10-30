import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import {
  Activity,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  LayoutGrid,
  Menu,
  ReceiptText,
  ShoppingBag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { t, type MessageKey } from '../i18n';

interface NavItem {
  to: string;
  label: MessageKey;
  icon: LucideIcon;
}

const TABS: NavItem[] = [
  { to: '/', label: 'nav.today', icon: CalendarCheck },
  { to: '/meals', label: 'nav.meals', icon: LayoutGrid },
  { to: '/bazar', label: 'nav.bazar', icon: ShoppingBag },
  { to: '/report', label: 'nav.report', icon: BarChart3 },
  { to: '/more', label: 'nav.more', icon: Menu },
];

// Desktop has room for every destination; phones reach these through More.
const SIDEBAR_EXTRA: NavItem[] = [
  { to: '/bills', label: 'nav.bills', icon: ReceiptText },
  { to: '/payments', label: 'nav.payments', icon: Wallet },
  { to: '/close', label: 'nav.close', icon: ClipboardCheck },
  { to: '/activity', label: 'nav.activity', icon: Activity },
  { to: '/members', label: 'nav.members', icon: Users },
];

function Item({ item, variant }: { item: NavItem; variant: 'tab' | 'side' }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.to === '/'} className={`nav-${variant}`}>
      <Icon size={variant === 'tab' ? 22 : 18} strokeWidth={1.5} aria-hidden="true" />
      <span>{t(item.label)}</span>
    </NavLink>
  );
}

/** Translucent chrome over scrolling content: bottom tabs on phones, sidebar on desktop. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <nav className="sidebar glass" aria-label={t('nav.primary')}>
        <div className="sidebar__brand">
          <span className="eyebrow mono">{t('app.tagline')}</span>
          <strong>{t('app.name')}</strong>
        </div>
        {[...TABS.slice(0, 4), ...SIDEBAR_EXTRA, TABS[4]].map(
          (item) => item && <Item key={item.to} item={item} variant="side" />,
        )}
      </nav>
      <main className="content" id="main">
        {children}
      </main>
      <nav className="tabbar glass" aria-label={t('nav.primary')}>
        {TABS.map((item) => (
          <Item key={item.to} item={item} variant="tab" />
        ))}
      </nav>
    </div>
  );
}
