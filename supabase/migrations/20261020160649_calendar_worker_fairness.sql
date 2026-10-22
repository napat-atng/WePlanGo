-- Failed accounts must move behind unattempted accounts, otherwise a slow or
-- revoked Google account can consume every bounded worker run indefinitely.
alter table public.calendar_account_status add column last_attempt_at timestamptz;
create function private.calendar_attempt_stamp() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.lease_id is not null and new.lease_id is distinct from old.lease_id then
    new.last_attempt_at:=now();
  end if;
  return new;
end $$;
revoke all on function private.calendar_attempt_stamp() from public,anon,authenticated,service_role;
create trigger calendar_attempt_stamp before update on public.calendar_account_status
for each row execute function private.calendar_attempt_stamp();

create or replace function public.calendar_pending_users() returns table(user_id uuid)
language sql security definer set search_path='' as $$
  select s.user_id from public.calendar_account_status s where s.connected
    and (s.lease_until is null or s.lease_until<now())
    and (s.last_synced_at is null or s.last_synced_at<now()-interval '15 minutes'
      or exists(select 1 from public.calendar_event_jobs j where j.user_id=s.user_id
        and j.revision<>j.synced_revision and j.next_attempt_at<=now()))
  order by s.last_attempt_at nulls first,s.user_id limit 25
$$;
