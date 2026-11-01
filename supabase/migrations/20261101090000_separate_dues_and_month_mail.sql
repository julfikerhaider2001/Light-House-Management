-- Round 4: previous dues are paid separately, photos can be removed, and month reports are
-- emailed automatically (see scripts/month-mail.ts and .github/workflows/month-mail.yml).

-- A payment is either for this month's bill or for the due carried in from earlier months.
alter table public.payments
  add column applies_to text not null default 'month'
  check (applies_to in ('month', 'previous_due'));
grant insert (applies_to) on public.payments to authenticated;
grant update (applies_to) on public.payments to authenticated;

-- Editing a bazar entry may fix who paid for it (same mess: the composite FK guarantees it,
-- and the update policy re-checks the new row).
grant update (member_id) on public.expenses to authenticated;

-- Removing a photo is a choice, not a missing photo: don't ask for one again.
alter table public.profiles add column photo_removed boolean not null default false;
grant update (photo_removed) on public.profiles to authenticated;

-- When the month report email went out. Set by the mailer (service connection) only.
alter table public.periods add column emailed_at timestamptz;

-- Reopening a month clears emailed_at, so the corrected report is emailed again on re-close.
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
  set status = 'open', closed_at = null, closed_by = null, emailed_at = null,
      reopened_at = now(), reopen_reason = trim(p_reason)
  where id = p_period;

  insert into public.activity_log (mess_id, actor, action, entity, entity_id, payload)
  values (
    v_period.mess_id, auth.uid(), 'reopen', 'periods', p_period::text,
    jsonb_build_object('month', v_period.month, 'reason', trim(p_reason))
  );
end;
$$;
