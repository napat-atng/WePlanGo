import test from "node:test";
import assert from "node:assert/strict";
import { loadFreeBusy } from "./freebusy.ts";

const result = (busy: unknown[] = []) =>
  Response.json({ calendars: { primary: { busy } } });
test("long planning windows use bounded contiguous requests with limited concurrency", async () => {
  const first = Date.parse("2026-10-01T00:00:00Z"),
    last = first + 760 * 86400000;
  const windows: { timeMin: string; timeMax: string }[] = [];
  let active = 0,
    maximum = 0;
  const busy = await loadFreeBusy(
    async (_, method, body) => {
      assert.equal(method, "POST");
      windows.push(body as { timeMin: string; timeMax: string });
      active++;
      maximum = Math.max(active, maximum);
      await Promise.resolve();
      active--;
      return result();
    },
    new Date(first).toISOString(),
    new Date(last).toISOString(),
  );
  assert.deepEqual(busy, []);
  assert.equal(windows.length, 9);
  assert.ok(maximum <= 3);
  assert.equal(Date.parse(windows[0].timeMin), first);
  assert.equal(Date.parse(windows.at(-1)!.timeMax), last);
  windows.forEach((window, index) => {
    assert.ok(
      Date.parse(window.timeMax) - Date.parse(window.timeMin) <= 89 * 86400000,
    );
    if (index) assert.equal(window.timeMin, windows[index - 1].timeMax);
  });
});
test("busy overlaps merge across query boundaries without retaining event metadata", async () => {
  const busy = await loadFreeBusy(
    async (_, __, raw) => {
      const window = raw as { timeMin: string; timeMax: string };
      return result([
        {
          start: window.timeMin,
          end: window.timeMax,
          title: "Private title",
          location: "Private place",
        },
      ]);
    },
    "2028-01-01T00:00:00Z",
    "2028-07-01T00:00:00Z",
  );
  assert.deepEqual(busy, [
    { start: "2028-01-01T00:00:00.000Z", end: "2028-07-01T00:00:00.000Z" },
  ]);
});
test("one failed batch rejects the import rather than returning partial availability", async () => {
  await assert.rejects(
    loadFreeBusy(
      async (_, __, raw) => {
        const window = raw as { timeMin: string };
        return window.timeMin.startsWith("2028-01")
          ? result()
          : new Response(null, { status: 503 });
      },
      "2028-01-01T00:00:00Z",
      "2028-07-01T00:00:00Z",
    ),
    /503/,
  );
});
test("per-calendar permission errors are not interpreted as an empty free calendar", async () => {
  await assert.rejects(
    loadFreeBusy(
      async () =>
        Response.json({
          calendars: {
            primary: { errors: [{ reason: "notFound" }], busy: [] },
          },
        }),
      "2028-01-01T00:00:00Z",
      "2028-02-01T00:00:00Z",
    ),
    /Google/,
  );
});
