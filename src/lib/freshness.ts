// Belt and braces for "I'm still on an old build": an open tab (or the APK) can live for
// days without a reload, because moving between screens never reloads the page. Whenever
// the app comes back into view, compare our build with the live /version.json and reload
// once if a newer one is deployed.

const CHECK_EVERY_MS = 10 * 60 * 1000;
let lastCheck = 0;

export async function reloadIfStale(current: string, fetcher: typeof fetch = fetch) {
  if (current === 'dev') return false;
  const now = Date.now();
  if (now - lastCheck < 30_000) return false;
  lastCheck = now;
  try {
    const res = await fetcher(`${import.meta.env.BASE_URL}version.json?t=${now}`, {
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const { version } = (await res.json()) as { version?: string };
    if (version && version !== current) {
      location.reload();
      return true;
    }
  } catch {
    // Offline: try again next time.
  }
  return false;
}

export function watchForNewBuild(current: string) {
  const check = () => void reloadIfStale(current);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', check);
  setInterval(check, CHECK_EVERY_MS);
}
