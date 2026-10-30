import { lazy, Suspense, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/ui';
import { ToastProvider } from './components/Toast';
import { t } from './i18n';
import { CurrentMessContext } from './lib/api/current';
import { rememberedMess, rememberMess, useMemberships } from './lib/api/mess';
import { useMyProfile } from './lib/api/profile';
import { useMessRealtime } from './lib/api/realtime';
import { useSession } from './lib/api/session';
import { SessionProvider } from './components/SessionProvider';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const AddPhotoPage = lazy(() => import('./pages/AddPhotoPage'));
const TodayPage = lazy(() => import('./pages/TodayPage'));
const MealsPage = lazy(() => import('./pages/MealsPage'));
const MorePage = lazy(() => import('./pages/MorePage'));
const BazarPage = lazy(() => import('./pages/BazarPage'));
const BillsPage = lazy(() => import('./pages/BillsPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const ClosePage = lazy(() => import('./pages/ClosePage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));

const loading = <Spinner label={t('common.loading')} />;

export function App() {
  return (
    <HashRouter>
      <SessionProvider>
        <ToastProvider>
          <Suspense fallback={loading}>
            <Routes>
              <Route
                path="/join/:code"
                element={
                  <RequireSession>
                    <OnboardingPage />
                  </RequireSession>
                }
              />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route
                path="/*"
                element={
                  <RequireSession>
                    <InMess />
                  </RequireSession>
                }
              />
            </Routes>
          </Suspense>
        </ToastProvider>
      </SessionProvider>
    </HashRouter>
  );
}

function RequireSession({ children }: { children: ReactNode }) {
  const state = useSession();
  const location = useLocation();
  if (state.status === 'loading') return loading;
  if (!state.session) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return children;
}

/** Picks the current mess (remembered, else the first) and mounts the live shell. */
function InMess() {
  const state = useSession();
  const userId = state.status === 'ready' ? state.session?.user.id : undefined;
  const memberships = useMemberships(userId);
  const profile = useMyProfile(userId);
  const [selected, setSelected] = useState(rememberedMess);

  if (memberships.isPending || profile.isPending || !userId) return loading;
  // Photos are required; accounts from before that rule add one once.
  if (profile.data && profile.data.avatar_path === null) {
    return <AddPhotoPage userId={userId} name={profile.data.display_name} />;
  }
  if (memberships.isError) return <Navigate to="/auth" replace />;

  const list = memberships.data;
  const current = list.find((m) => m.mess_id === selected) ?? list[0];
  if (!current) return <OnboardingPage />;

  return (
    <CurrentMessContext.Provider
      value={{
        userId,
        messId: current.mess_id,
        memberId: current.id,
        isManager: current.role === 'manager' && current.status === 'active',
        memberships: list,
        switchMess: (messId) => {
          rememberMess(messId);
          setSelected(messId);
        },
      }}
    >
      <Live messId={current.mess_id}>
        <AppShell>
          <Suspense fallback={loading}>
            <Routes>
              <Route index element={<TodayPage />} />
              <Route path="meals" element={<MealsPage />} />
              <Route path="bazar" element={<BazarPage />} />
              <Route path="bills" element={<BillsPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="report" element={<ReportPage />} />
              <Route path="close" element={<ClosePage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="more" element={<MorePage />} />
              <Route path="onboarding" element={<OnboardingPage />} />
              <Route path="*" element={<PlaceholderPage />} />
            </Routes>
          </Suspense>
        </AppShell>
      </Live>
    </CurrentMessContext.Provider>
  );
}

function Live({ messId, children }: { messId: string; children: ReactNode }) {
  useMessRealtime(messId);
  return children;
}
