import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedClient } from "@/features/trips/workspace-data";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { user } = await authenticatedClient();
  if (
    !process.env.GOOGLE_CALENDAR_CLIENT_ID ||
    !process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||
    !process.env.CALENDAR_TOKEN_KEY
  )
    return NextResponse.redirect(
      new URL("/profile?calendar=configuration", request.url),
    );
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const callback = new URL(
    "/api/calendar/callback",
    process.env.APP_URL ?? request.nextUrl.origin,
  ).href;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    redirect_uri: callback,
    response_type: "code",
    scope:
      "https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.freebusy",
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(
    "weplango-calendar-oauth",
    Buffer.from(JSON.stringify({ state, verifier, user: user.id })).toString(
      "base64url",
    ),
    {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      maxAge: 600,
      path: "/api/calendar",
    },
  );
  return response;
}
