const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist-nu-latn", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

export function formatThaiDate(value: string): string {
  return thaiDate.format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}
