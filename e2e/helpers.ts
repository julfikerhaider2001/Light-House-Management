import { expect, type Page, type TestInfo } from '@playwright/test';
import type { Database } from '../src/types/database';

export const PASSWORD = 'correct-horse-42';

export function uniqueEmail(info: TestInfo, who: string): string {
  return `e2e-${Date.now()}-${info.project.name}-${who}@example.com`;
}

/** Signs up through the UI; lands wherever the app sends a new user. */
export async function signUp(page: Page, name: string, email: string, path = './') {
  await page.goto(path);
  await page.getByRole('button', { name: /New here\?/ }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

export async function createMess(page: Page) {
  await expect(page.getByRole('heading', { name: 'Set up your mess' })).toBeVisible();
  await page.getByRole('button', { name: 'Create mess' }).click();
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
}

export async function inviteCode(page: Page): Promise<string> {
  await page.goto('./#/more');
  const code = page.getByTestId('invite-code');
  await expect(code).toHaveText(/^[A-Z2-9]{8}$/);
  return (await code.textContent())?.trim() ?? '';
}

/** A signed-in API client for seeding data as a real user (RLS applies). */
export async function apiAs(email: string) {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not set');
  const sb = createClient<Database>(url, key, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return sb;
}
