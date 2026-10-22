import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Install Playwright outside the app, or provide it through the environment.
const modulePath = process.env.MOCKUP_PLAYWRIGHT_MODULE;
const freshMember = process.env.MOCKUP_FRESH_MEMBER === "1";
const { chromium } = await import(
  modulePath ? pathToFileURL(modulePath).href : "playwright"
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Bangkok",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  if (freshMember) {
    const { seed } = await import("../src/features/mockup/model.ts");
    const initial = seed();
    initial.people.find((person) => person.id === "non").availability = {};
    await context.addInitScript((data) => {
      if (!localStorage.getItem("weplango-mockup-v1"))
        localStorage.setItem("weplango-mockup-v1", JSON.stringify(data));
    }, initial);
  }
  page.setDefaultTimeout(12000);
  const errors = [];
  const externalRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/))
      externalRequests.push(request.url());
  });
  const counts = { organizer: 0, member: 0 };
  async function click(role, locator) {
    await locator.click();
    counts[role] += 1;
  }
  async function switchUser(id) {
    const tools = page.locator(".demo-test-tools");
    if (!(await tools.evaluate((element) => element.open)))
      await tools.locator("summary").first().click();
    await page.getByLabel("ทดลองเป็น").selectOption(id);
    await tools.locator("summary").first().click();
  }
  async function noOverflow() {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await mkdir("docs/mockup", { recursive: true });
  await page.goto(process.env.MOCKUP_URL ?? "http://localhost:3000/mockup");
  await page
    .getByRole("button", { name: "เข้าสู่ระบบด้วย Google (จำลอง)" })
    .click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "docs/mockup/home.png", fullPage: true });
  await click(
    "organizer",
    page.getByRole("button", { name: "สร้างทริปใหม่", exact: true }),
  );
  await page.getByLabel("ชื่อทริป", { exact: true }).fill("วันหยุดกับเพื่อน");
  assert.equal(await page.getByLabel("หาวันตั้งแต่").isVisible(), false);
  await click(
    "organizer",
    page.getByRole("button", { name: "สร้างห้องทริป", exact: true }),
  );
  await page
    .getByRole("heading", { name: "ห้องพร้อมแล้ว ชวนเพื่อนกัน" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "ยืนยันแผนทริป", exact: true })
      .count(),
    0,
  );
  await page.screenshot({ path: "docs/mockup/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({ path: "docs/mockup/mobile.png", fullPage: true });
  const invite = await page
    .getByLabel("ลิงก์ชวนเพื่อน", { exact: true })
    .inputValue();
  await click(
    "organizer",
    page.getByRole("button", { name: "คัดลอกคำเชิญ", exact: true }),
  );
  await page
    .getByRole("heading", { name: "เลือกวันที่คุณว่าง", exact: true })
    .waitFor();
  await click("organizer", page.getByRole("button", { name: /14 พ.ย. 2569/ }));
  await noOverflow();
  await page.screenshot({
    path: "docs/mockup/calendar-mobile.png",
    fullPage: true,
  });
  await click(
    "organizer",
    page.getByRole("button", { name: "เลือกที่เที่ยว", exact: true }),
  );
  await page.getByLabel("สถานที่", { exact: true }).fill("ทะเล");
  await click(
    "organizer",
    page.getByRole("button", { name: "เพิ่มข้อเสนอ", exact: true }),
  );
  await click(
    "organizer",
    page.getByRole("button", { name: "เลือก", exact: true }),
  );
  await switchUser("non");
  await click(
    "member",
    page.getByRole("button", { name: "ใช้ลิงก์เชิญ", exact: true }),
  );
  await page.getByLabel("ลิงก์หรือรหัสเชิญ").fill(invite);
  await click(
    "member",
    page.getByRole("button", { name: "เข้าร่วมทริป", exact: true }),
  );
  // This account already supplied availability in Profile, so it is reused.
  if (freshMember) {
    await click(
      "member",
      page.getByRole("button", { name: "เลือกวันว่าง", exact: true }),
    );
    await click("member", page.getByRole("button", { name: /14 พ.ย. 2569/ }));
    await click(
      "member",
      page.getByRole("button", { name: "เลือกที่เที่ยว", exact: true }),
    );
  } else {
    await click(
      "member",
      page.getByRole("button", { name: "เลือกที่เที่ยว", exact: true }),
    );
  }
  await click(
    "member",
    page.getByRole("button", { name: "เลือก", exact: true }),
  );
  assert.equal(
    await page.getByRole("button", { name: "สรุปทริป", exact: true }).count(),
    0,
  );
  await switchUser("pim");
  await click(
    "organizer",
    page.getByRole("button", { name: "สรุปทริป", exact: true }),
  );
  await click(
    "organizer",
    page
      .getByRole("alertdialog")
      .getByRole("button", { name: "ยืนยัน", exact: true }),
  );
  await click(
    "organizer",
    page.getByRole("button", { name: "ยืนยันแผนทริป", exact: true }),
  );
  assert.equal(
    await page.getByRole("alertdialog").count(),
    0,
    "first confirmation has no redundant dialog",
  );
  await switchUser("non");
  await click(
    "member",
    page.getByRole("button", { name: "ตอบรับและเพิ่มลงปฏิทิน" }),
  );
  await page.getByRole("button", { name: "ปฏิทิน & Profile" }).click();
  await page.getByText("14 พ.ย. 2569 · แผนรุ่น 1", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "ปฏิทิน & Profile" }).click();
  await page.getByText("14 พ.ย. 2569 · แผนรุ่น 1", { exact: true }).waitFor();
  // Review the voting surface at both sizes, including meaningful image fallback.
  const tools = page.locator(".demo-test-tools");
  await tools.locator("summary").first().click();
  await page.getByLabel("สถานการณ์", { exact: true }).selectOption("tie");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "ยืนยัน", exact: true })
    .click();
  await tools.locator("summary").first().click();
  await page.screenshot({
    path: "docs/mockup/voting-mobile.png",
    fullPage: true,
  });
  await noOverflow();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "docs/mockup/voting-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "ที่เที่ยว", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("tab", { name: "แชท", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page
    .getByRole("textbox", { name: "ข้อความ", exact: true })
    .fill("พร้อมไปเที่ยวแล้ว");
  await page.getByRole("button", { name: "ส่งข้อความ", exact: true }).click();
  await page.getByText("พร้อมไปเที่ยวแล้ว", { exact: true }).waitFor();
  await page.getByRole("button", { name: "ปฏิทิน & Profile" }).click();
  const monthTrigger = page.getByRole("button", { name: /^เดือนปฏิทิน / });
  await page.getByRole("button", { name: "เดือนถัดไป", exact: true }).click();
  await page.getByRole("button", { name: "เดือนถัดไป", exact: true }).click();
  await page
    .getByRole("button", { name: "เดือนปฏิทิน มกราคม 2570", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "เดือนก่อนหน้า", exact: true })
    .click();
  await monthTrigger.click();
  const monthDialog = page.getByRole("dialog", {
    name: "เลือกเดือนปฏิทิน",
    exact: true,
  });
  await page
    .getByRole("button", { name: "ธันวาคม 2569", exact: true })
    .waitFor();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "เดือนปฏิทิน เมษายน 2569", exact: true })
    .waitFor();
  assert.equal(await monthDialog.count(), 0);
  await monthTrigger.click();
  await page.keyboard.press("Escape");
  assert.equal(await monthDialog.count(), 0);
  assert.equal(
    await monthTrigger.evaluate(
      (element) => element === document.activeElement,
    ),
    true,
  );
  await monthTrigger.click();
  await page.getByRole("button", { name: "ปีถัดไป", exact: true }).click();
  await page
    .getByRole("button", { name: "กุมภาพันธ์ 2570", exact: true })
    .click();
  await page.getByRole("button", { name: /28 ก.พ. 2570/ }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: /29 ก.พ. 2570/ }).count(),
    0,
  );
  await monthTrigger.click();
  await page
    .getByRole("heading", { name: "ปฏิทินของฉัน", exact: true })
    .click();
  assert.equal(await monthDialog.count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await monthTrigger.click();
  await page.setViewportSize({ width: 320, height: 844 });
  await noOverflow();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.waitForFunction(
    (element) =>
      element
        .getAnimations()
        .every((animation) => animation.playState === "finished"),
    await monthDialog.elementHandle(),
  );
  await page.screenshot({
    path: "docs/mockup/month-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "ทริปของฉัน", exact: true }).click();
  await page
    .getByRole("button", { name: "สร้างทริปใหม่", exact: true })
    .click();
  const nameInput = page.getByLabel("ชื่อทริป", { exact: true });
  await page
    .getByRole("button", { name: "สร้างห้องทริป", exact: true })
    .click();
  assert.equal(
    await nameInput.evaluate((element) => element.validity.valueMissing),
    true,
  );
  await nameInput.fill("วันหยุดกับเพื่อน");
  await nameInput.focus();
  await page.waitForFunction(
    (element) => getComputedStyle(element).borderColor === "rgb(36, 91, 219)",
    await nameInput.elementHandle(),
  );
  assert.equal(
    await nameInput.evaluate(
      (element) => getComputedStyle(element).borderColor,
    ),
    "rgb(36, 91, 219)",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "docs/mockup/fields-desktop.png",
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow();
  }
  assert.equal(
    await page
      .locator("img")
      .evaluateAll((images) =>
        images.every((image) => image.complete && image.naturalWidth > 0),
      ),
    true,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(
    externalRequests,
    [],
    "prototype images and fonts must be self-hosted",
  );
  assert.equal(counts.organizer, 10);
  assert.equal(counts.member, freshMember ? 7 : 5);
  const report = {
    date: "2026-10-20",
    type: "automated simulated user flow; not a human usability study",
    taskClicks: counts,
    excludes: [
      "Google demo sign-in",
      "typing",
      "switching demo accounts",
      "verification navigation",
    ],
    memberAvailability: freshMember
      ? "entered availability during this trip"
      : "reused existing Profile availability",
    checks: [
      "create -> invite -> availability -> propose -> vote -> confirm -> RSVP",
      "role permissions",
      "persistence",
      "mobile overflow",
      "images",
      "local fonts",
      "keyboard tabs",
      "chat",
      "Thai month/year picker, year boundary, month length, keyboard, Escape, outside click",
      "text input focus and required validation",
      "no external requests",
    ],
  };
  await writeFile(
    freshMember
      ? "docs/mockup/ux-check-fresh.json"
      : "docs/mockup/ux-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
