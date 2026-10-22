create index room_votes_place_idx on public.room_votes(room_id,place_id);
drop policy profiles_read on public.profiles;
drop policy profiles_room_read on public.profiles;
drop policy profiles_banned_room_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  private.can_read_profile(user_id)
  or exists(select 1 from public.room_members a join public.room_members b using(room_id)
    where a.user_id=(select auth.uid()) and b.user_id=profiles.user_id)
  or exists(select 1 from public.room_bans b where b.user_id=profiles.user_id and private.room_owner(b.room_id))
);

-- Preserve the organizer invariant for retained legacy APIs and future policy
-- changes as well as the existing RLS checks.
create function private.legacy_organizer_participation_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.invitation_status<>'interested' and exists(
    select 1 from public.trips where id=new.trip_id and organizer_id=new.user_id
  ) then raise exception 'Organizer must remain a participant' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function private.legacy_organizer_participation_guard() from public,anon,authenticated;
create trigger legacy_organizer_participation_guard before update on public.trip_participants
for each row execute function private.legacy_organizer_participation_guard();
