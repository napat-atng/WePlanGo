import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticatedClient } from "@/features/trips/workspace-data";
import { todayBangkok } from "@/features/trips/workspace-validation";
import { decryptTokens, encryptTokens, type GoogleTokens } from "./crypto";

import { syncCalendarEvent, type CalendarJob } from "./event-sync";
import { loadFreeBusy } from "./freebusy";

type Claim = { lease: string; tokens: string; jobs: CalendarJob[] };
export type CalendarSyncResult = { ok: boolean; error?: string };
async function googleApi(
  url: string,
  token: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(7000)])
      : AbortSignal.timeout(7000),
    cache: "no-store",
  });
}
async function refresh(
  tokens: GoogleTokens,
  signal: AbortSignal,
): Promise<GoogleTokens> {
  if (tokens.expiresAt > Date.now() + 60000) return tokens;
  if (
    !process.env.GOOGLE_CALENDAR_CLIENT_ID ||
    !process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  )
    throw new Error("ต้องตั้งค่า Google Calendar ก่อนซิงก์");
  const result = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(7000)]),
    cache: "no-store",
  });
  if (!result.ok) throw new Error("สิทธิ์ Google หมดอายุ กรุณาเชื่อมต่อใหม่");
  const data = await result.json();
  if (typeof data.access_token !== "string")
    throw new Error("Google ไม่ส่งสิทธิ์ Calendar กลับมา");
  return {
    ...tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000,
  };
}
export async function syncCalendar(
  client: SupabaseClient,
  userId?: string,
  deadline = Date.now() + 45000,
): Promise<CalendarSyncResult> {
  const signal = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
  const api = (url: string, token: string, method = "GET", body?: unknown) =>
    googleApi(url, token, method, body, signal);
  const identity = userId ? { user: userId } : {};
  const call = async (action: string, p: Record<string, unknown>) => {
    const result = await client.rpc("calendar_command", {
      p_action: action,
      p: { ...p, ...identity },
    });
    if (result.error) throw new Error("บันทึกสถานะการซิงก์ไม่สำเร็จ");
    return result.data;
  };
  const { data, error } = await client.rpc("calendar_command", {
    p_action: "claim",
    p: identity,
  });
  if (error) return { ok: false, error: "เริ่มซิงก์ไม่สำเร็จ" };
  if (!data) return { ok: true };
  const claim = data as Claim,
    results: { room: string; revision: number; ok: boolean; error?: string }[] =
      [];
  let tokens: GoogleTokens | undefined,
    busy: unknown[] | undefined,
    syncError: string | undefined;
  const started = Date.now();
  try {
    tokens = await refresh(decryptTokens(claim.tokens), signal);
    for (const job of claim.jobs) {
      if (Date.now() - started > 30000) break;
      try {
        await syncCalendarEvent(
          job,
          (url, method, body) => api(url, tokens!.accessToken, method, body),
          async () => {
            const rotated = await call("event_id", {
              lease: claim.lease,
              room: job.room_id,
              revision: job.revision,
            });
            return rotated.event_id;
          },
        );
        results.push({ room: job.room_id, revision: job.revision, ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "ซิงก์นัดไม่สำเร็จ";
        results.push({
          room: job.room_id,
          revision: job.revision,
          ok: false,
          error: message,
        });
        syncError = message;
      }
    }
    const first = new Date(`${todayBangkok()}T00:00:00+07:00`),
      last = new Date(first);
    first.setUTCDate(first.getUTCDate() - 30);
    last.setUTCDate(last.getUTCDate() + 730);
    busy = await loadFreeBusy(
      (url, method, body) => api(url, tokens!.accessToken, method, body),
      first.toISOString(),
      last.toISOString(),
    );
  } catch (e) {
    syncError =
      e instanceof Error
        ? e.message
        : "ซิงก์ Calendar ไม่สำเร็จ กรุณาลองอีกครั้ง";
  }
  await call("finish", {
    lease: claim.lease,
    results,
    error: syncError ?? null,
    ...(tokens ? { tokens: encryptTokens(tokens) } : {}),
    ...(busy ? { busy } : {}),
  });
  return syncError ? { ok: false, error: syncError } : { ok: true };
}
export async function syncCurrentCalendar(): Promise<CalendarSyncResult> {
  const { client } = await authenticatedClient();
  return syncCalendar(client);
}
