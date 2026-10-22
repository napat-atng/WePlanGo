"use client";

import { useState } from "react";
import { safeNextPath } from "@/features/access/safe-next-path";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function GoogleSignInButton({
  nextPath = "/trips",
  className = "primary-button",
}: {
  nextPath?: string;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = getSupabasePublicEnv() !== null;

  async function signIn(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const next = encodeURIComponent(safeNextPath(nextPath));
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        },
      });
      if (authError) throw authError;
    } catch {
      setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        className={className}
        type="button"
        onClick={signIn}
        disabled={!configured || loading}
      >
        {loading ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Google"}
      </button>
      {!configured && (
        <p className="form-note">ยังไม่ได้ตั้งค่า Supabase สำหรับเว็บไซต์นี้</p>
      )}
      {error && (
        <p className="form-note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
