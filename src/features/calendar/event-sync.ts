export type CalendarJob = {
  room_id: string;
  event_id: string;
  revision: number;
  payload: null | {
    title: string;
    date: string;
    place: string;
    timezone: string;
    version: number;
  };
};
export type CalendarRequest = (
  url: string,
  method?: string,
  body?: unknown,
) => Promise<Response>;
const root = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// The stored ID survives network failures. Only a confirmed tombstone permits
// rotation; a 409 followed by 404 is ambiguous and must retry the same ID.
export async function syncCalendarEvent(
  job: CalendarJob,
  request: CalendarRequest,
  rotateId: () => Promise<string>,
): Promise<void> {
  let eventId = job.event_id;
  const url = () => `${root}/${encodeURIComponent(eventId)}`;
  if (!job.payload) {
    const response = await request(url(), "DELETE");
    if (!response.ok && response.status !== 404 && response.status !== 410)
      throw new Error(`ลบนัด Google ไม่สำเร็จ (${response.status})`);
    return;
  }
  const nextDay = new Date(`${job.payload.date}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const body = {
    summary: job.payload.title,
    location: job.payload.place,
    description: "นัดหมายจาก WePlanGo",
    start: { date: job.payload.date },
    end: { date: nextDay.toISOString().slice(0, 10) },
    extendedProperties: {
      private: {
        weplangoRoom: job.room_id,
        planVersion: String(job.payload.version),
      },
    },
  };
  let existing = await request(url());
  if (
    existing.status === 410 ||
    (existing.ok && (await existing.json()).status === "cancelled")
  ) {
    eventId = await rotateId();
    existing = new Response(null, { status: 404 });
  }
  let response: Response;
  if (existing.ok) response = await request(url(), "PATCH", body);
  else if (existing.status === 404) {
    response = await request(root, "POST", { ...body, id: eventId });
    if (response.status === 409) {
      const check = await request(url());
      if (check.ok && (await check.json()).status !== "cancelled")
        response = await request(url(), "PATCH", body);
      else if (check.status === 410 || check.ok) {
        eventId = await rotateId();
        response = await request(root, "POST", { ...body, id: eventId });
      } else throw new Error(`ตรวจนัด Google ไม่สำเร็จ (${check.status})`);
    }
  } else throw new Error(`อ่านนัด Google ไม่สำเร็จ (${existing.status})`);
  if (!response.ok)
    throw new Error(`บันทึกนัด Google ไม่สำเร็จ (${response.status})`);
}
