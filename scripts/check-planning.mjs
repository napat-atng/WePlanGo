import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createServerClient } from "@supabase/ssr";

process.loadEnvFile(".env.local");
const fixture = JSON.parse(
  await readFile(
    process.env.WORKSPACE_FIXTURE ??
      join(tmpdir(), "weplango-real-e2e.json"),
    "utf8",
  ),
);
const { chromium } = await import(
  process.env.MOCKUP_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.MOCKUP_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const origin = process.env.WORKSPACE_URL ?? "http://localhost:3000";
async function account(user) {
  let jar = [];
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => jar,
        setAll: (values) => {
          for (const value of values) {
            jar = jar.filter((c) => c.name !== value.name);
            jar.push(value);
          }
        },
      },
    },
  );
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: fixture.password,
  });
  if (error) throw error;
  return { client, jar };
}
function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
const owner = await account(fixture.users[0]),
  member = await account(fixture.users[1]);
let room;
try {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(new Date());
  const next = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const nextMonth = next.toISOString().slice(0, 7),
    day = `${nextMonth}-01`;
  const command = async (client, action, data) =>
    checked(
      await client.rpc("room_command", {
        p_action: action,
        p: { room, ...data },
      }),
    );
  room = (
    await command(owner.client, "create", {
      title: "ตรวจคะแนนเสมอ",
      start: today,
      end: `${nextMonth}-28`,
      deadline: new Date(Date.now() + 86400000).toISOString(),
    })
  ).id;
  const { token } = await command(owner.client, "invite", {});
  await command(member.client, "join", { token });
  const first = (await command(owner.client, "propose", { name: "ภูเขา" })).id;
  const second = (await command(member.client, "propose", { name: "ทะเล" })).id;
  await command(owner.client, "propose", { name: "ตัวเลือกไม่มีคะแนน" });
  await command(owner.client, "vote", { place: first, selected: true });
  await command(member.client, "vote", { place: second, selected: true });
  await command(owner.client, "availability", { day, answer: "free" });
  await command(member.client, "availability", { day, answer: "busy" });
  await command(owner.client, "close", {});
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Bangkok",
  });
  await context.addCookies(
    owner.jar
      .filter((c) => c.value)
      .map((c) => ({
        name: c.name,
        value: c.value,
        url: origin,
        sameSite: "Lax",
      })),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/trips/${room}`);
  await page
    .getByText("คะแนนเสมอ หัวห้องเลือกจากตัวเลือกที่นำเท่ากันได้", {
      exact: true,
    })
    .waitFor();
  const select = page.getByLabel("สถานที่ที่ชนะ / เสมอ", { exact: true });
  assert.deepEqual(
    await select.locator("option:not([disabled])").allTextContents(),
    ["ภูเขา", "ทะเล"],
  );
  await select.selectOption(second);
  await page.getByLabel("วันเดินทาง", { exact: true }).fill(day);
  await page
    .getByText("ว่าง 1 · ไม่ว่าง 1 · ยังไม่ตอบ 0 คน", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "docs/production/tie-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "docs/production/tie-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "ยืนยันแผนทริป", exact: true })
    .click();
  await page.getByRole("heading", { name: "แผนของเรา", exact: true }).waitFor();
  const saved = checked(
    await owner.client
      .from("trip_rooms")
      .select("selected_date,selected_place_id,plan_version")
      .eq("id", room)
      .single(),
  );
  assert.deepEqual(saved, {
    selected_date: day,
    selected_place_id: second,
    plan_version: 1,
  });
  assert.deepEqual(errors, []);
  const report = {
    date: new Date().toISOString(),
    target: "real Supabase temporary accounts",
    origin,
    checks: [
      "tie excludes lower-scoring choices",
      "organizer chooses either tied leader",
      "cross-month availability counts",
      "mobile overflow",
      "selected date and place persisted",
    ],
    googleCalendar: "not exercised",
  };
  await writeFile(
    "docs/production/planning-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (room)
    checked(
      await owner.client.rpc("room_command", {
        p_action: "delete",
        p: { room },
      }),
    );
  await owner.client.auth.signOut({ scope: "global" });
  await member.client.auth.signOut({ scope: "global" });
  await browser.close();
}
