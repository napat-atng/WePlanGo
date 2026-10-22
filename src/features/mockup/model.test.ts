import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarEvents,
  confirmPlan,
  joinTrip,
  leaders,
  removeMember,
  seed,
} from "./model.ts";

test("equal approval totals allow only tied leaders; organizer has no extra vote", () => {
  const t = seed().trips[0];
  t.closed = true;
  assert.deepEqual(
    leaders(t).map((p) => p.id),
    ["doi", "mae"],
  );
  assert.throws(() => confirmPlan(t, "non", "2026-11-14", "doi"));
  assert.throws(() => confirmPlan(t, "pim", "2026-11-14", "jing"));
  assert.throws(() => confirmPlan(t, "pim", "2027-01-01", "doi"));
  assert.equal(confirmPlan(t, "pim", "2026-11-14", "mae").plan?.place, "mae");
});
test("RSVP creates one event per trip; revised plans clear old acceptance", () => {
  const s = seed();
  s.trips[0].closed = true;
  s.trips[0] = confirmPlan(s.trips[0], "pim", "2026-11-14", "doi");
  assert.equal(calendarEvents(s, "non").length, 0);
  s.trips[0].rsvps.non = 1;
  assert.equal(calendarEvents(s, "non").length, 1);
  s.trips[0] = confirmPlan(s.trips[0], "pim", "2026-11-16", "mae");
  assert.equal(calendarEvents(s, "non").length, 0);
  s.trips[0].rsvps.non = 2;
  assert.deepEqual(
    calendarEvents(s, "non").map((e) => [e.id, e.date, e.version]),
    [[s.trips[0].id, "2026-11-16", 2]],
  );
});
test("kick removes votes and events; ban blocks invitations until lifted", () => {
  const original = seed().trips[0];
  assert.throws(() => removeMember(original, "non", "may", true));
  assert.throws(() => removeMember(original, "pim", "pim", true));
  const kicked = removeMember(original, "pim", "non", false);
  assert.ok(!kicked.places.some((p) => p.votes.includes("non")));
  assert.ok(joinTrip(kicked, "non", kicked.invite).members.includes("non"));
  const banned = removeMember(original, "pim", "non", true);
  assert.throws(() => joinTrip(banned, "non", banned.invite));
  banned.banned = [];
  assert.ok(joinTrip(banned, "non", banned.invite).members.includes("non"));
  banned.inviteActive = false;
  assert.throws(() => joinTrip(banned, "non", banned.invite));
});
