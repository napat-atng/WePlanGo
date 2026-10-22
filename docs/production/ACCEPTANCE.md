# ตรวจรับระบบห้องทริป

ตรวจเมื่อ 22 ตุลาคม 2026 ระบบใหม่เปิดใช้งานที่ https://weplango-napat6.vercel.app แล้ว

| ข้อกำหนด | ผลและหลักฐาน |
| --- | --- |
| Mockup แก้ไขได้ แยกข้อมูลจริง | `/mockup`, `../MOCKUP.md`, `../mockup/ux-check.json` |
| Google Login และ Calendar บน production | ผู้ใช้ยืนยัน Login และ Profile แสดงเชื่อมต่อด้วยบัญชี Google จริง |
| ชื่อ รูป วันว่างกลางจาก Profile/ห้อง | browser ผ่านชื่อและ Storage avatar; SQL test 11 ตรวจวันว่างกลางและ unknown |
| สร้างห้อง เชิญ เข้าร่วม เสนอ โหวต ยืนยัน RSVP | สองบัญชีบน production ผ่าน ดู [check.json](check.json) |
| หลายคะแนน แก้คะแนนก่อนปิด หัวห้องน้ำหนักเท่ากัน | SQL test 11 และ Node validation tests ผ่าน |
| คะแนนเสมอและเลือกวันตามจำนวนคนว่าง | [planning-check.json](planning-check.json), [desktop](tie-desktop.png), [mobile](tie-mobile.png) ผ่าน |
| เปลี่ยนแผนให้ตอบรับใหม่และถอนนัดเก่า | browser และ SQL test 11 ผ่านการตรวจ plan version และ outbox |
| แชท ผู้ส่ง เวลา ข้อความระบบ | browser และ SQL test 11 ผ่าน; desktop วางข้างแผน mobile เป็นแท็บ |
| เตะ แบน ปลดแบน และเข้าผ่านคำเชิญใหม่ | browser ตรวจ ban/unban; SQL test 11 ตรวจ kick → invite → rejoin |
| ลบห้องพร้อมยืนยันและคิวถอนนัด | browser/SQL ผ่าน; outbox อยู่ต่อหลังลบห้องเพื่อถอนนัด |
| ความเป็นส่วนตัว Calendar | SQL tests 11–12 ตรวจ own-only และข้อมูลร่วมเฉพาะสถานะ; busy periods เก็บเพียงช่วงเวลา |
| อ่าน busy และสร้าง/แก้/ลบนัด Google จริง | ผ่าน [google-worker-check.json](google-worker-check.json): แก้ event ID เดิม เหลือนัดเดียว และลบสำเร็จ |
| network failure และ retry ไม่สร้างนัดซ้ำ | transport tests 6 กรณีและ SQL revision CAS ผ่าน |
| ซิงก์ขณะปิดเว็บ | Vault/Cron ทุก 5 นาที ผ่านรอบ 08:00 UTC: HTTP 200, processed 1, failed 0 ดู [DEPLOYMENT.json](DEPLOYMENT.json) |
| มือถือ คอมพิวเตอร์ คีย์บอร์ด | [desktop](desktop.png), [mobile](mobile.png), mockup keyboard/month picker checks ผ่าน |
| lint, tests, build | ผ่าน lint, Node 23 tests, production build และ SQL 13 ไฟล์ ดู [database-check.json](database-check.json) |
| migration และย้ายข้อมูล | migration workspace 6 ไฟล์ตรงกับ remote history; เก็บ legacy source ไม่ sync สองทาง |
| เปิด production | Vercel Ready และโดเมนหลักใช้งานได้ ดู [DEPLOYMENT.json](DEPLOYMENT.json) |

## ขอบเขตการทดสอบ

Flow ห้องบน production ใช้บัญชี email ชั่วคราวสองบัญชีและคนนอกอีกหนึ่งบัญชีผ่าน Supabase จริง ส่วน Google Login/consent/Profile ผู้ใช้ยืนยันด้วยบัญชี Google จริงหนึ่งบัญชี

ทดสอบ RSVP/เปลี่ยนแผน/ลบห้องจนถึง outbox ด้วย browser และ SQL ส่วนการสร้าง/แก้/ลบนัด Google จริงตรวจแยกด้วย outbox fixture โดย Cron สร้างนัดแรกเองตามรอบ ไม่ได้อ้างว่าได้ทดสอบ UI ถึง Google ครบด้วยสองบัญชี Google

บัญชี รูป session กิจกรรม Google และ outbox fixture ที่สร้างเพื่อทดสอบถูกลบแล้ว ไม่แก้กิจกรรมส่วนตัวอื่น วิธีตั้งค่าและตรวจซ้ำอยู่ใน [WORKSPACE.md](../WORKSPACE.md)
