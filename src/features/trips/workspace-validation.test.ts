import test from "node:test";
import assert from "node:assert/strict";
import { leaders, monthRange, validId } from "./workspace-validation.ts";
test("month bounds preserve Thai midnight and leap days", () => {
  assert.deepEqual(monthRange("2028-02"), {
    first: "2028-02-01",
    last: "2028-02-29",
    start: "2028-02-01T00:00:00+07:00",
    end: "2028-02-29T17:00:00.000Z",
  });
  assert.equal(monthRange("2026-12").end, "2026-12-31T17:00:00.000Z");
  assert.throws(() => monthRange("2026-13"));
  assert.throws(() => monthRange("bad"));
});
test("place winners include ties without weighting an organizer", () => {
  const places = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(leaders(places, []), []);
  assert.deepEqual(leaders(places, [{ place_id: "a" }, { place_id: "b" }]), [
    "a",
    "b",
  ]);
  assert.deepEqual(
    leaders(places, [{ place_id: "a" }, { place_id: "b" }, { place_id: "a" }]),
    ["a"],
  );
});
test("route IDs accept UUIDs and reject ambiguous input", () => {
  assert.ok(validId("00000000-0000-0000-0000-000000000001"));
  assert.ok(!validId("../profile"));
});
