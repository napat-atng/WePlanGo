import Image from "next/image";
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Icon } from "@/components/ui/Icon";
import { safeNextPath } from "@/features/access/safe-next-path";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import "@/components/ui/workspace.css";
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams,
    destination = safeNextPath(next);
  if (getSupabasePublicEnv()) {
    const client = await createServerSupabaseClient();
    const { data } = await client.auth.getUser();
    if (data.user) redirect(destination);
  }
  return (
    <div className="demo-app">
      <header className="demo-header">
        <div className="demo-brand">
          <span className="demo-brand-mark">
            <Icon name="mountain" size={24} />
          </span>
          WePlanGo
        </div>
      </header>
      <main className="demo-login">
        <div>
          <h1>
            ทริปดี ๆ เริ่มจาก
            <br />
            วันที่เราว่างตรงกัน
          </h1>
          <p>ชวนเพื่อน เลือกวัน โหวตที่เที่ยว แล้วไปด้วยกัน</p>
          <GoogleSignInButton nextPath={destination} className="demo-primary" />
          <p className="demo-note">เข้าสู่ระบบด้วยบัญชี Google ของคุณ</p>
        </div>
        <section className="demo-login-preview">
          <Image
            unoptimized
            fill
            priority
            src="/mockup/chiang-mai.jpg"
            alt="บรรยากาศภูเขาเชียงใหม่ยามเย็น"
            sizes="(max-width:600px) 100vw,600px"
          />
          <div className="demo-login-preview-copy">
            <h2>
              ครั้งหน้า
              <br />
              ไปเที่ยวด้วยกัน
            </h2>
            <p>รวมวันว่างและแผนของเพื่อนไว้ที่เดียว</p>
          </div>
        </section>
      </main>
    </div>
  );
}
