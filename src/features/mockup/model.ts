export type Availability = "free" | "busy";
export type Person = {
  id: string;
  name: string;
  photo: string;
  connected: boolean;
  syncError: boolean;
  availability: Record<string, Availability>;
};
export type Message = {
  id: string;
  author: string;
  text: string;
  time: string;
};
export type Place = {
  id: string;
  name: string;
  detail: string;
  author: string;
  votes: string[];
};
export type Trip = {
  inviteShared?: boolean;
  id: string;
  name: string;
  detail: string;
  start: string;
  end: string;
  deadline: string;
  owner: string;
  members: string[];
  banned: string[];
  invite: string;
  inviteActive: boolean;
  places: Place[];
  messages: Message[];
  closed: boolean;
  plan: null | { date: string; place: string; version: number };
  rsvps: Record<string, number>;
};
export type DemoState = {
  schema: 1;
  signedIn: boolean;
  user: string;
  people: Person[];
  trips: Trip[];
};
export function seed(): DemoState {
  return {
    schema: 1,
    signedIn: false,
    user: "pim",
    people: [
      {
        id: "pim",
        name: "พิม",
        photo: "",
        connected: false,
        syncError: false,
        availability: { "2026-11-14": "free", "2026-11-15": "free" },
      },
      {
        id: "non",
        name: "นนท์",
        photo: "",
        connected: true,
        syncError: false,
        availability: { "2026-11-14": "free", "2026-11-15": "busy" },
      },
      {
        id: "may",
        name: "เมย์",
        photo: "",
        connected: false,
        syncError: false,
        availability: { "2026-11-14": "free" },
      },
    ],
    trips: [
      {
        id: "chiang-mai",
        name: "เชียงใหม่ ไปพักใจกัน",
        detail: "หาเวลาหนีเมืองสักวัน กินของอร่อย แล้วไปดูภูเขาด้วยกัน",
        start: "2026-11-01",
        end: "2026-11-30",
        deadline: "2026-11-10T18:00",
        owner: "pim",
        members: ["pim", "non", "may"],
        banned: [],
        invite: "cnx-friends",
        inviteActive: true,
        places: [
          {
            id: "doi",
            name: "ดอยสุเทพ",
            detail: "ชมวิวเมือง • เดินทางสะดวก",
            author: "pim",
            votes: ["pim", "may"],
          },
          {
            id: "mae",
            name: "แม่กำปอง",
            detail: "หมู่บ้านกลางเขา • คาเฟ่ริมน้ำ",
            author: "non",
            votes: ["non", "may"],
          },
          {
            id: "jing",
            name: "จริงใจมาร์เก็ต",
            detail: "งานคราฟต์ • อาหารเช้าท้องถิ่น",
            author: "may",
            votes: [],
          },
        ],
        messages: [
          {
            id: "m1",
            author: "non",
            text: "อยากไปช่วงกลางเดือน ทุกคนว่างวันไหนกันบ้าง?",
            time: "09:41",
          },
          {
            id: "m2",
            author: "may",
            text: "เราเลือกวันว่างไว้แล้วนะ ไปไหนก็ได้ ขอมีของอร่อย",
            time: "09:43",
          },
        ],
        closed: false,
        plan: null,
        rsvps: {},
      },
    ],
  };
}
export function leaders(trip: Trip): Place[] {
  const counts = trip.places.map(
    (p) => p.votes.filter((id) => trip.members.includes(id)).length,
  );
  const max = Math.max(0, ...counts);
  return max === 0 ? [] : trip.places.filter((_, i) => counts[i] === max);
}
export function confirmPlan(
  trip: Trip,
  actor: string,
  date: string,
  place: string,
): Trip {
  if (
    actor !== trip.owner ||
    !trip.closed ||
    date < trip.start ||
    date > trip.end ||
    !leaders(trip).some((p) => p.id === place)
  )
    throw new Error("ยังยืนยันแผนนี้ไม่ได้");
  return {
    ...trip,
    plan: { date, place, version: (trip.plan?.version ?? 0) + 1 },
    rsvps: {},
  };
}
export function removeMember(
  trip: Trip,
  actor: string,
  member: string,
  ban: boolean,
): Trip {
  if (actor !== trip.owner || member === trip.owner)
    throw new Error("ไม่มีสิทธิ์จัดการสมาชิกนี้");
  return {
    ...trip,
    members: trip.members.filter((id) => id !== member),
    banned: ban ? [...new Set([...trip.banned, member])] : trip.banned,
    places: trip.places.map((p) => ({
      ...p,
      votes: p.votes.filter((id) => id !== member),
    })),
    rsvps: Object.fromEntries(
      Object.entries(trip.rsvps).filter(([id]) => id !== member),
    ),
  };
}
export function joinTrip(trip: Trip, user: string, token: string): Trip {
  if (!trip.inviteActive || trip.invite !== token)
    throw new Error("ลิงก์เชิญใช้ไม่ได้ ขอให้หัวห้องส่งลิงก์ใหม่");
  if (trip.banned.includes(user))
    throw new Error("บัญชีนี้ถูกแบนจากห้อง ให้หัวห้องปลดแบนก่อน");
  return { ...trip, members: [...new Set([...trip.members, user])] };
}
export function calendarEvents(
  state: DemoState,
  user: string,
): { id: string; title: string; date: string; version: number }[] {
  return state.trips
    .filter(
      (t) =>
        t.members.includes(user) && t.plan && t.rsvps[user] === t.plan.version,
    )
    .map((t) => ({
      id: t.id,
      title: t.name,
      date: t.plan!.date,
      version: t.plan!.version,
    }));
}
