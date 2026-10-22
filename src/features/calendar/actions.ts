"use server";
import { authenticatedClient } from "@/features/trips/workspace-data";
import { syncCurrentCalendar } from "./sync";
export async function synchronizeCalendar() {
  return syncCurrentCalendar();
}
export async function disconnectCalendar() {
  const { client } = await authenticatedClient();
  const queued = await client.rpc("calendar_command", {
    p_action: "queue_disconnect",
    p: {},
  });
  if (queued.error) return { ok: false, error: "ถอนนัดไม่สำเร็จ กรุณาลองใหม่" };
  const sync = await syncCurrentCalendar();
  if (!sync.ok) return sync;
  const result = await client.rpc("calendar_command", {
    p_action: "disconnect",
    p: {},
  });
  return result.error
    ? { ok: false, error: "ยังมีนัดรอลบ กรุณาลองอีกครั้ง" }
    : { ok: true };
}
