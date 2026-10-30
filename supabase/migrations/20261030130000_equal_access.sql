-- Equal access (decided with the mess, 2026-10-30): every active member can add, edit
-- and soft-delete everything, like a shared sheet. "Manager" is a title anyone can hand
-- to any joined member, one at a time. Closed months stay locked until reopened with a
-- logged reason. A mess can be deleted (softly, restorably) only while nobody else has
-- joined it.

-- ---------------------------------------------------------------------------
-- Messes can be soft-deleted.
-- ---------------------------------------------------------------------------
alter table public.messes add column deleted_at timestamptz;

-- Active membership in a live (not deleted) mess: the bar for every write.
create or replace function private.my_member_id(p_mess uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.mess_members m
  join public.messes x on x.id = m.mess_id and x.deleted_at is null
  where m.mess_id = p_mess and m.user_id = (select auth.uid()) and m.status = 'active';
$$;

create function private.can_act(p_mess uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.my_member_id(p_mess) is not null;
$$;
revoke all on function private.can_act(uuid) from public;
grant execute on function private.can_act(uuid) to authenticated;

-- Every write policy goes through these helpers, so redefining them changes the rules
-- for meals, expenses, bills, rent shares, dues and payments in one place.
create or replace function private.can_write_meal(
  p_mess uuid, p_period uuid, p_member uuid, p_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.period_open(p_period) and private.can_act(p_mess);
$$;

create or replace function private.can_write_expense(p_mess uuid, p_period uuid, p_member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.period_open(p_period) and private.can_act(p_mess);
$$;

create or replace function private.can_manage_period(p_mess uuid, p_period uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.period_open(p_period) and private.can_act(p_mess);
$$;

-- Policy names now describe the rule.
alter policy "meals: own before cutoff, manager any (open period)" on public.meal_entries
  rename to "meals: members insert (open period)";
alter policy "meals: update own before cutoff, manager any (open period)" on public.meal_entries
  rename to "meals: members update (open period)";
alter policy "expenses: payer or manager insert (open period)" on public.expenses
  rename to "expenses: members insert (open period)";
alter policy "expenses: payer or manager update (open period)" on public.expenses
  rename to "expenses: members update (open period)";
alter policy "bills: manager insert (open period)" on public.bills
  rename to "bills: members insert (open period)";
alter policy "bills: manager update (open period)" on public.bills
  rename to "bills: members update (open period)";
alter policy "rent: manager insert (open period)" on public.rent_shares
  rename to "rent: members insert (open period)";
alter policy "rent: manager update (open period)" on public.rent_shares
  rename to "rent: members update (open period)";
alter policy "dues: manager insert (open period)" on public.previous_dues
  rename to "dues: members insert (open period)";
alter policy "dues: manager update (open period)" on public.previous_dues
  rename to "dues: members update (open period)";
alter policy "payments: manager insert (open period)" on public.payments
  rename to "payments: members insert (open period)";
alter policy "payments: manager update (open period)" on public.payments
  rename to "payments: members update (open period)";

-- Policies that named the manager directly.
drop policy "messes: manager update" on public.messes;
create policy "messes: members update" on public.messes
  for update to authenticated using (private.can_act(id)) with check (private.can_act(id));

drop policy "members: manager insert" on public.mess_members;
create policy "members: members add placeholders" on public.mess_members
  for insert to authenticated with check (private.can_act(mess_id) and user_id is null);

drop policy "members: manager update" on public.mess_members;
create policy "members: members update" on public.mess_members
  for update to authenticated
  using (private.can_act(mess_id)) with check (private.can_act(mess_id));

drop policy "receipts: uploader or manager delete" on storage.objects;
create policy "receipts: members delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and private.can_act(private.object_mess_id(name)));

-- The manager title changes only through set_manager (one at a time).
revoke update (role) on public.mess_members from authenticated;
-- Earlier builds let a manager promote others directly; keep the longest-serving
-- manager per mess as the title holder (anyone can hand it on afterwards).
update public.mess_members m
set role = 'member'
where m.role = 'manager' and m.status = 'active'
  and exists (
    select 1 from public.mess_members o
    where o.mess_id = m.mess_id and o.role = 'manager' and o.status = 'active'
      and (o.created_at, o.id) < (m.created_at, m.id)
  );
create unique index mess_members_one_manager_uq on public.mess_members (mess_id)
  where role = 'manager' and status = 'active';

-- ---------------------------------------------------------------------------
-- RPCs: anyone in the mess may act.
-- ---------------------------------------------------------------------------

-- Hand the manager title to a joined, active member (yourself included).
create function public.set_manager(p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.mess_members;
begin
  select * into v_target from public.mess_members where id = p_member;
  if v_target.id is null or not private.can_act(v_target.mess_id) then
    raise exception 'Only members of this mess can do this' using errcode = 'insufficient_privilege';
  end if;
  if v_target.user_id is null or v_target.status <> 'active' then
    raise exception 'The manager must be a joined, active member' using errcode = 'check_violation';
  end if;
  update public.mess_members set role = 'member'
  where mess_id = v_target.mess_id and role = 'manager' and id <> p_member;
  update public.mess_members set role = 'manager' where id = p_member;
end;
$$;

create or replace function public.close_period(p_period uuid, p_snapshot jsonb, p_carry jsonb default '[]')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_period public.periods;
  v_next uuid;
begin
  select * into v_period from public.periods where id = p_period for update;
  if v_period.id is null or not private.can_act(v_period.mess_id) then
    raise exception 'Only members of this mess can close the month' using errcode = 'insufficient_privilege';
  end if;
  if v_period.status <> 'open' then
    raise exception 'This month is already closed' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_snapshot) <> 'object' or jsonb_typeof(p_carry) <> 'array' then
    raise exception 'Snapshot must be an object and carry an array' using errcode = 'invalid_parameter_value';
  end if;

  update public.periods
  set status = 'closed', closed_at = now(), closed_by = uid, snapshot = p_snapshot
  where id = p_period;

  select p.id into v_next from public.periods p
  where p.mess_id = v_period.mess_id and p.month = (v_period.month + interval '1 month')::date;

  if v_next is null then
    insert into public.periods (mess_id, month)
    values (v_period.mess_id, (v_period.month + interval '1 month')::date)
    returning id into v_next;
  end if;

  insert into public.previous_dues (mess_id, period_id, member_id, amount)
  select v_period.mess_id, v_next, (c ->> 'member_id')::uuid, round((c ->> 'amount')::numeric, 2)
  from jsonb_array_elements(p_carry) as c
  join public.mess_members mm
    on mm.id = (c ->> 'member_id')::uuid and mm.mess_id = v_period.mess_id
  on conflict (period_id, member_id) do update set amount = excluded.amount;

  return v_next;
end;
$$;

create or replace function public.reopen_period(p_period uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period public.periods;
begin
  select * into v_period from public.periods where id = p_period for update;
  if v_period.id is null or not private.can_act(v_period.mess_id) then
    raise exception 'Only members of this mess can reopen a month' using errcode = 'insufficient_privilege';
  end if;
  if v_period.status <> 'closed' then
    raise exception 'This month is not closed' using errcode = 'check_violation';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for reopening' using errcode = 'invalid_parameter_value';
  end if;

  update public.periods
  set status = 'open', closed_at = null, closed_by = null,
      reopened_at = now(), reopen_reason = trim(p_reason)
  where id = p_period;

  insert into public.activity_log (mess_id, actor, action, entity, entity_id, payload)
  values (
    v_period.mess_id, auth.uid(), 'reopen', 'periods', p_period::text,
    jsonb_build_object('month', v_period.month, 'reason', trim(p_reason))
  );
end;
$$;

create or replace function public.regenerate_invite_code(p_mess uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.can_act(p_mess) then
    raise exception 'Only members of this mess can do this' using errcode = 'insufficient_privilege';
  end if;
  update public.messes set invite_code = public.gen_invite_code()
  where id = p_mess
  returning invite_code into v_code;
  return v_code;
end;
$$;

-- Whoever presses "Email report" sends it from their own mail app.
create or replace function public.member_contacts(p_mess uuid)
returns table (member_id uuid, display_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_act(p_mess) then
    raise exception 'Only members of this mess can see email addresses'
      using errcode = 'insufficient_privilege';
  end if;
  return query
    select mm.id, mm.display_name, u.email::text
    from public.mess_members mm
    join auth.users u on u.id = mm.user_id
    where mm.mess_id = p_mess and mm.status = 'active' and u.email is not null
    order by mm.display_name;
end;
$$;

-- Joining a deleted mess is not possible.
create or replace function public.preview_invite(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'mess_id', m.id,
    'name', m.name,
    'placeholders', coalesce((
      select jsonb_agg(jsonb_build_object('id', mm.id, 'display_name', mm.display_name)
                       order by mm.display_name)
      from public.mess_members mm
      where mm.mess_id = m.id and mm.user_id is null and mm.status = 'active'
    ), '[]'::jsonb)
  )
  from public.messes m
  where m.invite_code = upper(trim(p_code)) and m.deleted_at is null and auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------------
-- Deleting and restoring a mess.
-- ---------------------------------------------------------------------------

-- Only while no one else has joined (placeholders don't count). The caller must type the
-- mess name; the app also re-checks the password before calling.
create function public.delete_mess(p_mess uuid, p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mess public.messes;
begin
  select * into v_mess from public.messes where id = p_mess for update;
  if v_mess.id is null or not private.can_act(p_mess) then
    raise exception 'Only members of this mess can delete it' using errcode = 'insufficient_privilege';
  end if;
  if trim(coalesce(p_confirm_name, '')) <> v_mess.name then
    raise exception 'Type the mess name exactly to confirm' using errcode = 'invalid_parameter_value';
  end if;
  if exists (
    select 1 from public.mess_members mm
    where mm.mess_id = p_mess and mm.status = 'active'
      and mm.user_id is not null and mm.user_id <> (select auth.uid())
  ) then
    raise exception 'Other members have joined this mess, so it cannot be deleted'
      using errcode = 'check_violation';
  end if;
  update public.messes set deleted_at = now() where id = p_mess;
end;
$$;

create function public.restore_mess(p_mess uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.mess_members mm
    where mm.mess_id = p_mess and mm.user_id = (select auth.uid()) and mm.status = 'active'
  ) then
    raise exception 'Only members of this mess can restore it' using errcode = 'insufficient_privilege';
  end if;
  update public.messes set deleted_at = null where id = p_mess and deleted_at is not null;
end;
$$;

revoke all on function public.set_manager(uuid) from public, anon;
revoke all on function public.delete_mess(uuid, text) from public, anon;
revoke all on function public.restore_mess(uuid) from public, anon;
grant execute on function public.set_manager(uuid) to authenticated;
grant execute on function public.delete_mess(uuid, text) to authenticated;
grant execute on function public.restore_mess(uuid) to authenticated;
