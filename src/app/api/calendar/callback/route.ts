import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedClient } from "@/features/trips/workspace-data";
import { encryptTokens } from "@/features/calendar/crypto";
import { syncCalendar } from "@/features/calendar/sync";

export const maxDuration = 60;
export async function GET(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.redirect(
    new URL("/profile?calendar=connected", request.url),
  );
  response.cookies.set("weplango-calendar-oauth", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/api/calendar",
  });
  try {
    const stored = JSON.parse(
      Buffer.from(
        request.cookies.get("weplango-calendar-oauth")?.value ?? "",
        "base64url",
      ).toString("utf8"),
    );
    const state = request.nextUrl.searchParams.get("state") ?? "",
      code = request.nextUrl.searchParams.get("code");
    const { client, user } = await authenticatedClient();
    if (
      !code ||
      typeof stored.state !== "string" ||
      stored.user !== user.id ||
      Buffer.byteLength(state) !== Buffer.byteLength(stored.state) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(stored.state))
    )
      throw new Error("Invalid OAuth state");
    const callback = new URL(
      "/api/calendar/callback",
      process.env.APP_URL ?? request.nextUrl.origin,
    ).href;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
        code,
        code_verifier: stored.verifier,
        redirect_uri: callback,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error("OAuth exchange failed");
    const tokens = await tokenResponse.json();
    if (
      typeof tokens.access_token !== "string" ||
      typeof tokens.refresh_token !== "string"
    )
      throw new Error("Offline access required");
    const scopes = new Set(String(tokens.scope ?? "").split(" "));
    if (
      !scopes.has("https://www.googleapis.com/auth/calendar.events.owned") ||
      !scopes.has("https://www.googleapis.com/auth/calendar.freebusy")
    )
      throw new Error("Calendar scopes required");
    const { error } = await client.rpc("calendar_command", {
      p_action: "connect",
      p: {
        tokens: encryptTokens({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + Number(tokens.expires_in ?? 3600) * 1000,
        }),
      },
    });
    if (error) throw new Error("Unable to save credentials");
    await syncCalendar(client);
    return response;
  } catch {
    response.headers.set(
      "Location",
      new URL("/profile?calendar=failed", request.url).href,
    );
    return response;
  }
}
