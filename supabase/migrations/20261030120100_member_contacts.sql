-- Email addresses of a mess's joined, active members — for the manager only, so the
-- month report can be sent from the current manager's own mail app.
create function public.member_contacts(p_mess uuid)
returns table (member_id uuid, display_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_manager(p_mess) then
    raise exception 'Only the manager can see members'' email addresses'
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

revoke all on function public.member_contacts(uuid) from public, anon;
grant execute on function public.member_contacts(uuid) to authenticated;
