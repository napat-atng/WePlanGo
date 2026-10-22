-- The schedule is inert until the deployment URL and bearer secret are stored
-- in Vault. Never put deployment credentials in migration history.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create function private.dispatch_calendar_worker() returns bigint
language plpgsql security invoker set search_path='' as $$
declare endpoint text; secret text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='weplango_calendar_worker_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name='weplango_calendar_worker_secret';
  if endpoint is null or secret is null then return null; end if;
  if endpoint !~ '^https://[^/?#]+/api/calendar/cron$' or length(secret)<32 then
    raise exception 'Invalid calendar worker configuration';
  end if;
  return net.http_get(url:=endpoint,headers:=jsonb_build_object('Authorization','Bearer '||secret),timeout_milliseconds:=65000);
end $$;
revoke all on function private.dispatch_calendar_worker() from public,anon,authenticated,service_role;

select cron.schedule('weplango-calendar-sync','*/5 * * * *','select private.dispatch_calendar_worker()');
