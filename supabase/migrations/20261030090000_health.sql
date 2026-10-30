-- Liveness probe used by the deploy smoke test, the keepalive cron and the /status page.
-- Returns the latest applied migration so a deploy can be traced to its schema version.
create or replace function public.health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'healthy',
    'version', (select max(version) from supabase_migrations.schema_migrations)
  );
$$;

comment on function public.health() is 'Liveness probe: {"status":"healthy","version":"<latest migration>"}';

revoke all on function public.health() from public;
grant execute on function public.health() to anon, authenticated;
