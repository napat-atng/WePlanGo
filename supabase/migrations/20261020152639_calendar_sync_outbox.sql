-- OAuth credentials remain encrypted, outside exposed schemas. The server holds
-- the encryption key. Users can operate only their own account; workers need a
-- verified service-role JWT. A lease serializes sync and CAS protects revisions.
create function private.calendar_command(p_action text,p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); lease uuid; item jsonb; rows jsonb; token text; rid uuid;
begin
  if auth.jwt()->>'role'='service_role' and p ? 'user' then u:=(p->>'user')::uuid;
  elsif p ? 'user' and (p->>'user')::uuid is distinct from u then raise exception 'Own calendar only' using errcode='42501'; end if;
  if u is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_action='connect' then
    if length(p->>'tokens') not between 40 and 20000 then raise exception 'Invalid encrypted credentials' using errcode='22023'; end if;
    insert into private.calendar_credentials(user_id,encrypted_tokens) values(u,p->>'tokens') on conflict(user_id) do update set encrypted_tokens=excluded.encrypted_tokens,updated_at=now();
    insert into public.calendar_account_status(user_id,connected) values(u,true) on conflict(user_id) do update set connected=true,error=null,lease_until=null,lease_id=null;
    for rid in select distinct r.room_id from public.room_rsvps r join public.trip_rooms t on t.id=r.room_id and t.plan_version=r.plan_version where r.user_id=u and r.response='going' and t.status='confirmed' loop
      perform private.queue_room_calendar(rid,u);
    end loop;
    return '{}'::jsonb;
  elsif p_action='queue_disconnect' then
    update public.calendar_event_jobs set payload=null,revision=revision+1,attempts=0,next_attempt_at=now() where user_id=u and payload is not null;
    return '{}'::jsonb;
  elsif p_action='disconnect' then
    if exists(select 1 from public.calendar_event_jobs where user_id=u and revision<>synced_revision) then raise exception 'Pending calendar removals; retry sync first' using errcode='22023'; end if;
    delete from private.calendar_credentials where user_id=u;
    delete from public.calendar_busy_periods where user_id=u;
    update public.calendar_account_status set connected=false,error=null,lease_until=null,lease_id=null where user_id=u;
    return '{}'::jsonb;
  elsif p_action='claim' then
    lease:=gen_random_uuid();
    update public.calendar_account_status set lease_id=lease,lease_until=now()+interval '2 minutes'
      where user_id=u and connected and (lease_until is null or lease_until<now());
    if not found then return null; end if;
    select encrypted_tokens into token from private.calendar_credentials where user_id=u;
    select coalesce(jsonb_agg(to_jsonb(j)),'[]'::jsonb) into rows from
      (select * from public.calendar_event_jobs where user_id=u and revision<>synced_revision and next_attempt_at<=now() order by next_attempt_at limit 25) j;
    return jsonb_build_object('lease',lease,'tokens',token,'jobs',rows);
  end if;
  lease:=(p->>'lease')::uuid;
  if not exists(select 1 from public.calendar_account_status where user_id=u and lease_id=lease and lease_until>now()) then raise exception 'Calendar sync lease expired' using errcode='40001'; end if;
  if p_action='event_id' then
    update public.calendar_event_jobs set event_id=replace(gen_random_uuid()::text,'-','') where user_id=u and room_id=(p->>'room')::uuid and revision=(p->>'revision')::integer returning event_id into token;
    if not found then raise exception 'Calendar job changed' using errcode='40001'; end if;
    return jsonb_build_object('event_id',token);
  elsif p_action='finish' then
    if p ? 'tokens' then
      update private.calendar_credentials set encrypted_tokens=p->>'tokens',updated_at=now() where user_id=u;
    end if;
    for item in select * from jsonb_array_elements(coalesce(p->'results','[]'::jsonb)) loop
      if (item->>'ok')::boolean then
        update public.calendar_event_jobs set synced_revision=revision,attempts=0,last_error=null
          where user_id=u and room_id=(item->>'room')::uuid and revision=(item->>'revision')::integer;
      else
        update public.calendar_event_jobs set attempts=attempts+1,last_error=left(item->>'error',250),next_attempt_at=now()+make_interval(mins=>least(60,(power(2,least(attempts,6)))::integer))
          where user_id=u and room_id=(item->>'room')::uuid and revision=(item->>'revision')::integer;
      end if;
    end loop;
    if p ? 'busy' then
      delete from public.calendar_busy_periods where user_id=u;
      insert into public.calendar_busy_periods(user_id,starts_at,ends_at)
        select u,(x->>'start')::timestamptz,(x->>'end')::timestamptz from jsonb_array_elements(p->'busy') x;
    end if;
    update public.calendar_account_status set lease_id=null,lease_until=null,error=nullif(left(p->>'error',250),''),last_synced_at=case when p ? 'busy' then now() else last_synced_at end where user_id=u;
    return '{}'::jsonb;
  end if;
  raise exception 'Unknown calendar action' using errcode='22023';
end $$;
create function public.calendar_command(p_action text,p jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.calendar_command(p_action,p) $$;
revoke all on function private.calendar_command(text,jsonb),public.calendar_command(text,jsonb) from public,anon;
grant execute on function private.calendar_command(text,jsonb),public.calendar_command(text,jsonb) to authenticated,service_role;

-- Service-only discovery for scheduled workers. No credential material is returned.
create function public.calendar_pending_users() returns table(user_id uuid)
language sql security definer set search_path='' as $$
  select s.user_id from public.calendar_account_status s where s.connected
    and (s.lease_until is null or s.lease_until<now())
    and (s.last_synced_at is null or s.last_synced_at<now()-interval '15 minutes' or exists(select 1 from public.calendar_event_jobs j where j.user_id=s.user_id and j.revision<>j.synced_revision and j.next_attempt_at<=now()))
  order by s.last_synced_at nulls first limit 25
$$;
revoke all on function public.calendar_pending_users() from public,anon,authenticated;
grant execute on function public.calendar_pending_users() to service_role;
