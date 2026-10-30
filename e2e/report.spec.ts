import { expect, test } from '@playwright/test';
import {
  BAZAR_TRIPS,
  INITIAL,
  MEMBERS,
  dailyMeals,
} from '../src/lib/calc/__fixtures__/october-2026';
import { apiAs, createMess, signUp, uniqueEmail } from './helpers';

// The golden October-2026 sheet, entered into a real mess, must produce the sheet's numbers.
test('month report matches the golden fixture', async ({ page }, info) => {
  test.setTimeout(90_000);
  const email = uniqueEmail(info, 'ayman');
  await signUp(page, 'Ayman', email);
  await createMess(page);

  const sb = await apiAs(email);
  const { data: me } = await sb.from('mess_members').select('id, mess_id').single();
  if (!me) throw new Error('no membership');
  const messId = me.mess_id;
  const { data: bundle } = await sb.rpc('get_period_bundle', { p_mess: messId });
  const period = (bundle as { period: { id: string; month: string } }).period;
  const day = (fixtureDate: string) => `${period.month.slice(0, 7)}-${fixtureDate.slice(8, 10)}`;

  // Placeholders for everyone but the manager; map fixture ids to real member ids by name.
  const others = MEMBERS.filter((m) => m.name !== 'Ayman').map((m) => ({
    mess_id: messId,
    display_name: m.name,
  }));
  expect((await sb.from('mess_members').insert(others)).error).toBeNull();
  const { data: rows } = await sb.from('mess_members').select('id, display_name');
  const idByName = new Map((rows ?? []).map((r) => [r.display_name, r.id]));
  const real = (fixtureId: string) =>
    idByName.get(MEMBERS.find((m) => m.id === fixtureId)?.name ?? '') ?? '';

  // Meals for every member and day (the manager may set anyone's meals in an open month).
  const meals = MEMBERS.flatMap((m) => dailyMeals(m.id).map((d) => ({ m: m.id, ...d })));
  for (let i = 0; i < meals.length; i += 24) {
    const batch = meals.slice(i, i + 24);
    const results = await Promise.all(
      batch.map((x) =>
        sb.rpc('set_meal', {
          p_mess: messId,
          p_member: real(x.m),
          p_date: day(x.date),
          p_meals: x.meals,
        }),
      ),
    );
    for (const r of results) expect(r.error).toBeNull();
  }

  const expenses = [
    ...Object.entries(BAZAR_TRIPS).flatMap(([fixtureId, trips]) =>
      trips.map((amount, i) => ({
        mess_id: messId,
        period_id: period.id,
        member_id: real(fixtureId),
        date: day(`2026-10-${String(i * 3 + 1).padStart(2, '0')}`),
        amount,
        kind: 'bazar' as const,
      })),
    ),
    ...INITIAL.map((x) => ({
      mess_id: messId,
      period_id: period.id,
      member_id: idByName.get(x.name) ?? '',
      date: day('2026-10-01'),
      amount: x.amount,
      kind: 'initial' as const,
    })),
  ];
  expect((await sb.from('expenses').insert(expenses)).error).toBeNull();

  const bills = [
    ['khala', 4500],
    ['house_rent', 15500],
    ['wifi', 650],
    ['gas', 460],
    ['extra', 300],
  ] as const;
  expect(
    (
      await sb
        .from('bills')
        .insert(
          bills.map(([kind, amount]) => ({ mess_id: messId, period_id: period.id, kind, amount })),
        )
    ).error,
  ).toBeNull();
  expect(
    (
      await sb.from('rent_shares').insert([
        {
          mess_id: messId,
          period_id: period.id,
          member_id: idByName.get('Saad') ?? '',
          fixed_amount: 3750,
        },
        {
          mess_id: messId,
          period_id: period.id,
          member_id: idByName.get('Asif') ?? '',
          fixed_amount: 3000,
        },
      ])
    ).error,
  ).toBeNull();

  await page.goto('./#/report');
  await expect(page.getByTestId('meal-rate')).toHaveText('৳92.53');
  await expect(page.getByTestId('final-ayman')).toHaveText('৳5,426');
  await expect(page.getByTestId('final-saad')).toHaveText('৳3,846');
  await expect(page.getByTestId('final-alif')).toHaveText('৳6,810');
  await expect(page.getByTestId('final-asif')).toHaveText('৳5,331');
  await expect(page.getByTestId('rent-ayman')).toHaveText('৳4,375');
  await expect(page.getByTestId('haveToPay-saad')).toHaveText('−৳1,313');
  await expect(page.getByTestId('sum-final')).toHaveText('৳21,413');
  await expect(page.getByTestId('sum-settled')).toHaveText('৳21,410');
});
