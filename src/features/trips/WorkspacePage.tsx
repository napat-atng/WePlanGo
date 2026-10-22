import { redirect, notFound } from "next/navigation";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadWorkspace } from "./workspace-data";
import Workspace from "./Workspace";
import type { WorkspaceMode } from "./workspace-types";
import "@/components/ui/workspace.css";
import "./workspace-live.css";

export async function WorkspacePage({
  mode,
  roomId,
  token,
  notice,
}: {
  mode: WorkspaceMode;
  roomId?: string;
  token?: string;
  notice?: string;
}) {
  const path =
    mode === "room"
      ? `/trips/${roomId}`
      : mode === "profile"
        ? "/profile"
        : mode === "create"
          ? "/trips/new"
          : mode === "invite"
            ? token
              ? `/invite/${encodeURIComponent(token)}`
              : "/join"
            : "/trips";
  if (!getSupabasePublicEnv()) redirect(`/?next=${encodeURIComponent(path)}`);
  const client = await createServerSupabaseClient(),
    { data: auth, error } = await client.auth.getUser();
  if (error || !auth.user) redirect(`/?next=${encodeURIComponent(path)}`);
  let state;
  try {
    state = await loadWorkspace(roomId);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("ไม่พบห้อง") ||
        error.message.includes("ไม่ได้เป็นสมาชิก"))
    )
      notFound();
    throw error;
  }
  if (state.current && state.current.room.starts_on.slice(0, 7) > state.month)
    state = await loadWorkspace(
      roomId,
      state.current.room.starts_on.slice(0, 7),
    );
  return (
    <Workspace
      key={`${mode}:${roomId ?? token ?? ""}`}
      initial={state}
      mode={mode}
      token={token}
      initialNotice={notice}
    />
  );
}
