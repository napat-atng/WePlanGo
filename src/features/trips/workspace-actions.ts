"use server";

import { revalidatePath } from "next/cache";
import { authenticatedClient, loadWorkspace } from "./workspace-data";
import type { WorkspaceResult, WorkspaceState } from "./workspace-types";
import { syncCurrentCalendar } from "@/features/calendar/sync";

const actions = new Set([
  "profile",
  "availability",
  "create",
  "preview",
  "join",
  "invite",
  "revoke_invites",
  "propose",
  "vote",
  "close",
  "confirm",
  "rsvp",
  "message",
  "kick",
  "ban",
  "unban",
  "delete",
]);
export async function workspaceCommand(
  action: string,
  payload: Record<string, unknown>,
): Promise<WorkspaceResult> {
  if (!actions.has(action)) return { ok: false, error: "คำสั่งไม่ถูกต้อง" };
  const { client } = await authenticatedClient();
  const { data, error } = await client.rpc("room_command", {
    p_action: action,
    p: payload,
  });
  if (error) {
    const message = error.message.toLowerCase();
    return {
      ok: false,
      error: message.includes("banned")
        ? "คุณถูกแบนจากห้องนี้"
        : message.includes("organizer")
          ? "เฉพาะหัวห้องเท่านั้น"
          : message.includes("closed")
            ? "ปิดโหวตแล้ว กรุณาโหลดข้อมูลใหม่"
            : message.includes("plan changed")
              ? "แผนเปลี่ยนแล้ว กรุณาตรวจแผนล่าสุดก่อนตอบรับ"
              : message.includes("invitation")
                ? "ลิงก์เชิญหมดอายุหรือถูกยกเลิก"
                : message.includes("winning")
                  ? "เลือกสถานที่ที่คะแนนสูงสุดหรือเสมอกัน"
                  : message.includes("wait before")
                    ? "เว้นช่วงสักครู่ก่อนส่งข้อความถัดไป"
                    : message.includes("calendar conflict")
                      ? "วันนี้มีนัดหมายอยู่แล้ว กรุณาจัดการนัดในปฏิทินต้นทางก่อน"
                      : message.includes("not a room")
                        ? "คุณไม่ได้เป็นสมาชิกห้องนี้แล้ว"
                        : message.includes("deadline")
                          ? "กำหนดปิดโหวตต้องอยู่ในอนาคต"
                          : "บันทึกไม่ได้ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง",
    };
  }
  if (action === "rsvp") await syncCurrentCalendar().catch(() => undefined);
  revalidatePath("/trips");
  revalidatePath("/profile");
  return { ok: true, data };
}
export async function refreshWorkspace(
  roomId?: string,
  month?: string,
): Promise<WorkspaceState> {
  return loadWorkspace(roomId, month);
}
export async function uploadProfilePhoto(
  form: FormData,
): Promise<WorkspaceResult> {
  const { client, user } = await authenticatedClient(),
    file = form.get("photo");
  if (
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 1048576 ||
    !file.size
  )
    return { ok: false, error: "เลือกรูป PNG, JPEG หรือ WebP ไม่เกิน 1 MB" };
  const extension =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : "webp";
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage
    .from("profile-avatars")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error)
    return { ok: false, error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง" };
  const avatar = client.storage.from("profile-avatars").getPublicUrl(path)
    .data.publicUrl;
  const { data: profile } = await client
    .from("profiles")
    .select("display_name,avatar_url")
    .eq("user_id", user.id)
    .single();
  const result = await workspaceCommand("profile", {
    name: profile?.display_name ?? "เพื่อน",
    avatar,
  });
  if (!result.ok) await client.storage.from("profile-avatars").remove([path]);
  else if (profile?.avatar_url?.includes(`/profile-avatars/${user.id}/`)) {
    const oldPath = profile.avatar_url.split("/profile-avatars/")[1];
    await client.storage.from("profile-avatars").remove([oldPath]);
  }
  return result;
}
