import { expect, test } from '@playwright/test';
import { createMess, inviteCode, signUp, uniqueEmail } from './helpers';

test('two people share a mess and see meal changes live', async ({ browser }, info) => {
  const managerCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const manager = await managerCtx.newPage();
  const member = await memberCtx.newPage();

  // Manager signs up and creates the mess.
  await signUp(manager, 'Ayman', uniqueEmail(info, 'ayman'));
  await createMess(manager);
  const code = await inviteCode(manager);

  // Member opens the invite link, signs up, and joins.
  await signUp(member, 'Saad', uniqueEmail(info, 'saad'), `./#/join/${code}`);
  await member.getByRole('button', { name: /^Join / }).click();
  await expect(member.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();

  // Both open the month grid on the 1st (the manager can edit any day of an open month).
  // The manager reloads once: on a freshly started local stack the first postgres_changes
  // subscriber creates the replication slot and can miss events while it warms up (the join).
  // The live path under test (manager edit → member screen, no reload) stays strict below.
  await manager.goto('./#/meals');
  await manager.reload();
  await member.goto('./#/meals');
  const saadDay1 = (page: typeof manager) =>
    page.getByRole('button', { name: /^Saad, \w{3} 1 \w{3}: / });
  await expect(saadDay1(member)).toHaveAccessibleName(/: 0$/);

  await saadDay1(manager).click();
  const add = manager.getByRole('button', { name: 'Add half a meal for Saad' });
  await add.click();
  await add.click();
  await expect(manager.getByRole('dialog').locator('.stepper__value')).toHaveText('1');

  // The member's screen updates through realtime, with no reload, within 3 s.
  await expect(saadDay1(member)).toHaveAccessibleName(/: 1$/, { timeout: 3_000 });

  // The member records an itemised bazar; the manager's Bazar screen shows it live.
  await manager.goto('./#/bazar');
  await member.goto('./#/bazar');
  await member.getByRole('button', { name: 'Add bazar' }).click();
  const sheet = member.getByRole('dialog');
  await sheet.getByRole('button', { name: '+ Add item' }).click();
  await sheet.getByLabel('Item 1').fill('murgi');
  await sheet.getByLabel('Amount 1').fill('230');
  await sheet.getByRole('button', { name: '+ Add item' }).click();
  await sheet.getByLabel('Item 2').fill('chal+milk');
  await sheet.getByLabel('Amount 2').fill('90');
  await expect(sheet.getByLabel('Total')).toHaveValue('320');
  await sheet.getByRole('button', { name: 'Save expense' }).click();
  await expect(member.getByRole('dialog')).toHaveCount(0);

  await expect(manager.getByTestId('expense-list')).toContainText('murgi-230, chal+milk-90', {
    timeout: 3_000,
  });

  await managerCtx.close();
  await memberCtx.close();
});
