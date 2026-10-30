// G6: Lighthouse 12 dropped the PWA category, so installability is asserted directly
// through Chrome's own check (CDP Page.getInstallabilityErrors) against `vite preview`.
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173/Light-House-Management/';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Reload so the page is controlled by the service worker, as Chrome requires.
  await page.reload({ waitUntil: 'networkidle' });

  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  const manifest = await cdp.send('Page.getAppManifest');

  console.log(`manifest: ${manifest.url}`);
  if (manifest.errors.length > 0) console.log('manifest errors:', manifest.errors);

  if (installabilityErrors.length > 0) {
    console.error('Not installable:');
    for (const e of installabilityErrors) console.error(`  - ${e.errorId}`, e.errorArguments);
    process.exit(1);
  }
  console.log('PWA installable: yes');
} finally {
  await browser.close();
}
