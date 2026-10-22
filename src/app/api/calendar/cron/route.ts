import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { syncCalendar } from "@/features/calendar/sync";
export const maxDuration = 60;
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET,
    provided = request.headers.get("authorization") ?? "",
    expected = `Bearer ${secret}`;
  if (
    !secret ||
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key =
      process.env.WEPLANGO_SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return NextResponse.json(
      { error: "Calendar worker is not configured" },
      { status: 503 },
    );
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("calendar_pending_users");
  if (error)
    return NextResponse.json(
      { error: "Unable to claim sync work" },
      { status: 500 },
    );
  const started = Date.now();
  let processed = 0,
    failed = 0;
  for (const account of data ?? []) {
    if (Date.now() - started > 40000) break;
    try {
      const result = await syncCalendar(
        client,
        account.user_id,
        started + 45000,
      );
      if (!result.ok) failed++;
    } catch {
      failed++;
    }
    processed++;
  }
  return NextResponse.json({ processed, failed });
}
