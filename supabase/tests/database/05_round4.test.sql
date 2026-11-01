begin;
select no_plan();

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'ayman@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'saad@test.local');

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select public.create_mess('Mess A');
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select public.join_mess((select invite_code from public.messes));

-- Fixtures the authenticated role can read back.
create temporary table ids on commit drop as
select
  (select id from public.messes) as mess,
  (select id from public.periods) as period,
  (select month from public.periods) as month,
  (select id from public.mess_members where user_id = '11111111-1111-4111-8111-111111111111') as ayman,
  (select id from public.mess_members where user_id = '22222222-2222-4222-8222-222222222222') as saad;
grant select on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

-- Payments: for this month by default, or for the previous due; nothing else.
select lives_ok(
  $$ insert into public.payments (mess_id, period_id, member_id, amount, date)
     select mess, period, ayman, 100, month from ids $$,
  'a payment without applies_to is accepted'
);
select is(
  (select applies_to from public.payments order by created_at limit 1),
  'month',
  'it counts towards this month'
);
select lives_ok(
  $$ insert into public.payments (mess_id, period_id, member_id, amount, date, applies_to)
     select mess, period, saad, 250, month, 'previous_due' from ids $$,
  'any member can record a payment towards a previous due'
);
select throws_ok(
  $$ insert into public.payments (mess_id, period_id, member_id, amount, date, applies_to)
     select mess, period, saad, 1, month, 'whatever' from ids $$,
  '23514',
  null,
  'applies_to only allows month or previous_due'
);
select lives_ok(
  $$ update public.payments set applies_to = 'previous_due'
     where member_id = (select ayman from ids) $$,
  'a payment can be moved to the previous due'
);

-- Bazar entries can be corrected, including who paid.
select lives_ok(
  $$ insert into public.expenses (mess_id, period_id, member_id, date, amount)
     select mess, period, ayman, month, 500 from ids $$,
  'add a bazar entry'
);
select lives_ok(
  $$ update public.expenses set member_id = (select saad from ids), amount = 450 $$,
  'edit the amount and the payer'
);
select is(
  (select (member_id = (select saad from ids)) and amount = 450 from public.expenses),
  true,
  'the corrected entry is saved'
);

-- Removing a profile photo on purpose.
select lives_ok(
  $$ update public.profiles set avatar_path = null, photo_removed = true
     where id = '11111111-1111-4111-8111-111111111111' $$,
  'people can remove their own photo'
);
select is(
  (select photo_removed from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  true,
  'and it is remembered as a choice'
);

-- Only the mailer marks a month as emailed.
select throws_ok(
  $$ update public.periods set emailed_at = now() $$,
  '42501',
  null,
  'members cannot set emailed_at'
);

-- Reopening clears emailed_at so the corrected month is emailed again.
select lives_ok(
  $$ select public.close_period((select period from ids), '{}'::jsonb, '[]'::jsonb) $$,
  'close the month'
);
reset role;
update public.periods set emailed_at = now() where id = (select period from ids);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$ select public.reopen_period((select period from ids), 'fix a bazar entry') $$,
  'reopen it'
);
select is(
  (select emailed_at from public.periods where id = (select period from ids)),
  null,
  'reopening clears emailed_at'
);

reset role;
select * from finish();
rollback;
