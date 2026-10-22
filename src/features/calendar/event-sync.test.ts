import test from "node:test";
import assert from "node:assert/strict";
import {
  syncCalendarEvent,
  type CalendarJob,
  type CalendarRequest,
} from "./event-sync.ts";

const job: CalendarJob = {
  room_id: "room-a",
  event_id: "a123",
  revision: 1,
  payload: {
    title: "Trip",
    date: "2028-02-29",
    place: "Park",
    timezone: "Asia/Bangkok",
    version: 1,
  },
};
const response = (status: number, body: unknown = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });
const noRotation = async (): Promise<string> => {
  throw new Error("Unexpected ID rotation");
};

test("lost insert acknowledgement retries the stored ID and updates one appointment", async () => {
  const events = new Map<string, Record<string, unknown>>();
  let loseResponse = true;
  const request: CalendarRequest = async (url, method = "GET", raw) => {
    const id = url.split("/").at(-1)!;
    const body = raw as Record<string, unknown>;
    if (method === "GET")
      return events.has(id) ? response(200, events.get(id)) : response(404);
    if (method === "POST") {
      if (events.has(String(body.id))) return response(409);
      events.set(String(body.id), body);
      if (loseResponse) {
        loseResponse = false;
        throw new Error("Connection lost after commit");
      }
      return response(200, body);
    }
    if (method === "PATCH") {
      events.set(id, body);
      return response(200, body);
    }
    throw new Error("Unexpected request");
  };
  await assert.rejects(
    syncCalendarEvent(job, request, noRotation),
    /Connection lost/,
  );
  await syncCalendarEvent(
    {
      ...job,
      revision: 2,
      payload: { ...job.payload!, version: 2, date: "2028-03-02" },
    },
    request,
    noRotation,
  );
  assert.equal(events.size, 1);
  const event = events.get(job.event_id)!;
  assert.deepEqual(event.start, { date: "2028-03-02" });
  assert.deepEqual(event.end, { date: "2028-03-03" });
  assert.equal("attendees" in event, false);
});

test("a concurrent insert conflict updates the existing event without rotation", async () => {
  const calls: string[] = [];
  const replies = [
    response(404),
    response(409),
    response(200, { status: "confirmed" }),
    response(200),
  ];
  await syncCalendarEvent(
    job,
    async (url, method = "GET") => {
      calls.push(`${method} ${url.split("/").at(-1)}`);
      return replies.shift()!;
    },
    noRotation,
  );
  assert.deepEqual(calls, [
    "GET a123",
    "POST events",
    "GET a123",
    "PATCH a123",
  ]);
});

test("ambiguous 409 then 404 retries later instead of risking a duplicate event", async () => {
  let requests = 0;
  const replies = [response(404), response(409), response(404)];
  await assert.rejects(
    syncCalendarEvent(
      job,
      async () => {
        requests++;
        return replies.shift()!;
      },
      noRotation,
    ),
    /404/,
  );
  assert.equal(requests, 3);
});

test("confirmed tombstones persist a replacement ID before inserting again", async () => {
  let persistedId = job.event_id;
  const replies = [response(410), response(200)];
  await syncCalendarEvent(
    job,
    async (url, method = "GET", body) => {
      if (method === "POST") {
        assert.equal(persistedId, "b456");
        assert.equal((body as { id: string }).id, persistedId);
        assert.deepEqual((body as { end: unknown }).end, {
          date: "2028-03-01",
        });
      }
      return replies.shift()!;
    },
    async () => {
      persistedId = "b456";
      return persistedId;
    },
  );
  assert.equal(replies.length, 0);
});

test("a changed revision stops tombstone replacement before creating an event", async () => {
  let requests = 0;
  await assert.rejects(
    syncCalendarEvent(
      job,
      async () => {
        requests++;
        return response(410);
      },
      async () => {
        throw new Error("Calendar job changed");
      },
    ),
    /job changed/,
  );
  assert.equal(requests, 1);
});

test("removing an absent event is idempotent while network errors remain retryable", async () => {
  for (const status of [204, 404, 410])
    await syncCalendarEvent(
      { ...job, payload: null },
      async (_, method) => {
        assert.equal(method, "DELETE");
        return response(status);
      },
      noRotation,
    );
  await assert.rejects(
    syncCalendarEvent(
      { ...job, payload: null },
      async () => response(503),
      noRotation,
    ),
    /503/,
  );
});
