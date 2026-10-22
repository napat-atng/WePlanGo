import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { monthRange, todayBangkok, validId } from "./workspace-validation";
import type {
  CalendarDay,
  Profile,
  Room,
  RoomData,
  WorkspaceState,
} from "./workspace-types";

export async function authenticatedClient() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
  return { client, user: data.user };
}
function checked<T>(result: { data: T | null; error: unknown }): T {
  if (result.error || result.data === null)
    throw new Error("โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
  return result.data;
}
export async function loadWorkspace(
  roomId?: string,
  month = todayBangkok().slice(0, 7),
): Promise<WorkspaceState> {
  if (roomId && !validId(roomId)) throw new Error("ไม่พบห้องทริป");
  const range = monthRange(month),
    { client, user } = await authenticatedClient();
  const results = await Promise.all([
    client
      .from("profiles")
      .select("user_id,display_name,avatar_url")
      .eq("user_id", user.id)
      .single(),
    client
      .from("trip_rooms")
      .select("*")
      .order("created_at", { ascending: false }),
    client
      .from("calendar_account_status")
      .select("connected,last_synced_at,error")
      .eq("user_id", user.id)
      .maybeSingle(),
    client
      .from("profile_availability")
      .select("user_id,day,answer")
      .eq("user_id", user.id)
      .gte("day", range.first)
      .lte("day", range.last),
    client
      .from("calendar_busy_periods")
      .select("starts_at,ends_at")
      .eq("user_id", user.id)
      .lt("starts_at", range.end)
      .gt("ends_at", range.start),
    client
      .from("room_rsvps")
      .select("room_id,plan_version,response")
      .eq("user_id", user.id),
    client
      .from("calendar_event_jobs")
      .select("revision,synced_revision")
      .eq("user_id", user.id),
  ]);
  const me = checked(results[0]) as Profile,
    rooms = checked(results[1]) as Room[];
  if (results[2].error) throw new Error("โหลดสถานะปฏิทินไม่สำเร็จ");
  const answers = checked(results[3]) as CalendarDay[],
    busy = checked(results[4]);
  const ownRsvps = checked(results[5]),
    jobs = checked(results[6]);
  const appointments = rooms
    .filter(
      (r) =>
        r.status === "confirmed" &&
        ownRsvps.some(
          (v) =>
            v.room_id === r.id &&
            v.plan_version === r.plan_version &&
            v.response === "going",
        ),
    )
    .map((r) => ({
      room_id: r.id,
      title: r.title,
      date: r.selected_date!,
      place: "",
      version: r.plan_version,
    }));
  let current: RoomData | null = null,
    days: CalendarDay[] = [];
  if (roomId) {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) throw new Error("ไม่พบห้อง หรือคุณไม่ได้เป็นสมาชิกแล้ว");
    const detail = await Promise.all([
      client.from("room_members").select("user_id").eq("room_id", roomId),
      client
        .from("room_places")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at"),
      client
        .from("room_votes")
        .select("place_id,user_id")
        .eq("room_id", roomId),
      client
        .from("room_rsvps")
        .select("user_id,plan_version,response")
        .eq("room_id", roomId),
      client
        .from("room_messages")
        .select("id,author_id,body,kind,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100),
      client.from("room_bans").select("user_id").eq("room_id", roomId),
      client.rpc("room_availability", {
        p_room: roomId,
        p_start: range.first,
        p_end: range.last,
      }),
    ]);
    const memberIds = checked(detail[0]).map((m) => m.user_id),
      banIds = checked(detail[5]).map((b) => b.user_id);
    const profiles = checked(
      await client
        .from("profiles")
        .select("user_id,display_name,avatar_url")
        .in("user_id", [...memberIds, ...banIds]),
    );
    current = {
      room,
      members: profiles.filter((p) => memberIds.includes(p.user_id)),
      bans: profiles.filter((p) => banIds.includes(p.user_id)),
      places: checked(detail[1]),
      votes: checked(detail[2]),
      rsvps: checked(detail[3]),
      messages: checked(detail[4]).reverse(),
    } as RoomData;
    days = checked(detail[6]) as CalendarDay[];
  } else {
    const total = Number(range.last.slice(-2));
    days = Array.from({ length: total }, (_, i) => {
      const day = `${month}-${String(i + 1).padStart(2, "0")}`;
      const start = new Date(`${day}T00:00:00+07:00`).getTime(),
        end = start + 86400000;
      const blocked =
        busy.some(
          (b) =>
            new Date(b.starts_at).getTime() < end &&
            new Date(b.ends_at).getTime() > start,
        ) || appointments.some((a) => a.date === day);
      return {
        user_id: user.id,
        day,
        answer: blocked
          ? "busy"
          : (answers.find((a) => a.day === day)?.answer ?? null),
      };
    });
  }
  return {
    me,
    rooms,
    current,
    days,
    month,
    appointments,
    calendar: {
      connected: results[2].data?.connected ?? false,
      last_synced_at: results[2].data?.last_synced_at ?? null,
      error: results[2].data?.error ?? null,
      pending: jobs.filter((j) => j.revision !== j.synced_revision).length,
      configured: !!(
        process.env.GOOGLE_CALENDAR_CLIENT_ID &&
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
        process.env.CALENDAR_TOKEN_KEY
      ),
    },
  };
}
