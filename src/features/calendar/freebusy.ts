import type { CalendarRequest } from "./event-sync";
export type BusyPeriod = { start: string; end: string };

// Google rejected the full 760-day window with timeRangeTooLong. Bounded
// requests preserve the supported planning horizon without that oversized call.
export async function loadFreeBusy(
  request: CalendarRequest,
  timeMin: string,
  timeMax: string,
): Promise<BusyPeriod[]> {
  const first = Date.parse(timeMin),
    last = Date.parse(timeMax);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first)
    throw new Error("ช่วงวันปฏิทินไม่ถูกต้อง");
  const windows: { start: number; end: number }[] = [];
  const step = 89 * 86400000;
  for (let start = first; start < last; start += step)
    windows.push({ start, end: Math.min(start + step, last) });
  const periods: BusyPeriod[] = [];
  for (let i = 0; i < windows.length; i += 3) {
    const batch = await Promise.all(
      windows.slice(i, i + 3).map(async (window) => {
        const response = await request(
          "https://www.googleapis.com/calendar/v3/freeBusy",
          "POST",
          {
            timeMin: new Date(window.start).toISOString(),
            timeMax: new Date(window.end).toISOString(),
            timeZone: "Asia/Bangkok",
            items: [{ id: "primary" }],
          },
        );
        if (!response.ok)
          throw new Error(`นำเข้าช่วงไม่ว่างไม่สำเร็จ (${response.status})`);
        const data = await response.json(),
          calendar = data.calendars?.primary;
        if (
          !calendar ||
          calendar.errors?.length ||
          !Array.isArray(calendar.busy)
        )
          throw new Error(
            "อ่านช่วงไม่ว่างจาก Google ไม่สำเร็จ กรุณาลองซิงก์อีกครั้ง",
          );
        return calendar.busy.map((value: BusyPeriod) => {
          const start = Date.parse(value.start),
            end = Date.parse(value.end);
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
            throw new Error(
              "Google ส่งช่วงเวลาที่ไม่ถูกต้อง กรุณาลองซิงก์ใหม่",
            );
          return {
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
          };
        }) as BusyPeriod[];
      }),
    );
    periods.push(...batch.flat());
  }
  // Join overlaps and boundary fragments. Never retain event titles or metadata.
  periods.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const merged: BusyPeriod[] = [];
  for (const period of periods) {
    const previous = merged.at(-1);
    if (previous && Date.parse(period.start) <= Date.parse(previous.end)) {
      if (Date.parse(period.end) > Date.parse(previous.end))
        previous.end = period.end;
    } else merged.push({ ...period });
  }
  return merged;
}
