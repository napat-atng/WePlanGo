import type { Person, Trip } from "./model.ts";

export function nextStep(
  trip: Trip,
  person: Person,
  closed: boolean,
): { stage: number; title: string; action: string; tab: number } {
  if (trip.plan)
    return {
      stage: 4,
      title:
        trip.rsvps[person.id] === trip.plan.version
          ? "พร้อมไปเที่ยวแล้ว"
          : "แผนพร้อมแล้ว ไปด้วยกันไหม?",
      action: "ดูแผนและตอบรับ",
      tab: 0,
    };
  if (closed)
    return {
      stage: 3,
      title:
        person.id === trip.owner
          ? "เลือกวัน แล้วสรุปแผนได้เลย"
          : "รอหัวห้องสรุปแผน",
      action: "ดูผลโหวต",
      tab: 2,
    };
  if (
    person.id === trip.owner &&
    trip.members.length === 1 &&
    !trip.inviteShared
  )
    return {
      stage: 0,
      title: "ห้องพร้อมแล้ว ชวนเพื่อนกัน",
      action: "คัดลอกคำเชิญ",
      tab: 4,
    };
  if (
    !Object.keys(person.availability).some(
      (date) => date >= trip.start && date <= trip.end,
    )
  )
    return {
      stage: 1,
      title: "คุณว่างวันไหน?",
      action: "เลือกวันว่าง",
      tab: 1,
    };
  if (!trip.places.length)
    return {
      stage: 2,
      title: "อยากไปไหน เสนอที่แรกเลย",
      action: "เสนอสถานที่",
      tab: 2,
    };
  if (!trip.places.some((p) => p.votes.includes(person.id)))
    return {
      stage: 2,
      title: "เลือกที่ที่อยากไป",
      action: "เลือกที่เที่ยว",
      tab: 2,
    };
  return {
    stage: 3,
    title:
      person.id === trip.owner
        ? "ดูคำตอบเพื่อน แล้วสรุปทริป"
        : "ตอบครบแล้ว รอเพื่อนคนอื่น",
    action: person.id === trip.owner ? "สรุปทริป" : "ดูผลโหวต",
    tab: person.id === trip.owner ? 0 : 2,
  };
}
