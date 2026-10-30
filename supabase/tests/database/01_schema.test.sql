begin;
select no_plan();

-- Every public table has RLS on.
select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'RLS is enabled on every public table'
);

select has_table('public', t, 'table ' || t || ' exists')
from unnest(array[
  'profiles', 'messes', 'mess_members', 'periods', 'meal_entries', 'expenses', 'bills',
  'rent_shares', 'previous_dues', 'payments', 'activity_log'
]) as t;

-- Realtime publishes the live tables.
select ok(
  (select count(*) from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('meal_entries', 'expenses', 'bills', 'payments', 'activity_log')) = 5,
  'entries, bills, payments and activity_log are in supabase_realtime'
);

-- Receipts bucket is private and capped at 300 KB.
select is(
  (select public from storage.buckets where id = 'receipts'),
  false,
  'receipts bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'receipts'),
  307200::bigint,
  'receipts bucket caps uploads at 300 KB'
);

-- Item lists must add up to the amount.
select ok(public.expense_items_valid('[]', 100), 'no items is valid');
select ok(
  public.expense_items_valid('[{"name":"murgi","amount":230},{"name":"chal+milk","amount":90}]', 320),
  'items that sum to the amount are valid'
);
select ok(
  not public.expense_items_valid('[{"name":"murgi","amount":230}]', 320),
  'items that do not sum to the amount are invalid'
);
select ok(
  not public.expense_items_valid('[{"name":"","amount":320}]', 320),
  'an item needs a name'
);
select ok(
  not public.expense_items_valid('[{"name":"murgi","amount":"230"}]', 230),
  'an item amount must be a number'
);
select ok(not public.expense_items_valid('{}', 0), 'items must be an array');

-- Invite codes avoid look-alike characters.
select matches(public.gen_invite_code(), '^[A-HJ-NP-Z2-9]{8}$', 'invite code is 8 unambiguous chars');

-- Cutoff: meals for 26 Oct lock at 22:00 Dhaka on 25 Oct (16:00 UTC).
insert into public.messes (id, name) values ('00000000-0000-0000-0000-0000000000aa', 'Cutoff');
select is(
  public.meal_edit_deadline('00000000-0000-0000-0000-0000000000aa', '2026-10-26'),
  '2026-10-25 16:00:00+00'::timestamptz,
  'meal deadline is the cutoff time on the previous day, in the mess timezone'
);

select * from finish();
rollback;
