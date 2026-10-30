import { expect, test } from '@playwright/test';

test('shows the build version and a healthy database', async ({ page, request }) => {
  const res = await request.get('version.json');
  expect(res.ok()).toBe(true);
  const { version } = (await res.json()) as { version: string };

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Light House' })).toBeVisible();
  await expect(page.getByTestId('app-version')).toHaveText(version);
  await expect(page.getByText('HEALTHY')).toBeVisible({ timeout: 10_000 });
});
