import { expect, test } from '@playwright/test';

test('serves version.json for this build', async ({ request }) => {
  const res = await request.get('version.json');
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { version: string; builtAt: string };
  expect(body.version).toMatch(/^[0-9a-f]{7}$|^dev$/);
  expect(Date.parse(body.builtAt)).not.toBeNaN();
});
