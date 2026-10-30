begin;
select no_plan();

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'ayman@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'saad@test.local');

-- Ayman creates the mess (names come from the email prefix); Alif is a placeholder (no account, so no email); Saad joins.
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select public.create_mess('Mess A');
insert into public.mess_members (mess_id, display_name) select id, 'Alif' from public.messes;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select public.join_mess((select invite_code from public.messes));

set local role authenticated;
select throws_ok(
  $$ select * from public.member_contacts((select id from public.messes)) $$,
  '42501',
  null,
  'members cannot read email addresses'
);

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select results_eq(
  $$ select display_name, email from public.member_contacts((select id from public.messes)) $$,
  $$ values ('ayman'::text, 'ayman@test.local'::text), ('saad', 'saad@test.local') $$,
  'the manager gets every joined member''s email; placeholders have none'
);

reset role;
select * from finish();
rollback;
