-- Server-side API: one RPC per screen read, one transactional RPC per multi-row write.
-- Reads are SECURITY INVOKER so RLS applies; writes that must cross RLS boundaries
-- (creating a mess, joining, closing a month) are SECURITY DEFINER and check roles themselves.

-- Current month in the mess timezone, as the 1st of the month.
create function private.current_month(p_tz text)
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', (now() at time zone p_tz))::date;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------------------

create function public.create_mess(p_name text default 'Light House', p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_mess public.messes;
  v_member uuid;
  v_period uuid;
  v_name text;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege';
  end if;

  v_name := coalesce(
    nullif(trim(p_display_name), ''),
    (select p.display_name from public.profiles p where p.id = uid),
    'Manager'
  );

  insert into public.messes (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Light House'), uid)
  returning * into v_mess;

  insert into public.mess_members (mess_id, user_id, display_name, role)
  values (v_mess.id, uid, v_name, 'manager')
  returning id into v_member;

  insert into public.periods (mess_id, month)
  values (v_mess.id, private.current_month(v_mess.timezone))
  returning id into v_period;

  return jsonb_build_object(
    'mess_id', v_mess.id,
    'member_id', v_member,
    'period_id', v_period,
    'invite_code', v_mess.invite_code
  );
end;
$$;

-- What a person sees before joining: the mess name and unclaimed placeholders.
create function public.preview_invite(p_code text)
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
  where m.invite_code = upper(trim(p_code)) and auth.uid() is not null;
$$;

create function public.join_mess(
  p_code text,
  p_display_name text default null,
  p_claim_member uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_mess uuid;
  v_member uuid;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege';
  end if;

  select m.id into v_mess from public.messes m where m.invite_code = upper(trim(p_code));
  if v_mess is null then
    raise exception 'Invite code not found' using errcode = 'no_data_found';
  end if;

  -- Already a member: joining again is a no-op.
  select mm.id into v_member from public.mess_members mm
  where mm.mess_id = v_mess and mm.user_id = uid;
  if v_member is not null then
    return jsonb_build_object('mess_id', v_mess, 'member_id', v_member, 'claimed', false);
  end if;

  if p_claim_member is not null then
    update public.mess_members mm
    set user_id = uid
    where mm.id = p_claim_member and mm.mess_id = v_mess and mm.user_id is null
      and mm.status = 'active'
    returning mm.id into v_member;
    if v_member is null then
      raise exception 'That member is already claimed' using errcode = 'unique_violation';
    end if;
    return jsonb_build_object('mess_id', v_mess, 'member_id', v_member, 'claimed', true);
  end if;

  insert into public.mess_members (mess_id, user_id, display_name)
  values (
    v_mess,
    uid,
    coalesce(
      nullif(trim(p_display_name), ''),
      (select p.display_name from public.profiles p where p.id = uid),
      'Member'
    )
  )
  returning id into v_member;

  return jsonb_build_object('mess_id', v_mess, 'member_id', v_member, 'claimed', false);
end;
$$;

-- Manager rotates the invite code (e.g. after someone leaves).
create function public.regenerate_invite_code(p_mess uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.is_manager(p_mess) then
    raise exception 'Only the manager can do this' using errcode = 'insufficient_privilege';
  end if;
  update public.messes set invite_code = public.gen_invite_code()
  where id = p_mess
  returning invite_code into v_code;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------

-- Everything a period screen needs in one round trip. RLS filters every subquery.
-- p_period null = the mess's current open period.
create function public.get_period_bundle(p_mess uuid, p_period uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with per as (
    select p.*
    from public.periods p
    where p.mess_id = p_mess
      and case when p_period is null then p.status = 'open' and p.reopened_at is null
               else p.id = p_period end
    order by p.month desc
    limit 1
  )
  select jsonb_build_object(
    'mess', (select to_jsonb(m) from public.messes m where m.id = p_mess),
    'period', to_jsonb(per),
    'me', private.my_member_id(p_mess),
    'is_manager', private.is_manager(p_mess),
    'periods', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'month', x.month, 'status', x.status)
                       order by x.month desc)
      from public.periods x where x.mess_id = p_mess
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(to_jsonb(mm) order by mm.joined_on, mm.display_name)
      from public.mess_members mm where mm.mess_id = p_mess
    ), '[]'::jsonb),
    'meals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'member_id', e.member_id, 'date', e.date, 'meals', e.meals,
               'note', e.note, 'updated_at', e.updated_at)
             order by e.date, e.member_id)
      from public.meal_entries e where e.period_id = per.id and e.deleted_at is null
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(to_jsonb(x) - 'deleted_at' order by x.date, x.created_at)
      from public.expenses x where x.period_id = per.id and x.deleted_at is null
    ), '[]'::jsonb),
    'bills', coalesce((
      select jsonb_agg(to_jsonb(b) - 'deleted_at' order by b.kind, b.created_at)
      from public.bills b where b.period_id = per.id and b.deleted_at is null
    ), '[]'::jsonb),
    'rent_shares', coalesce((
      select jsonb_agg(to_jsonb(r)) from public.rent_shares r where r.period_id = per.id
    ), '[]'::jsonb),
    'previous_dues', coalesce((
      select jsonb_agg(to_jsonb(d)) from public.previous_dues d where d.period_id = per.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(y) - 'deleted_at' order by y.date, y.created_at)
      from public.payments y where y.period_id = per.id and y.deleted_at is null
    ), '[]'::jsonb)
  )
  from per;
