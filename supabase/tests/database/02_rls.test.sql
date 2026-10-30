-- RLS and RPC rules, exercised as real users across two messes.
--   Mess A: Ayman (manager), Saad (member), Alif (claimed placeholder). Its month is in the future.
--   Mess B: X (manager), Saad (member). Its month is in the past, so members are past cutoff.
begin;
select no_plan();

-- ---------------------------------------------------------------------------
-- Test harness (rolled back with the transaction)
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to authenticated, anon;
create table tests.kv (k text primary key, v text not null);
grant select, insert on tests.kv to authenticated;

create function tests.val(p_k text) returns text language sql stable
as $$ select v from tests.kv where k = p_k $$;
create function tests.id(p_k text) returns uuid language sql stable
as $$ select v::uuid from tests.kv where k = p_k $$;
create function tests.month(p_k text) returns date language sql stable security definer
as $$ select month from public.periods where id = (select v::uuid from tests.kv where k = p_k) $$;
create function tests.login(p_k text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.id(p_k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
-- Row count of a write, so silent RLS filtering on UPDATE is observable.
create function tests.affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on all functions in schema tests to authenticated, anon;

insert into tests.kv values
  ('ayman', '11111111-1111-4111-8111-111111111111'),
  ('saad', '22222222-2222-4222-8222-222222222222'),
  ('alif', '33333333-3333-4333-8333-333333333333'),
  ('x', '44444444-4444-4444-8444-444444444444');

insert into auth.users (id, email, raw_user_meta_data)
select v::uuid, k || '@test.local', jsonb_build_object('display_name', initcap(k))
from tests.kv;

select is(
  (select display_name from public.profiles where id = tests.id('ayman')),
  'Ayman',
  'a profile is created with each auth user'
);

-- ---------------------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------------------
select tests.login('ayman');
insert into tests.kv
select 'A.' || key, value
from jsonb_each_text(public.create_mess('Mess A', 'Ayman'));
select isnt(tests.val('A.mess_id'), null, 'create_mess returns the new mess');
select is(
  (select role::text from public.mess_members where id = tests.id('A.member_id')),
  'manager',
  'the creator becomes manager'
);
select lives_ok(
  $$ insert into public.mess_members (mess_id, display_name)
     values (tests.id('A.mess_id'), 'Alif') $$,
  'manager adds a placeholder member'
);
select throws_ok(
  $$ insert into public.mess_members (mess_id, display_name, user_id)
     values (tests.id('A.mess_id'), 'Sneaky', tests.id('x')) $$,
  '42501',
  null,
  'manager cannot attach an arbitrary user to a member'
);

select tests.login('saad');
select is(
  public.preview_invite(tests.val('A.invite_code')) ->> 'name',
  'Mess A',
  'invite preview shows the mess name'
);
select ok(
  public.preview_invite(lower(tests.val('A.invite_code'))) -> 'placeholders'
    @> '[{"display_name": "Alif"}]',
  'invite preview lists unclaimed placeholders (code is case-insensitive)'
);
insert into tests.kv
select 'A.saad', public.join_mess(tests.val('A.invite_code'), 'Saad') ->> 'member_id';
select is(
  public.join_mess(tests.val('A.invite_code'), 'Saad') ->> 'member_id',
  tests.val('A.saad'),
  'joining twice returns the same membership'
);
select throws_ok(
  $$ insert into public.mess_members (mess_id, display_name)
     values (tests.id('A.mess_id'), 'Nope') $$,
  '42501',
  null,
  'members cannot add members'
);

select tests.login('alif');
insert into tests.kv
select 'A.alif', public.join_mess(
  tests.val('A.invite_code'),
  null,
  (public.preview_invite(tests.val('A.invite_code')) -> 'placeholders' -> 0 ->> 'id')::uuid
) ->> 'member_id';
select is(
  (select user_id from public.mess_members where id = tests.id('A.alif')),
  tests.id('alif'),
  'a placeholder is claimed via invite code'
);

select tests.login('x');
insert into tests.kv
select 'B.' || key, value
from jsonb_each_text(public.create_mess('Mess B', 'X'));
select throws_like(
  $$ select public.join_mess(tests.val('A.invite_code'), null, tests.id('A.alif')) $$,
  '%already claimed%',
  'a claimed placeholder cannot be claimed again'
);

select tests.login('saad');
insert into tests.kv
select 'B.saad', public.join_mess(tests.val('B.invite_code')) ->> 'member_id';

-- Pin the months: Mess A entirely in the future, Mess B entirely in the past.
reset role;
update public.periods set month = (date_trunc('month', now()) + interval '2 month')::date
where id = tests.id('A.period_id');
update public.periods set month = (date_trunc('month', now()) - interval '2 month')::date
where id = tests.id('B.period_id');

-- ---------------------------------------------------------------------------
-- Meals
-- ---------------------------------------------------------------------------
select tests.login('saad');
select lives_ok(
  $$ select public.set_meal(tests.id('A.mess_id'), tests.id('A.saad'),
                            tests.month('A.period_id') + 3, 2.5) $$,
  'member sets own meals before the cutoff'
);
select lives_ok(
  $$ select public.set_meal(tests.id('A.mess_id'), tests.id('A.saad'),
                            tests.month('A.period_id') + 3, 3) $$,
  'member updates own meals before the cutoff (upsert)'
);
select throws_ok(
  $$ select public.set_meal(tests.id('A.mess_id'), tests.id('A.member_id'),
                            tests.month('A.period_id') + 3, 1) $$,
  '42501',
  null,
  'member cannot set someone else''s meals'
);
select throws_ok(
  $$ select public.set_meal(tests.id('A.mess_id'), tests.id('A.saad'),
                            tests.month('A.period_id') + 4, 0.3) $$,
  '23514',
  null,
  'meals must be in 0.5 steps'
);
select throws_ok(
  $$ select public.set_meal(tests.id('B.mess_id'), tests.id('B.saad'),
                            tests.month('B.period_id') + 3, 1) $$,
  '42501',
  null,
  'member cannot set meals after the cutoff'
);

select tests.login('ayman');
select lives_ok(
  $$ select public.set_meal(tests.id('A.mess_id'), tests.id('A.saad'),
                            tests.month('A.period_id') + 5, 1.5) $$,
  'manager sets any member''s meals'
);

select tests.login('x');
select lives_ok(
  $$ select public.set_meal(tests.id('B.mess_id'), tests.id('B.saad'),
                            tests.month('B.period_id') + 3, 1) $$,
  'manager sets meals after the cutoff while the period is open'
);

-- ---------------------------------------------------------------------------
-- Isolation between messes
-- ---------------------------------------------------------------------------
select tests.login('x');
select is((select count(*) from public.messes), 1::bigint, 'X sees only their own mess');
select is(
  (select count(*) from public.meal_entries where mess_id = tests.id('A.mess_id')),
  0::bigint,
  'X cannot read another mess''s meals'
);
select is(
  (select count(*) from public.mess_members where mess_id = tests.id('A.mess_id')),
  0::bigint,
  'X cannot read another mess''s members'
);
select is(
  (select count(*) from public.activity_log where mess_id = tests.id('A.mess_id')),
  0::bigint,
  'X cannot read another mess''s activity'
);
select is(
  (select count(*) from public.periods where mess_id = tests.id('A.mess_id')),
  0::bigint,
  'X cannot read another mess''s periods'
);
select is(public.get_period_bundle(tests.id('A.mess_id')), null, 'X gets no bundle for Mess A');
select is(
  (select count(*) from public.profiles where id = tests.id('alif')),
  0::bigint,
  'X cannot read profiles of people outside their messes'
);
select is(
  (select count(*) from public.profiles where id = tests.id('saad')),
  1::bigint,
  'X can read profiles of mess-mates'
);
select throws_ok(
  $$ select public.set_meal(tests.id('A.mess_id'), tests.id('A.saad'),
                            tests.month('A.period_id') + 6, 1) $$,
  '23514',
  null,
  'X cannot write meals into Mess A (no visible open month)'
);

select tests.login('saad');
select is((select count(*) from public.messes), 2::bigint, 'Saad sees both of his messes');

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
select tests.login('saad');
select lives_ok(
  $$ insert into public.expenses (mess_id, period_id, member_id, date, amount, items)
     values (tests.id('A.mess_id'), tests.id('A.period_id'), tests.id('A.saad'),
             tests.month('A.period_id') + 1, 320,
             '[{"name":"murgi","amount":230},{"name":"chal+milk","amount":90}]') $$,
  'member adds an itemised bazar they paid for'
);
select throws_ok(
  $$ insert into public.expenses (mess_id, period_id, member_id, date, amount, items)
     values (tests.id('A.mess_id'), tests.id('A.period_id'), tests.id('A.saad'),
             tests.month('A.period_id') + 1, 300, '[{"name":"murgi","amount":230}]') $$,
  '23514',
  null,
  'items must sum to the amount'
);
select throws_ok(
  $$ insert into public.expenses (mess_id, period_id, member_id, date, amount)
     values (tests.id('A.mess_id'), tests.id('A.period_id'), tests.id('A.member_id'),
             tests.month('A.period_id') + 1, 100) $$,
  '42501',
  null,
  'member cannot add an expense paid by someone else'
);
select throws_like(
  $$ insert into public.expenses (mess_id, period_id, member_id, date, amount)
     values (tests.id('A.mess_id'), tests.id('A.period_id'), tests.id('A.saad'),
             tests.month('A.period_id') + 40, 100) $$,
  '%outside this month%',
  'expense dates must fall inside the period'
);

select tests.login('ayman');
with e as (
  insert into public.expenses (mess_id, period_id, member_id, date, amount, kind)
  values (tests.id('A.mess_id'), tests.id('A.period_id'), tests.id('A.member_id'),
          tests.month('A.period_id') + 2, 115, 'initial')
  returning id
)
insert into tests.kv select 'A.ayman_exp', id::text from e;

select tests.login('saad');
select is(
  tests.affected($$ update public.expenses set note = 'hacked' where id = tests.id('A.ayman_exp') $$),
  0,
  'member cannot edit someone else''s expense'
);
select is(
  tests.affected($$ update public.expenses set note = 'Karwan bazar'
                    where member_id = tests.id('A.saad') $$),
  1,
  'member edits own expense while the period is open'
);

-- ---------------------------------------------------------------------------
-- Bills
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.bills (mess_id, period_id, kind, amount)
     values (tests.id('A.mess_id'), tests.id('A.period_id'), 'wifi', 650) $$,
  '42501',
  null,
  'members cannot add bills'
);
select tests.login('ayman');
select lives_ok(
  $$ insert into public.bills (mess_id, period_id, kind, amount)
     values (tests.id('A.mess_id'), tests.id('A.period_id'), 'khala', 4500) $$,
  'manager adds bills'
);

-- ---------------------------------------------------------------------------
-- Soft delete, bundle and activity log
-- ---------------------------------------------------------------------------
select tests.login('saad');
select is(
  tests.affected($$ update public.meal_entries set deleted_at = now()
                    where member_id = tests.id('A.saad')
                      and date = tests.month('A.period_id') + 3 $$),
  1,
  'member soft-deletes own meal entry'
);
select is(
  jsonb_array_length(public.get_period_bundle(tests.id('A.mess_id')) -> 'meals'),
  1,
  'bundle omits soft-deleted entries'
);
select is(
  public.get_period_bundle(tests.id('A.mess_id')) ->> 'me',
  tests.val('A.saad'),
  'bundle identifies the caller''s membership'
);
select is(
  jsonb_array_length(public.get_period_bundle(tests.id('A.mess_id')) -> 'members'),
  3,
  'bundle includes every member'
);
select ok(
  (select count(*) from public.activity_log
   where mess_id = tests.id('A.mess_id') and entity = 'meal_entries') >= 3,
  'every meal write is in the activity log'
);
select is(
  (select count(*) from public.activity_log
   where mess_id = tests.id('A.mess_id') and entity = 'meal_entries' and action = 'delete'),
  1::bigint,
  'soft delete is logged as delete'
);
select throws_ok(
  $$ insert into public.activity_log (mess_id, action, entity) values (tests.id('A.mess_id'), 'x', 'y') $$,
  '42501',
  null,
  'nobody writes the activity log directly'
);
select throws_ok(
  $$ delete from public.meal_entries where member_id = tests.id('A.saad') $$,
  '42501',
  null,
  'no hard deletes'
);

-- ---------------------------------------------------------------------------
-- Closing and reopening a month
-- ---------------------------------------------------------------------------
select tests.login('saad');
select throws_ok(
  $$ select public.close_period(tests.id('A.period_id'), '{}', '[]') $$,
  '42501',
  null,
  'members cannot close the month'
);

select tests.login('ayman');
insert into tests.kv
select 'A.next', public.close_period(
  tests.id('A.period_id'),
  '{"total": 1}',
  jsonb_build_array(jsonb_build_object('member_id', tests.val('A.saad'), 'amount', 100))
)::text;
select is(
  (select status::text from public.periods where id = tests.id('A.period_id')),
  'closed',
  'manager closes the month'
);
select is(
  (select snapshot from public.periods where id = tests.id('A.period_id')),
  '{"total": 1}'::jsonb,
  'closing stores the report snapshot'
);
select is(
  (select month from public.periods where id = tests.id('A.next')),
  (tests.month('A.period_id') + interval '1 month')::date,
  'closing opens the next month'
);
select is(
  (select amount from public.previous_dues
   where period_id = tests.id('A.next') and member_id = tests.id('A.saad')),
  100.00::numeric,
  'closing carries dues into the next month'
);
select throws_like(
  $$ select public.set_meal(tests.id('A.mess_id'), tests.id('A.saad'),
                            tests.month('A.period_id') + 5, 2) $$,
  '%No open month%',
  'manager cannot add meals to a closed month'
);
select is(
  tests.affected($$ update public.meal_entries set meals = 2
                    where period_id = tests.id('A.period_id') $$),
  0,
  'manager cannot edit meals in a closed month'
);
select throws_like(
  $$ insert into public.bills (mess_id, period_id, kind, amount)
     values (tests.id('A.mess_id'), tests.id('A.period_id'), 'gas', 460) $$,
  '%closed%',
  'a closed month is read-only for bills'
);

select tests.login('saad');
select is(
  tests.affected($$ update public.expenses set note = 'late edit'
                    where period_id = tests.id('A.period_id') $$),
  0,
  'members cannot edit expenses in a closed month'
);
select throws_ok(
  $$ select public.reopen_period(tests.id('A.period_id'), 'typo') $$,
  '42501',
  null,
  'members cannot reopen a month'
);

select tests.login('ayman');
select throws_ok(
  $$ select public.reopen_period(tests.id('A.period_id'), '') $$,
  '22023',
  null,
  'reopening needs a reason'
);
select lives_ok(
  $$ select public.reopen_period(tests.id('A.period_id'), 'Saad''s meals were wrong') $$,
  'manager reopens with a reason'
);
select is(
  (select payload ->> 'reason' from public.activity_log
   where entity_id = tests.val('A.period_id') and action = 'reopen'),
  'Saad''s meals were wrong',
  'reopening is logged with its reason'
);
select is(
  tests.affected($$ update public.meal_entries set meals = 2
                    where period_id = tests.id('A.period_id') and deleted_at is null $$),
  1,
  'a reopened month is editable again'
);
select is(
  public.get_period_bundle(tests.id('A.mess_id')) -> 'period' ->> 'id',
  tests.val('A.next'),
  'the current period stays the newer month while an old one is reopened'
);

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from public.messes $$,
  '42501',
  null,
  'anon cannot read mess data'
);
select throws_ok(
  $$ select public.create_mess('Anon mess') $$,
  '42501',
  null,
  'anon cannot call the API'
);
select is(public.health() ->> 'status', 'healthy', 'anon can still call health()');
reset role;

select * from finish();
rollback;
