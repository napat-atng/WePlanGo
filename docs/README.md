# เอกสาร WePlanGo

ระบบจริงรุ่นใหม่ใช้หนึ่งห้องต่อหนึ่งทริป ปฏิทินส่วนตัวร่วมทุกทริป และแชท ดูกติกา โครงสร้างข้อมูล การตั้งค่า และสถานะตรวจรับที่ [WORKSPACE.md](WORKSPACE.md) เอกสาร MVP ด้านล่างเก็บเป็นสเปกและหลักฐานของรุ่นก่อน

| เอกสาร | ใช้เพื่อ |
| --- | --- |
| [STRUCTURE.md](STRUCTURE.md) | เข้าใจขอบเขต สถาปัตยกรรม กติกาหลัก และข้อมูลของระบบ |
| [BUILD_PLAN.md](BUILD_PLAN.md) | ลงมือสร้างตามลำดับ พร้อมเกณฑ์ตรวจรับแต่ละช่วง |
| [features/README.md](features/README.md) | ค้นหาสเปกพฤติกรรมของแต่ละฟีเจอร์ |
| [TEST_REPORT.md](TEST_REPORT.md) | ผลทดสอบและหลักฐานตรวจรับ MVP |

## ต้นแบบระบบใหม่

ดู [สเปกและวิธีทดลอง Mockup](MOCKUP.md) เปิดที่ `/mockup` โดยไม่ต้องเชื่อมฐานข้อมูล ระบบจริงที่ `/trips` ใช้หน้าตาและชุด controls เดียวกัน แต่ใช้บัญชีจริง ตรวจสิทธิ์จริง และบันทึกลง Supabase

## ทดสอบฐานข้อมูลในเครื่อง

เมื่อ Docker พร้อม ให้รันจากราก repository:

```powershell
npx.cmd supabase@latest start
npx.cmd supabase@latest db reset --local
npx.cmd supabase@latest test db --local
```

`db reset --local` สร้างฐานข้อมูลทดลองใหม่ตาม `supabase/migrations/` และล้างข้อมูล local เดิม ชุดทดสอบใน `supabase/tests/` ใช้ pgTAP พร้อม SQL assertions ตรวจสิทธิ์และกติกา ทุกไฟล์สร้างข้อมูลทดสอบใน transaction และ rollback เมื่อจบ

การทดสอบนี้ใช้ผู้ใช้จำลองในฐานข้อมูล ส่วนการตรวจ Google login และเส้นทางบนเว็บต้องทดสอบเพิ่มด้วยสองบัญชีจริงตาม `BUILD_PLAN.md`
