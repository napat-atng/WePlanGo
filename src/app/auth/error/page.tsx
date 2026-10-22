import Link from "next/link";
import { StateScreen } from "@/components/ui/StateScreen";

export default function AuthErrorPage() {
  return <StateScreen title="เข้าสู่ระบบไม่สำเร็จ" description="กรุณาลองเข้าสู่ระบบด้วย Google อีกครั้ง" icon="users">
    <Link href="/" className="secondary-button">กลับหน้าแรก</Link>
  </StateScreen>;
}
