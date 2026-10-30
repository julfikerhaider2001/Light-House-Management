-- Row level security for every table, explicit grants, realtime and receipt storage.
-- Policy helpers live in a schema the Data API does not expose.

create schema private;
grant usage on schema private to authenticated;

create function private.is_member(p_mess uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mess_members m
    where m.mess_id = p_mess and m.user_id = (select auth.uid())
  );
$$;

create function private.is_manager(p_mess uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mess_members m
    where m.mess_id = p_mess and m.user_id = (select auth.uid())
      and m.role = 'manager' and m.status = 'active'
  );
$$;

-- The caller's active member id in a mess (null if none).
create function private.my_member_id(p_mess uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.mess_members m
  where m.mess_id = p_mess and m.user_id = (select auth.uid()) and m.status = 'active';
$$;

create function private.period_open(p_period uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.periods p where p.id = p_period and p.status = 'open');
$$;

create function private.shares_mess_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mess_members mine
    join public.mess_members theirs on theirs.mess_id = mine.mess_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  );
$$;

-- Members may set their own meals for a date until the cutoff time on the day before it.
create function public.meal_edit_deadline(p_mess uuid, p_date date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select ((p_date - 1) + m.meal_cutoff_time) at time zone m.timezone
  from public.messes m where m.id = p_mess;
$$;

create function private.can_write_meal(p_mess uuid, p_period uuid, p_member uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.period_open(p_period)
     and (
       private.is_manager(p_mess)
       or (p_member = private.my_member_id(p_mess) and now() < public.meal_edit_deadline(p_mess, p_date))
     );
$$;

create function private.can_write_expense(p_mess uuid, p_period uuid, p_member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.period_open(p_period)
     and (private.is_manager(p_mess) or p_member = private.my_member_id(p_mess));
$$;

create function private.can_manage_period(p_mess uuid, p_period uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.period_open(p_period) and private.is_manager(p_mess);
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;
revoke all on function public.meal_edit_deadline(uuid, date) from public, anon;
grant execute on function public.meal_edit_deadline(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants: nothing for anon; no hard DELETE for anyone (soft delete via deleted_at).
-- ---------------------------------------------------------------------------

revoke all on
  public.profiles, public.messes, public.mess_members, public.periods, public.meal_entries,
  public.expenses, public.bills, public.rent_shares, public.previous_dues, public.payments,
  public.activity_log
from anon, authenticated;

grant select on
  public.profiles, public.messes, public.mess_members, public.periods, public.meal_entries,
  public.expenses, public.bills, public.rent_shares, public.previous_dues, public.payments,
  public.activity_log
to authenticated;

grant update (display_name, phone) on public.profiles to authenticated;
grant update (name, meal_cutoff_time) on public.messes to authenticated;
-- Column-level grants: user_id is only ever set by join_mess (claiming), and an entry can
-- never be moved to another member or date after the fact.
grant insert (mess_id, display_name, role) on public.mess_members to authenticated;
grant update (display_name, role, status, left_on) on public.mess_members to authenticated;
grant insert (mess_id, period_id, member_id, date, meals, note) on public.meal_entries
  to authenticated;
grant update (meals, note, deleted_at) on public.meal_entries to authenticated;
grant insert (mess_id, period_id, member_id, date, amount, kind, items, receipt_path, note)
  on public.expenses to authenticated;
grant update (date, amount, kind, items, receipt_path, note, deleted_at) on public.expenses
  to authenticated;
grant insert (mess_id, period_id, kind, label, amount) on public.bills to authenticated;
grant update (kind, label, amount, deleted_at) on public.bills to authenticated;
grant insert (mess_id, period_id, member_id, fixed_amount) on public.rent_shares to authenticated;
grant update (fixed_amount) on public.rent_shares to authenticated;
grant insert (mess_id, period_id, member_id, amount) on public.previous_dues to authenticated;
grant update (amount) on public.previous_dues to authenticated;
grant insert (mess_id, period_id, member_id, amount, method, date, note) on public.payments
  to authenticated;
grant update (amount, method, date, note, deleted_at) on public.payments to authenticated;

revoke all on function public.gen_invite_code() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.log_activity() from public, anon, authenticated;
revoke all on function public.guard_closed_period() from public, anon, authenticated;
revoke all on function public.guard_date_in_period() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.messes enable row level security;
alter table public.mess_members enable row level security;
alter table public.periods enable row level security;
alter table public.meal_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.bills enable row level security;
alter table public.rent_shares enable row level security;
alter table public.previous_dues enable row level security;
alter table public.payments enable row level security;
alter table public.activity_log enable row level security;

create policy "profiles: self or mess-mates read" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_mess_with(id));
create policy "profiles: self update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "messes: members read" on public.messes
  for select to authenticated using (private.is_member(id));
create policy "messes: manager update" on public.messes
  for update to authenticated using (private.is_manager(id)) with check (private.is_manager(id));

create policy "members: members read" on public.mess_members
  for select to authenticated using (private.is_member(mess_id));
create policy "members: manager insert" on public.mess_members
  for insert to authenticated with check (private.is_manager(mess_id) and user_id is null);
create policy "members: manager update" on public.mess_members
  for update to authenticated
  using (private.is_manager(mess_id)) with check (private.is_manager(mess_id));

-- Periods change only through close_period / reopen_period / create_mess.
create policy "periods: members read" on public.periods
  for select to authenticated using (private.is_member(mess_id));

create policy "meals: members read" on public.meal_entries
  for select to authenticated using (private.is_member(mess_id));
create policy "meals: own before cutoff, manager any (open period)" on public.meal_entries
  for insert to authenticated
  with check (private.can_write_meal(mess_id, period_id, member_id, date));
create policy "meals: update own before cutoff, manager any (open period)" on public.meal_entries
  for update to authenticated
  using (private.can_write_meal(mess_id, period_id, member_id, date))
  with check (private.can_write_meal(mess_id, period_id, member_id, date));

create policy "expenses: members read" on public.expenses
  for select to authenticated using (private.is_member(mess_id));
create policy "expenses: payer or manager insert (open period)" on public.expenses
  for insert to authenticated
  with check (private.can_write_expense(mess_id, period_id, member_id));
create policy "expenses: payer or manager update (open period)" on public.expenses
  for update to authenticated
  using (private.can_write_expense(mess_id, period_id, member_id))
  with check (private.can_write_expense(mess_id, period_id, member_id));

create policy "bills: members read" on public.bills
  for select to authenticated using (private.is_member(mess_id));
create policy "bills: manager insert (open period)" on public.bills
  for insert to authenticated with check (private.can_manage_period(mess_id, period_id));
create policy "bills: manager update (open period)" on public.bills
  for update to authenticated
  using (private.can_manage_period(mess_id, period_id))
  with check (private.can_manage_period(mess_id, period_id));

create policy "rent: members read" on public.rent_shares
  for select to authenticated using (private.is_member(mess_id));
create policy "rent: manager insert (open period)" on public.rent_shares
  for insert to authenticated with check (private.can_manage_period(mess_id, period_id));
create policy "rent: manager update (open period)" on public.rent_shares
  for update to authenticated
  using (private.can_manage_period(mess_id, period_id))
  with check (private.can_manage_period(mess_id, period_id));

create policy "dues: members read" on public.previous_dues
  for select to authenticated using (private.is_member(mess_id));
create policy "dues: manager insert (open period)" on public.previous_dues
  for insert to authenticated with check (private.can_manage_period(mess_id, period_id));
create policy "dues: manager update (open period)" on public.previous_dues
  for update to authenticated
  using (private.can_manage_period(mess_id, period_id))
  with check (private.can_manage_period(mess_id, period_id));

create policy "payments: members read" on public.payments
  for select to authenticated using (private.is_member(mess_id));
create policy "payments: manager insert (open period)" on public.payments
  for insert to authenticated with check (private.can_manage_period(mess_id, period_id));
create policy "payments: manager update (open period)" on public.payments
  for update to authenticated
  using (private.can_manage_period(mess_id, period_id))
  with check (private.can_manage_period(mess_id, period_id));

create policy "activity: members read" on public.activity_log
  for select to authenticated using (private.is_member(mess_id));

-- ---------------------------------------------------------------------------
-- Realtime: clients subscribe filtered by mess_id.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.meal_entries, public.expenses, public.bills, public.payments, public.rent_shares,
      public.previous_dues, public.mess_members, public.periods, public.activity_log;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Receipts: private bucket, objects stored under <mess_id>/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 307200, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create function private.object_mess_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;
grant execute on function private.object_mess_id(text) to authenticated;

create policy "receipts: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and private.is_member(private.object_mess_id(name)));
create policy "receipts: active members upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts' and private.my_member_id(private.object_mess_id(name)) is not null
  );
create policy "receipts: uploader or manager delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (owner_id = (select auth.uid())::text or private.is_manager(private.object_mess_id(name)))
  );
