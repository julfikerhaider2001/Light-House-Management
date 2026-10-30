-- Profile photos: required at sign-up, shown to mess-mates only.
-- Expand-only: a new nullable column, a new bucket, and an extra key in the bundle.

alter table public.profiles
  add column avatar_path text
  check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$');

grant update (avatar_path) on public.profiles to authenticated;

-- Private bucket; objects live under <user_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 204800, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "avatars: self or mess-mates read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      private.object_mess_id(name) = (select auth.uid())
      or private.shares_mess_with(private.object_mess_id(name))
    )
  );
create policy "avatars: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and private.object_mess_id(name) = (select auth.uid()));
create policy "avatars: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and private.object_mess_id(name) = (select auth.uid()))
  with check (bucket_id = 'avatars' and private.object_mess_id(name) = (select auth.uid()));
create policy "avatars: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and private.object_mess_id(name) = (select auth.uid()));

-- Same bundle as before, plus the photo path of every joined member (RLS on profiles
-- already limits this to mess-mates).
create or replace function public.get_period_bundle(p_mess uuid, p_period uuid default null)
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
    'avatars', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', pr.id, 'avatar_path', pr.avatar_path))
      from public.profiles pr
      where pr.avatar_path is not null
        and pr.id in (select mm.user_id from public.mess_members mm where mm.mess_id = p_mess)
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
