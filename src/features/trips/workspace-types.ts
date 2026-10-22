export type Profile = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};
export type Room = {
  id: string;
  organizer_id: string;
  title: string;
  description: string;
  starts_on: string;
  ends_on: string;
  vote_deadline: string;
  timezone: string;
  status: "planning" | "closed" | "confirmed" | "completed" | "cancelled";
  selected_date: string | null;
  selected_place_id: string | null;
  plan_version: number;
};
export type Place = {
  id: string;
  room_id: string;
  name: string;
  detail: string;
  created_by: string | null;
};
export type RoomData = {
  room: Room;
  members: Profile[];
  places: Place[];
  votes: { place_id: string; user_id: string }[];
  rsvps: {
    user_id: string;
    plan_version: number;
    response: "going" | "not_going";
  }[];
  messages: {
    id: string;
    author_id: string | null;
    body: string;
    kind: string;
    created_at: string;
  }[];
  bans: Profile[];
};
export type CalendarDay = {
  user_id: string;
  day: string;
  answer: "free" | "busy" | null;
};
export type Appointment = {
  room_id: string;
  title: string;
  date: string;
  place: string;
  version: number;
};
export type WorkspaceState = {
  me: Profile;
  rooms: Room[];
  current: RoomData | null;
  days: CalendarDay[];
  month: string;
  appointments: Appointment[];
  calendar: {
    connected: boolean;
    last_synced_at: string | null;
    error: string | null;
    pending: number;
    configured: boolean;
  };
};
export type WorkspaceResult =
  | { ok: true; data?: Record<string, unknown> | unknown[] }
  | { ok: false; error: string };
export type WorkspaceMode = "home" | "create" | "profile" | "room" | "invite";
