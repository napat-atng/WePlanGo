import test from "node:test";
import assert from "node:assert/strict";
import { nextStep } from "./next-step.ts";
import { seed } from "./model.ts";

test("new room leads from invite through availability, proposal, voting and finalization", () => {
  const state = seed();
  const room = state.trips[0];
  const me = state.people[0];
  room.members = [me.id];
  room.places = [];
  me.availability = {};
  assert.equal(nextStep(room, me, false).stage, 0);
  room.inviteShared = true;
  assert.equal(nextStep(room, me, false).tab, 1);
  me.availability[room.start] = "free";
  assert.equal(nextStep(room, me, false).action, "เสนอสถานที่");
  room.places = [
    { id: "place", name: "ทะเล", detail: "", author: me.id, votes: [] },
  ];
  assert.equal(nextStep(room, me, false).action, "เลือกที่เที่ยว");
  room.places[0].votes.push(me.id);
  assert.equal(nextStep(room, me, false).action, "สรุปทริป");
  assert.equal(nextStep(room, me, true).stage, 3);
  room.plan = { date: room.start, place: "place", version: 1 };
  assert.equal(nextStep(room, me, true).stage, 4);
  room.rsvps[me.id] = 1;
  assert.equal(nextStep(room, me, true).title, "พร้อมไปเที่ยวแล้ว");
});

test("members are never asked to invite or close voting; answers outside the trip do not complete availability", () => {
  const state = seed();
  const room = state.trips[0];
  const member = state.people[1];
  member.availability = { "2027-01-01": "free" };
  assert.equal(nextStep(room, member, false).stage, 1);
  member.availability[room.start] = "busy";
  assert.equal(
    nextStep(room, member, false).title,
    "ตอบครบแล้ว รอเพื่อนคนอื่น",
  );
  assert.equal(nextStep(room, member, true).title, "รอหัวห้องสรุปแผน");
});
