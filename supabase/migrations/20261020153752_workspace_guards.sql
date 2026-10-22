grant usage on schema private to service_role;
create policy profiles_banned_room_read on public.profiles for select to authenticated using(
  exists(select 1 from public.room_bans b where b.user_id=profiles.user_id and private.room_owner(b.room_id))
);
create function private.availability_calendar_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.answer='free' and (
    exists(select 1 from public.calendar_busy_periods b where b.user_id=new.user_id
      and b.starts_at<((new.day+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(new.day::timestamp at time zone 'Asia/Bangkok'))
    or exists(select 1 from public.room_rsvps r join public.trip_rooms t on t.id=r.room_id and t.plan_version=r.plan_version
      where r.user_id=new.user_id and r.response='going' and t.status='confirmed' and t.selected_date=new.day)
  ) then raise exception 'Calendar conflict' using errcode='22023'; end if;
  return new;
end $$;
revoke all on function private.availability_calendar_guard() from public,anon,authenticated;
create trigger availability_calendar_guard before insert or update on public.profile_availability for each row execute function private.availability_calendar_guard();
