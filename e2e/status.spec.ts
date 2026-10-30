import { expect, test } from '@playwright/test';

test('public status page reports build, database and realtime', async ({ page, request }) => {
  const { version } = (await (await request.get('version.json')).json()) as { version: string };
  await page.goto('./#/status');
  await expect(page.getByRole('heading', { name: 'Status', level: 1 })).toBeVisible();
  await expect(page.getByText(version, { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('health-response')).toContainText(
    /GET health → 200 OK · \d+\.\d ms/,
  );
  await expect(page.getByTestId('health-response')).toContainText('"status": "healthy"');
  await expect(page.getByText('CONNECTED')).toBeVisible({ timeout: 10_000 });
});
