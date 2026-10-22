import Link from "next/link";
import { StateScreen } from "@/components/ui/StateScreen";

export default function NotFound() {
  return <StateScreen title="ไม่พบหน้านี้" description="ลิงก์อาจไม่ถูกต้อง หรือคุณไม่มีสิทธิ์เปิดหน้านี้" icon="pin">
    <Link href="/trips" className="secondary-button">กลับไปหน้าทริป</Link>
  </StateScreen>;
}
