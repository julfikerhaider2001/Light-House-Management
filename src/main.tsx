import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { registerSW } from 'virtual:pwa-register';
import { env } from './lib/env';
import { watchForNewBuild } from './lib/freshness';
import { initNative } from './lib/native';
import './styles/tokens.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

void initNative();

// autoUpdate: a new deploy's service worker takes over and the page reloads once, so
// returning visitors (and the APK, which loads this site) never keep an old build.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
  },
});

watchForNewBuild(env.appVersion);
