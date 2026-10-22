// Explicit integration check: creates one clearly named temporary Google event,
// updates it through the real outbox worker, then removes it. No attendees.
import assert from "node:assert/strict";
import { createDecipheriv, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--run"))
  throw new Error(
    "Use --run to create and remove a temporary calendar test event",
  );
process.loadEnvFile(".env.local");
const key =
  process.env.WEPLANGO_SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || !process.env.CRON_SECRET || !process.env.CALENDAR_TOKEN_KEY)
  throw new Error("Worker credentials required");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const origin = process.env.WORKSPACE_URL ?? "http://localhost:3000";
const scheduled = process.argv.includes("--scheduled");
let firstWorkerCall = true;
const scheduledAt = new Date(Math.ceil((Date.now() + 30000) / 300000) * 300000).toISOString();
function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
const accounts = checked(
  await client
    .from("calendar_account_status")
    .select("user_id")
    .eq("connected", true),
);
const user =
  process.env.CALENDAR_TEST_USER_ID ??
  (accounts.length === 1 ? accounts[0].user_id : null);
if (!user || !accounts.some((account) => account.user_id === user))
  throw new Error("Choose a connected CALENDAR_TEST_USER_ID explicitly");
const call = async (action, data = {}) =>
  checked(
    await client.rpc("calendar_command", {
      p_action: action,
      p: { user, ...data },
    }),
  );
const claim = await call("claim");
if (!claim)
  throw new Error(
    "Calendar is currently syncing; retry after the active lease finishes",
  );
let tokens;
try {
  const [, iv, tag, encrypted] = claim.tokens.split(".");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.CALENDAR_TOKEN_KEY, "base64"),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  tokens = JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString(),
  );
} finally {
  await call("finish", { lease: claim.lease, results: [] });
}
if (tokens.expiresAt <= Date.now() + 180000)
  throw new Error("Refresh Calendar in Profile before running this check");
const room = randomUUID();
const date = new Date();
date.setUTCDate(date.getUTCDate() + 7);
const firstDay = date.toISOString().slice(0, 10);
date.setUTCDate(date.getUTCDate() + 1);
const secondDay = date.toISOString().slice(0, 10);
const payload = {
  title: "[WePlanGo ทดสอบ] ลบอัตโนมัติหลังตรวจ",
  date: firstDay,
  place: "",
  timezone: "Asia/Bangkok",
  version: 1,
};
const worker = async () => {
  if (scheduled && firstWorkerCall) {
    firstWorkerCall = false;
    console.log("Waiting for the configured Cron job to process the pending test event.");
    const deadline = Date.parse(scheduledAt) + 90000;
    while (Date.now() < deadline) {
      const current = await job();
      if (current.revision === current.synced_revision) return;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error("Scheduled worker did not acknowledge the pending test event");
  }
  const response = await fetch(`${origin}/api/calendar/cron`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(response.status, 200, "Worker HTTP request failed");
  const result = await response.json();
  assert.equal(result.failed, 0, "Worker reported a sync failure");
};
const job = async () =>
  checked(
    await client
      .from("calendar_event_jobs")
      .select("event_id,revision,synced_revision,payload")
      .eq("user_id", user)
      .eq("room_id", room)
      .single(),
  );
const google = async (path) =>
  fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`,
    {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      signal: AbortSignal.timeout(10000),
    },
  );
const activeCount = async () => {
  const response = await google(
    `?privateExtendedProperty=${encodeURIComponent(`weplangoRoom=${room}`)}&showDeleted=false`,
  );
  assert.equal(response.status, 200);
  return (await response.json()).items.filter(
    (event) => event.status !== "cancelled",
  ).length;
};
let created = false,
  removed = false;
try {
  // Intentional orphan outbox row: this is also how deleted-room removals work.
  // Room/RSVP -> outbox behavior is covered by SQL 11 and browser flow checks.
  checked(
    await client
      .from("calendar_event_jobs")
      .insert({ user_id: user, room_id: room, payload, ...(scheduled ? { next_attempt_at: scheduledAt } : {}) }),
  );
  created = true;
  await worker();
  const first = await job();
  assert.equal(first.revision, first.synced_revision);
  let response = await google(`/${first.event_id}`);
  assert.equal(response.status, 200);
  let event = await response.json();
  assert.equal(event.start.date, firstDay);
  assert.equal(await activeCount(), 1);
  const dayStart = `${firstDay}T00:00:00+07:00`,
    dayEnd = `${firstDay}T23:59:59+07:00`;
  const periods = checked(
    await client
      .from("calendar_busy_periods")
      .select("id")
      .eq("user_id", user)
      .lt("starts_at", dayEnd)
      .gt("ends_at", dayStart),
  );
  assert.ok(periods.length > 0, "Real Google busy event was not imported");
  checked(
    await client
      .from("calendar_event_jobs")
      .update({
        payload: { ...payload, date: secondDay, version: 2 },
        revision: first.revision + 1,
        next_attempt_at: "1970-01-01T00:00:00.000Z",
      })
      .eq("user_id", user)
      .eq("room_id", room),
  );
  await worker();
  const revised = await job();
  assert.equal(revised.event_id, first.event_id);
  assert.equal(revised.revision, revised.synced_revision);
  response = await google(`/${revised.event_id}`);
  assert.equal(response.status, 200);
  event = await response.json();
  assert.equal(event.start.date, secondDay);
  assert.equal(event.extendedProperties.private.planVersion, "2");
  assert.equal(await activeCount(), 1);
  console.log(
    "Real outbox worker created one Google event, imported busy time, and updated the same event without duplication.",
  );
} finally {
  if (created) {
    const current = await job();
    checked(
      await client
        .from("calendar_event_jobs")
        .update({
          payload: null,
          revision: current.revision + 1,
          next_attempt_at: "1970-01-01T00:00:00.000Z",
        })
        .eq("user_id", user)
        .eq("room_id", room),
    );
    await worker();
    const final = await job();
    assert.equal(final.revision, final.synced_revision);
    assert.equal(await activeCount(), 0);
    checked(
      await client
        .from("calendar_event_jobs")
        .delete()
        .eq("user_id", user)
        .eq("room_id", room),
    );
    removed = true;
    console.log(
      "Temporary Google event and outbox fixture removed; other calendar events untouched.",
    );
  }
}
await writeFile(
  "docs/production/google-worker-check.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      method:
        "Temporary outbox fixture -> real worker -> real Google Calendar",
      origin,
      checks: [
        "event creation",
        "actual busy period imported",
        "same event ID updated",
        "one active event after revision",
        "event deletion",
      ],
      fixtureRemoved: removed,
      productionScheduler: scheduled
        ? "First event creation completed without an HTTP worker call from the test process; verify Cron and pg_net history alongside this report"
        : "verified separately using Cron and pg_net response history",
    },
    null,
    2,
  ) + "\n",
);