$$;

-- ---------------------------------------------------------------------------
-- Writes
-- ---------------------------------------------------------------------------

-- Upsert one member's meals for a date in the matching open period. RLS decides who may.
create function public.set_meal(
  p_mess uuid,
  p_member uuid,
  p_date date,
  p_meals numeric,
  p_note text default null
)
returns public.meal_entries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period uuid;
  v_row public.meal_entries;
begin
  select p.id into v_period from public.periods p
  where p.mess_id = p_mess and p.month = date_trunc('month', p_date)::date and p.status = 'open';
  if v_period is null then
    raise exception 'No open month for %', p_date using errcode = 'check_violation';
  end if;

  insert into public.meal_entries (mess_id, period_id, member_id, date, meals, note)
  values (p_mess, v_period, p_member, p_date, p_meals, p_note)
  on conflict (member_id, date) do update
    set meals = excluded.meals, note = excluded.note, deleted_at = null
  returning * into v_row;
  return v_row;
end;
$$;

-- Close a month: store the report snapshot, open the next month and carry dues forward.
-- p_carry = [{"member_id": "...", "amount": 123.5}, ...] from the shared calc engine.
create function public.close_period(p_period uuid, p_snapshot jsonb, p_carry jsonb default '[]')
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
  if v_period.id is null or not private.is_manager(v_period.mess_id) then
    raise exception 'Only the manager can close the month' using errcode = 'insufficient_privilege';
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

-- Reopen a closed month for corrections. The reason is required and logged.
create function public.reopen_period(p_period uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period public.periods;
begin
  select * into v_period from public.periods where id = p_period for update;
  if v_period.id is null or not private.is_manager(v_period.mess_id) then
    raise exception 'Only the manager can reopen a month' using errcode = 'insufficient_privilege';
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

-- ---------------------------------------------------------------------------
-- Grants: signed-in users only.
-- ---------------------------------------------------------------------------

revoke all on function public.create_mess(text, text) from public, anon;
revoke all on function public.preview_invite(text) from public, anon;
revoke all on function public.join_mess(text, text, uuid) from public, anon;
revoke all on function public.regenerate_invite_code(uuid) from public, anon;
revoke all on function public.get_period_bundle(uuid, uuid) from public, anon;
revoke all on function public.set_meal(uuid, uuid, date, numeric, text) from public, anon;
revoke all on function public.close_period(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.reopen_period(uuid, text) from public, anon;
revoke all on function private.current_month(text) from public;

grant execute on function public.create_mess(text, text) to authenticated;
grant execute on function public.preview_invite(text) to authenticated;
grant execute on function public.join_mess(text, text, uuid) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.get_period_bundle(uuid, uuid) to authenticated;
grant execute on function public.set_meal(uuid, uuid, date, numeric, text) to authenticated;
grant execute on function public.close_period(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.reopen_period(uuid, text) to authenticated;
