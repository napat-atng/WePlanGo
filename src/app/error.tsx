"use client";

import Link from "next/link";
import { StateScreen } from "@/components/ui/StateScreen";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StateScreen title="โหลดหน้าไม่สำเร็จ" description="ลองเปิดหน้านี้อีกครั้ง หากยังมีปัญหาให้กลับไปหน้าทริป" icon="close">
    <button className="primary-button" type="button" onClick={reset}>ลองอีกครั้ง</button>
    <Link href="/trips" className="secondary-button">กลับไปหน้าทริป</Link>
  </StateScreen>;
}
