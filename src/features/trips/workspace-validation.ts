export function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function monthRange(value: string): {
  first: string;
  last: string;
  start: string;
  end: string;
} {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0, 4)) < 1)
    throw new Error("เลือกเดือนให้ถูกต้อง");
  const [year, month] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  const first = `${value}-01`,
    last = `${value}-${date.getUTCDate()}`;
  const end = new Date(`${last}T00:00:00+07:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    first,
    last,
    start: `${first}T00:00:00+07:00`,
    end: end.toISOString(),
  };
}
export function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function leaders(
  places: { id: string }[],
  votes: { place_id: string }[],
): string[] {
  const counts = places.map(
      (p) => votes.filter((v) => v.place_id === p.id).length,
    ),
    max = Math.max(0, ...counts);
  return max ? places.filter((_, i) => counts[i] === max).map((p) => p.id) : [];
}
