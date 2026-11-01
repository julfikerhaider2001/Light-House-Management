import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import {
  Activity,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  LayoutGrid,
  Menu,
  Moon,
  Palette,
  Settings,
  Sun,
  UserRound,
  ReceiptText,
  ShoppingBag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { t, type MessageKey } from '../i18n';
import { useBundle } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import { toggleMode, useTheme } from '../lib/theme';
import { formatMonth } from '../lib/time';

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
  { to: '/settings', label: 'nav.settings', icon: Settings },
  { to: '/appearance', label: 'nav.appearance', icon: Palette },
  { to: '/profile', label: 'nav.profile', icon: UserRound },
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

/** Light/dark switch, on every screen. */
export function ThemeToggle() {
  const { resolved } = useTheme();
  const Icon = resolved === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={resolved === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      title={resolved === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      onClick={toggleMode}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

/** The mess name and month at the top of every screen, clear of the status bar. */
function AppBar() {
  const { messId, memberships } = useCurrentMess();
  const bundle = useBundle(messId);
  const name = memberships.find((m) => m.mess_id === messId)?.messes.name ?? t('app.name');
  const period = bundle.data?.period;
  const active = bundle.data?.members.filter((m) => m.status === 'active').length;
  return (
    <header className="appbar">
      <div className="appbar__inner">
        <span className="appbar__logo" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width="24" height="24" />
        </span>
        <div className="appbar__text">
          <strong className="appbar__name" data-testid="appbar-mess">
            {name}
          </strong>
          <span className="appbar__meta mono">
            {period ? (
              <>
                {formatMonth(period.month)} ·{' '}
                <b>{period.status === 'open' ? t('common.open') : t('common.closed')}</b>
                {active ? ` · ${t('appbar.members', { count: active })}` : ''}
              </>
            ) : (
              t('app.tagline')
            )}
          </span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

/** App bar on top, the page scrolling in between, tabs at the bottom (sidebar on desktop). */
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
      <AppBar />
      <main className="scroll" id="main">
        <div className="content">{children}</div>
      </main>
      <nav className="tabbar" aria-label={t('nav.primary')}>
        {TABS.map((item) => (
          <Item key={item.to} item={item} variant="tab" />
        ))}
      </nav>
    </div>
  );
}
