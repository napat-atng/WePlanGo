import { WorkspacePage } from "@/features/trips/WorkspacePage";
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string }>;
}) {
  const { calendar } = await searchParams;
  const notice =
    calendar === "failed"
      ? "เชื่อม Google ไม่สำเร็จ กรุณาลองใหม่และอนุญาตสิทธิ์ Calendar ทั้งสองรายการ"
      : calendar === "configuration"
        ? "ยังไม่ได้ตั้งค่า Google Calendar กรุณาติดต่อผู้ดูแล"
        : calendar === "connected"
          ? "เชื่อม Google แล้ว ดูผลการซิงก์ในส่วน Google Calendar"
          : undefined;
  return <WorkspacePage mode="profile" notice={notice} />;
}
