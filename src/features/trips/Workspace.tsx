"use client";

import { ThaiDateInput } from "@/components/ui/ThaiDateInput";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { MonthPicker } from "@/components/ui/MonthPicker";
import {
  disconnectCalendar,
  synchronizeCalendar,
} from "@/features/calendar/actions";
import {
  refreshWorkspace,
  uploadProfilePhoto,
  workspaceCommand,
} from "./workspace-actions";
import { leaders, todayBangkok } from "./workspace-validation";
import { parseZonedInput, zonedInputValue } from "./time";
import type {
  Profile,
  WorkspaceMode,
  WorkspaceResult,
  WorkspaceState,
} from "./workspace-types";

const tabs = ["ทริป", "วันว่าง", "ที่เที่ยว", "แชท", "สมาชิก"];
const icons: IconName[] = ["home", "calendar", "pin", "chat", "users"];
const dateText = (date: string) =>
  new Date(`${date}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
function Avatar({ profile }: { profile: Profile }) {
  return profile.avatar_url ? (
    <Image
      unoptimized
      className="demo-avatar"
      src={profile.avatar_url}
      alt={profile.display_name}
      width={42}
      height={42}
    />
  ) : (
    <span className="demo-avatar">{profile.display_name.slice(0, 1)}</span>
  );
}
export default function Workspace({
  initial,
  mode,
  token,
  initialNotice = "",
}: {
  initial: WorkspaceState;
  mode: WorkspaceMode;
  token?: string;
  initialNotice?: string;
}) {
  const router = useRouter(),
    [data, setData] = useState(initial),
    [month, setMonth] = useState(initial.month),
    [tab, setTab] = useState(0),
    [paint, setPaint] = useState("free"),
    [notice, setNotice] = useState(initialNotice);
  const [busy, setBusy] = useState(false),
    working = useRef(false),
    sequence = useRef(0);
  const [now, setNow] = useState(Date.now),
    [invite, setInvite] = useState(""),
    [inviteInput, setInviteInput] = useState(token ?? ""),
    [previews, setPreviews] = useState<
      { id: string; title: string; valid: boolean }[]
    >([]);
  const [selectedDate, setSelectedDate] = useState(
      initial.current?.room.selected_date ??
        initial.current?.room.starts_on ??
        todayBangkok(),
    ),
    [selectedPlace, setSelectedPlace] = useState("");
  const [confirm, setConfirm] = useState<{
    text: string;
    run: () => void;
  } | null>(null);
  const current = data.current,
    room = current?.room,
    roomId = room?.id,
    me = data.me,
    owner = room?.organizer_id === me.user_id;
  const closed =
    !!room &&
    (room.status !== "planning" ||
      new Date(room.vote_deadline).getTime() <= now);
  const winners = current ? leaders(current.places, current.votes) : [];
  const selectedDayAnswers = data.days.filter(
    (day) => day.day === selectedDate,
  );
  const selectedFree = selectedDayAnswers.filter(
    (day) => day.answer === "free",
  ).length;
  const selectedBusy = selectedDayAnswers.filter(
    (day) => day.answer === "busy",
  ).length;
  const selectedUnknown = Math.max(
    0,
    (current?.members.length ?? 0) - selectedFree - selectedBusy,
  );
  const selectedMonthLoaded = data.month === selectedDate.slice(0, 7);
  const answered =
    !!current &&
    data.days.some(
      (d) =>
        d.user_id === me.user_id &&
        d.answer &&
        d.day >= current.room.starts_on &&
        d.day <= current.room.ends_on,
    );
  const voted = !!current?.votes.some((v) => v.user_id === me.user_id);
  const ownRsvp = current?.rsvps.find(
    (r) => r.user_id === me.user_id && r.plan_version === room?.plan_version,
  );
  const profile = (id: string | null) =>
    current?.members.find((p) => p.user_id === id);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const next = await refreshWorkspace(roomId, month);
      if (sequence.current === request) setData(next);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("ไม่ได้เป็นสมาชิก") ||
          error.message.includes("ไม่พบห้อง"))
      )
        router.replace("/trips");
      else throw error;
    }
  }, [roomId, month, router]);
  useEffect(() => {
    let live = true;
    const firstLoad = setTimeout(
      () =>
        refresh().catch(() => {
          if (live) setNotice("โหลดข้อมูลไม่ได้ กรุณาลองรีเฟรชหน้า");
        }),
      0,
    );
    const timer = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible")
        refresh().catch(() => undefined);
    }, 10000);
    return () => {
      live = false;
      clearTimeout(firstLoad);
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!data.calendar.connected) return;
    let live = true;
    const sync = () => {
      if (document.visibilityState === "visible")
        synchronizeCalendar()
          .then(() => {
            if (live) return refresh();
          })
          .catch(() => undefined);
    };
    sync();
    const timer = setInterval(sync, 60000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [data.calendar.connected, refresh]);
  useEffect(() => {
    if (!confirm) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirm(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [confirm]);
  useEffect(() => {
    if (mode !== "invite" || !token) return;
    let live = true;
    workspaceCommand("preview", { token })
      .then((result) => {
        if (live) {
          if (result.ok) setPreviews(result.data as typeof previews);
          else setNotice(result.error);
        }
      })
      .catch(() => {
        if (live) setNotice("ตรวจคำเชิญไม่สำเร็จ");
      });
    return () => {
      live = false;
    };
  }, [mode, token]);
  async function run(
    action: string,
    p: Record<string, unknown> = {},
    success?: string,
  ): Promise<WorkspaceResult> {
    if (working.current) return { ok: false, error: "กำลังบันทึก" };
    working.current = true;
    setBusy(true);
    try {
      const result = await workspaceCommand(action, {
        ...(roomId ? { room: roomId } : {}),
        ...p,
      });
      if (!result.ok) {
        setNotice(result.error);
        return result;
      }
      if (action === "delete") {
        router.push("/trips");
        return result;
      }
      if (action === "create" || action === "join") {
        router.push(`/trips/${(result.data as { id: string }).id}`);
        return result;
      }
      if (success) setNotice(success);
      await refresh();
      return result;
    } catch {
      setNotice("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
      return { ok: false, error: "เชื่อมต่อไม่สำเร็จ" };
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function share() {
    const result = await run("invite");
    if (!result.ok) return;
    const url = `${location.origin}/invite/${(result.data as { token: string }).token}`;
    setInvite(url);
    try {
      await navigator.clipboard.writeText(url);
      setNotice("คัดลอกคำเชิญแล้ว ส่งให้เพื่อนได้เลย");
      setTab(1);
    } catch {
      setNotice("เลือกคัดลอกลิงก์ด้านล่างเพื่อส่งให้เพื่อน");
    }
  }
  async function previewInvite(e: React.FormEvent) {
    e.preventDefault();
    let value = inviteInput.trim();
    try {
      value = new URL(value).pathname.split("/invite/")[1] ?? value;
    } catch {}
    const result = await run("preview", { token: value });
    if (result.ok) {
      setInviteInput(value);
      setPreviews(result.data as typeof previews);
    }
  }
  function finishVoting() {
    setConfirm({
      text: `ปิดโหวตและสรุปทริป? มีผู้โหวตแล้ว ${new Set(current?.votes.map((v) => v.user_id)).size}/${current?.members.length} คน เพื่อนจะเปลี่ยนคะแนนไม่ได้`,
      run: () => {
        void run("close", {}, "ปิดโหวตแล้ว").then((result) => {
          if (result.ok) setTab(0);
        });
      },
    });
  }
  function calendar(shared: boolean) {
    const [year, mon] = month.split("-").map(Number),
      offset = (new Date(year, mon - 1, 1).getDay() + 6) % 7,
      total = new Date(year, mon, 0).getDate();
    return (
      <section className="demo-calendar">
        <div className="demo-section-head">
          <div>
            <h2>{shared ? "เลือกวันที่คุณว่าง" : "ปฏิทินของฉัน"}</h2>
            <p>
              {shared ? "เลือกได้หลายวัน" : "วันว่างเดียวกัน ใช้กับทุกทริป"}
            </p>
          </div>
          <MonthPicker value={month} onChange={setMonth} />
        </div>
        <fieldset className="demo-availability-mode">
          <legend className="demo-sr">แตะวันที่เพื่อระบุ</legend>
          {[
            { value: "free", text: "ว่าง", icon: "check" },
            { value: "busy", text: "ไม่ว่าง", icon: "close" },
            { value: "unset", text: "ยังไม่ตอบ", icon: "clock" },
          ].map((p) => (
            <button
              type="button"
              key={p.value}
              aria-pressed={paint === p.value}
              onClick={() => setPaint(p.value)}
            >
              <Icon name={p.icon as IconName} size={16} />
              {p.text}
            </button>
          ))}
        </fieldset>
        {shared && (
          <p className="demo-calendar-hint">
            <Icon name="users" size={15} />
            คนว่าง / สมาชิก
          </p>
        )}
        <div className="demo-calendar-grid">
          {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((d) => (
            <strong className="demo-weekday" key={d}>
              {d}
            </strong>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`blank${i}`} />
          ))}
          {Array.from({ length: total }, (_, i) => {
            const day = `${month}-${String(i + 1).padStart(2, "0")}`,
              own = data.days.find(
                (d) => d.day === day && d.user_id === me.user_id,
              ),
              free = data.days.filter(
                (d) => d.day === day && d.answer === "free",
              ).length,
              outside =
                shared && room && (day < room.starts_on || day > room.ends_on);
            return (
              <button
                key={day}
                type="button"
                className="demo-day"
                disabled={busy || !!outside}
                data-status={own?.answer ?? undefined}
                aria-label={`${dateText(day)} ${own?.answer === "free" ? "ว่าง" : own?.answer === "busy" ? "ไม่ว่าง" : "ยังไม่ตอบ"}`}
                onClick={() => {
                  setSelectedDate(day);
                  void run("availability", {
                    day,
                    answer: paint,
                    ...(shared ? { room: roomId } : {}),
                  });
                }}
              >
                <b>{i + 1}</b>
                <span>
                  {own?.answer ? (
                    <Icon
                      name={own.answer === "free" ? "check" : "close"}
                      size={14}
                    />
                  ) : (
                    "·"
                  )}
                </span>
                {shared && (
                  <small>
                    {free}/{current?.members.length}
                  </small>
                )}
              </button>
            );
          })}
        </div>
        {shared && (
          <details className="demo-responses">
            <summary>ดูว่าใครว่างบ้าง</summary>
            <label>
              วันที่
              <ThaiDateInput
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  if (e.target.value) setMonth(e.target.value.slice(0, 7));
                }}
              />
            </label>
            {current?.members.map((p) => (
              <div className="demo-row" key={p.user_id}>
                <span>{p.display_name}</span>
                <span>
                  {data.days.find(
                    (d) => d.user_id === p.user_id && d.day === selectedDate,
                  )?.answer === "free"
                    ? "ว่าง"
                    : data.days.find(
                          (d) =>
                            d.user_id === p.user_id && d.day === selectedDate,
                        )?.answer === "busy"
                      ? "ไม่ว่าง"
                      : "ยังไม่ตอบ"}
                </span>
              </div>
            ))}
          </details>
        )}
      </section>
    );
  }
  const stage =
    room?.status === "confirmed"
      ? 4
      : closed
        ? 3
        : tab === 1
          ? 1
          : tab === 2
            ? 2
            : owner && current?.members.length === 1 && !invite
              ? 0
              : !answered
                ? 1
                : !voted
                  ? 2
                  : 3;
  return (
    <div className="demo-app workspace-live">
      <header className="demo-header">
        <Link className="demo-brand" href="/trips">
          <span className="demo-brand-mark">
            <Icon name="mountain" size={24} />
          </span>
          WePlanGo
        </Link>
        <nav aria-label="เมนูหลัก">
          <Link
            href="/trips"
            aria-current={mode === "home" ? "page" : undefined}
          >
            <Icon name="home" />
            ทริปของฉัน
          </Link>
          <Link
            href="/profile"
            aria-current={mode === "profile" ? "page" : undefined}
          >
            <Icon name="calendar" />
            ปฏิทิน & Profile
          </Link>
        </nav>
      </header>
      {notice && (
        <div className="demo-notice" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="ปิดข้อความแจ้งผล">
            ปิด
          </button>
        </div>
      )}
      <main className="demo-main">
        {mode === "home" && (
          <>
            <div className="demo-page-heading">
              <div>
                <h1>ไปเที่ยวด้วยกัน</h1>
                <p>สวัสดี {me.display_name} ทริปไหนต่อดี?</p>
              </div>
              <div className="demo-actions">
                <Link className="workspace-button" href="/join">
                  <Icon name="users" />
                  เข้าร่วม
                </Link>
                <Link
                  className="workspace-button demo-primary"
                  href="/trips/new"
                >
                  <Icon name="plus" />
                  สร้างทริปใหม่
                </Link>
              </div>
            </div>
            <div className="demo-home-grid">
              <section>
                <h2>ทริปของฉัน</h2>
                {!data.rooms.length && (
                  <div className="demo-panel">
                    <h3>ชวนเพื่อนออกไปเที่ยวกัน</h3>
                    <p>สร้างทริปแรก หรือใช้คำเชิญจากเพื่อน</p>
                    <Link
                      href="/trips/new"
                      className="workspace-button demo-primary"
                    >
                      สร้างทริปใหม่
                    </Link>
                  </div>
                )}
                {data.rooms.map((r) => (
                  <Link
                    href={`/trips/${r.id}`}
                    className="demo-trip-card"
                    key={r.id}
                  >
                    <div className="demo-trip-art">
                      <Image
                        unoptimized
                        fill
                        sizes="(max-width:600px) 100vw, 720px"
                        src="/mockup/chiang-mai.jpg"
                        alt="ภาพบรรยากาศประกอบทริป"
                      />
                      <span className="demo-tag">
                        {r.status === "confirmed"
                          ? "ยืนยันแผนแล้ว"
                          : r.status === "planning"
                            ? "กำลังวางแผน"
                            : r.status === "closed"
                              ? "รอสรุปแผน"
                              : r.status === "completed"
                                ? "จบทริปแล้ว"
                                : "ยกเลิก"}
                      </span>
                    </div>
                    <div className="demo-trip-copy">
                      <h3>{r.title}</h3>
                      <p>{r.description}</p>
                      <div className="demo-row">
                        <span>
                          {r.organizer_id === me.user_id
                            ? "คุณเป็นหัวห้อง"
                            : "สมาชิก"}
                        </span>
                        <b>
                          เปิดทริป
                          <Icon name="arrow" size={18} />
                        </b>
                      </div>
                    </div>
                  </Link>
                ))}
              </section>
              <aside className="demo-home-aside">
                <h2>เวลาของคุณ</h2>
                <p>กำหนดวันว่างไว้ก่อน เพื่อนจะหาวันที่ตรงกันได้ง่ายขึ้น</p>
                <Link href="/profile" className="workspace-button">
                  <Icon name="calendar" />
                  วันว่างของฉัน
                </Link>
                <hr />
                <h3>นัดหมายที่ตอบรับ</h3>
                {!data.appointments.length && <p>ยังไม่มีนัดหมาย</p>}
                {data.appointments.map((a) => (
                  <p key={a.room_id}>
                    <Link href={`/trips/${a.room_id}`}>{a.title}</Link>
                    <br />
                    {dateText(a.date)}
                  </p>
                ))}
              </aside>
            </div>
          </>
        )}
        {mode === "create" && (
          <section className="demo-panel demo-narrow">
            <h1>เริ่มทริปใหม่</h1>
            <p>ตั้งชื่อก่อน แล้วค่อยชวนเพื่อน</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  deadline = parseZonedInput(
                    String(f.get("deadline")),
                    "Asia/Bangkok",
                  );
                if (!deadline || deadline.getTime() <= now) {
                  setNotice("กำหนดปิดโหวตต้องอยู่ในอนาคต");
                  return;
                }
                void run("create", {
                  title: String(f.get("name")).trim(),
                  description: String(f.get("description")),
                  start: f.get("start"),
                  end: f.get("end"),
                  deadline: deadline.toISOString(),
                });
              }}
            >
              <label>
                ชื่อทริป
                <input
                  name="name"
                  required
                  maxLength={160}
                  placeholder="เช่น วันหยุดกับเพื่อน"
                />
              </label>
              <div className="demo-create-fields">
                <label>
                  รายละเอียด
                  <textarea name="description" maxLength={1000} />
                </label>
                <div className="demo-two">
                  <label>
                    หาวันตั้งแต่
                    <ThaiDateInput
                      name="start"
                      type="date"
                      min={todayBangkok()}
                      defaultValue={todayBangkok()}
                      required
                    />
                  </label>
                  <label>
                    ถึงวันที่
                    <ThaiDateInput
                      name="end"
                      type="date"
                      defaultValue={new Date(
                        new Date(`${todayBangkok()}T12:00:00Z`).getTime() +
                          90 * 86400000,
                      )
                        .toISOString()
                        .slice(0, 10)}
                      required
                    />
                  </label>
                </div>
                <label>
                  ปิดโหวต (เวลาไทย)
                  <ThaiDateInput
                    type="datetime-local"
                    name="deadline"
                    defaultValue={zonedInputValue(
                      new Date(now + 7 * 86400000).toISOString(),
                      "Asia/Bangkok",
                    )}
                    required
                  />
                </label>
              </div>
              <div className="demo-actions">
                <Link href="/trips" className="workspace-button">
                  ยกเลิก
                </Link>
                <button disabled={busy} className="demo-primary">
                  {busy ? "กำลังสร้าง…" : "สร้างห้องทริป"}
                </button>
              </div>
            </form>
          </section>
        )}
        {mode === "invite" && (
          <section className="demo-panel demo-narrow">
            <h1>เพื่อนชวนไปเที่ยว</h1>
            {!token && (
              <form onSubmit={previewInvite}>
                <label>
                  ลิงก์หรือรหัสเชิญ
                  <input
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    required
                  />
                </label>
                <button disabled={busy} className="demo-primary">
                  ตรวจคำเชิญ
                </button>
              </form>
            )}
            {previews.length > 0 ? (
              previews.map((p) => (
                <div className="demo-row" key={p.id}>
                  <div>
                    <h3>{p.title}</h3>
                    {!p.valid && <p>คำเชิญหมดอายุ ถูกยกเลิก หรือบัญชีถูกแบน</p>}
                  </div>
                  <button
                    disabled={busy || !p.valid}
                    className="demo-primary"
                    onClick={() =>
                      void run("join", {
                        room: p.id,
                        token: token ?? inviteInput,
                      })
                    }
                  >
                    เข้าร่วมทริป
                  </button>
                </div>
              ))
            ) : (
              <p>
                {token
                  ? "ไม่พบคำเชิญที่ใช้งานได้ ตรวจลิงก์กับหัวห้องอีกครั้ง"
                  : "วางลิงก์จากหัวห้องเพื่อเข้าร่วม"}
              </p>
            )}
          </section>
        )}
        {mode === "profile" && (
          <>
            <div className="demo-page-heading">
              <div>
                <h1>พื้นที่ของ {me.display_name}</h1>
                <p>ข้อมูลส่วนตัวและวันว่างของคุณ</p>
              </div>
              <Avatar profile={me} />
            </div>
            <div className="demo-profile-grid">
              <div className="demo-panel">{calendar(false)}</div>
              <aside className="demo-panel">
                <h2>Profile</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      "profile",
                      {
                        name: String(
                          new FormData(e.currentTarget).get("name"),
                        ).trim(),
                      },
                      "บันทึกชื่อแล้ว",
                    );
                  }}
                >
                  <label>
                    ชื่อที่แสดง
                    <input
                      name="name"
                      key={me.display_name}
                      defaultValue={me.display_name}
                      required
                      maxLength={120}
                    />
                  </label>
                  <button disabled={busy}>บันทึกชื่อ</button>
                </form>
                <label>
                  เปลี่ยนรูป Profile
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBusy(true);
                      try {
                        const f = new FormData();
                        f.set("photo", file);
                        const result = await uploadProfilePhoto(f);
                        setNotice(result.ok ? "บันทึกรูปแล้ว" : result.error);
                        if (result.ok) await refresh();
                      } catch {
                        setNotice("อัปโหลดไม่สำเร็จ");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                <hr />
                <h3>Google Calendar</h3>
                <p>
                  {data.calendar.connected
                    ? data.calendar.error
                      ? "เชื่อมต่อแล้ว · ซิงก์ไม่สำเร็จ"
                      : data.calendar.pending
                        ? "มีนัดรอซิงก์"
                        : "เชื่อมต่อแล้ว"
                    : "ยังไม่ได้เชื่อมต่อ"}
                </p>
                <div className="demo-actions workspace-calendar-actions">
                  {data.calendar.connected ? (
                    <>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const result = await synchronizeCalendar();
                            setNotice(
                              result.ok
                                ? "ซิงก์ Calendar แล้ว"
                                : (result.error ?? "ซิงก์ไม่สำเร็จ"),
                            );
                            await refresh();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        ซิงก์ตอนนี้
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          setConfirm({
                            text: "ถอนนัดที่แอปสร้างใน Google แล้วเลิกเชื่อมต่อ? นัดใน Profile ยังอยู่",
                            run: () => {
                              setBusy(true);
                              disconnectCalendar()
                                .then(async (result) => {
                                  setNotice(
                                    result.ok
                                      ? "ยกเลิกการเชื่อมต่อแล้ว"
                                      : (result.error ?? "ยกเลิกไม่สำเร็จ"),
                                  );
                                  await refresh();
                                })
                                .catch(() => setNotice("ยกเลิกไม่สำเร็จ"))
                                .finally(() => setBusy(false));
                            },
                          })
                        }
                      >
                        ยกเลิกการเชื่อมต่อ
                      </button>
                    </>
                  ) : data.calendar.configured ? (
                    <a href="/api/calendar/connect" className="workspace-button">
                      เชื่อมต่อ Google
                    </a>
                  ) : (
                    <p className="demo-note">
                      กำลังเตรียมการเชื่อม Google Calendar
                      คุณยังระบุวันว่างและใช้นัดใน Profile ได้
                    </p>
                  )}
                </div>
                {data.calendar.error && (
                  <p role="alert" className="demo-note">
                    {data.calendar.error}
                  </p>
                )}
                <p className="demo-note">
                  นำเข้าเฉพาะช่วงติดธุระ เพื่อนไม่เห็นรายละเอียดกิจกรรมส่วนตัว
                </p>
                <h3>นัดจากทริป</h3>
                {data.appointments.length ? (
                  data.appointments.map((a) => (
                    <div className="demo-appointment" key={a.room_id}>
                      <Link href={`/trips/${a.room_id}`}>
                        <b>{a.title}</b>
                      </Link>
                      <p>
                        {dateText(a.date)} · แผนรุ่น {a.version}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>ตอบรับแผนทริปเพื่อเพิ่มนัดที่นี่</p>
                )}
              </aside>
            </div>
          </>
        )}
        {mode === "room" && current && room && (
          <>
            <Link className="demo-back" href="/trips">
              ← ทริปของฉัน
            </Link>
            <div className="demo-room-hero" data-compact={tab !== 0}>
              <div className="demo-page-heading demo-room-heading">
                <div>
                  <h1>{room.title}</h1>
                  {room.description && <p>{room.description}</p>}
                  <div className="demo-meta">
                    <span className="demo-tag">
                      {room.status === "confirmed"
                        ? "ยืนยันแผนแล้ว"
                        : closed
                          ? "รอสรุปแผน"
                          : "กำลังวางแผน"}
                    </span>
                    <details className="demo-room-info">
                      <summary>รายละเอียดทริป</summary>
                      <p>
                        หัวห้อง: {profile(room.organizer_id)?.display_name}
                        <br />
                        ปิดโหวต{" "}
                        {new Date(room.vote_deadline).toLocaleString("th-TH", {
                          timeZone: room.timezone,
                        })}
                      </p>
                    </details>
                  </div>
                </div>
                <button onClick={() => setTab(4)}>
                  <Icon name="users" />
                  {current.members.length} คน
                </button>
              </div>
              <div className="demo-room-image">
                <Image
                  unoptimized
                  fill
                  sizes="(max-width:600px) 100vw, 450px"
                  src="/mockup/chiang-mai.jpg"
                  alt="ภาพบรรยากาศประกอบทริป"
                />
              </div>
            </div>
            <p className="workspace-progress">
              ขั้นตอน {stage + 1}/5 ·{" "}
              {
                [
                  "ชวนเพื่อน",
                  "เลือกวัน",
                  "เลือกที่เที่ยว",
                  "สรุปแผน",
                  "ตอบรับ",
                ][stage]
              }
            </p>
            <div
              className="demo-tabs"
              role="tablist"
              aria-label="ส่วนต่าง ๆ ของทริป"
              onKeyDown={(e) => {
                const next =
                  e.key === "ArrowRight"
                    ? (tab + 1) % 5
                    : e.key === "ArrowLeft"
                      ? (tab + 4) % 5
                      : e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? 4
                          : null;
                if (next === null) return;
                e.preventDefault();
                setTab(next);
                e.currentTarget
                  .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [next].focus();
              }}
            >
              {tabs.map((t, i) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === i}
                  tabIndex={tab === i ? 0 : -1}
                  aria-controls={
                    tab === 3 ? "workspace-chat" : "workspace-panel"
                  }
                  onClick={() => setTab(i)}
                >
                  <Icon name={icons[i]} />
                  {t}
                </button>
              ))}
            </div>
            <div className="demo-focused-workspace">
              <section
                key={tab}
                className="demo-panel"
                id="workspace-panel"
                hidden={tab === 3}
                role="tabpanel"
                aria-label={tabs[tab]}
              >
                {tab === 0 && (
                  <>
                    {room.status === "confirmed" ? (
                      <>
                        <h2>แผนของเรา</h2>
                        <div className="demo-plan">
                          <h3>
                            {
                              current.places.find(
                                (p) => p.id === room.selected_place_id,
                              )?.name
                            }
                          </h3>
                          <p>
                            {dateText(room.selected_date!)} · แผนรุ่น{" "}
                            {room.plan_version}
                          </p>
                          <p>
                            ตอบรับ{" "}
                            {
                              current.rsvps.filter(
                                (r) =>
                                  r.plan_version === room.plan_version &&
                                  r.response === "going",
                              ).length
                            }
                            /{current.members.length} คน
                          </p>
                          <button
                            className="demo-primary"
                            disabled={busy || ownRsvp?.response === "going"}
                            onClick={() =>
                              void run(
                                "rsvp",
                                {
                                  version: room.plan_version,
                                  response: "going",
                                },
                                "ตอบรับและเพิ่มนัดใน Profile แล้ว",
                              )
                            }
                          >
                            {ownRsvp?.response === "going"
                              ? "คุณตอบรับแล้ว"
                              : "ตอบรับและเพิ่มลงปฏิทิน"}
                          </button>
                          {ownRsvp?.response === "going" && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  text: "ยกเลิกการตอบรับและถอนนัดจากปฏิทิน?",
                                  run: () => {
                                    void run(
                                      "rsvp",
                                      {
                                        version: room.plan_version,
                                        response: "not_going",
                                      },
                                      "ถอนนัดแล้ว",
                                    );
                                  },
                                })
                              }
                            >
                              ยกเลิกการตอบรับ
                            </button>
                          )}
                          {data.days.some(
                            (d) =>
                              d.user_id === me.user_id &&
                              d.day === room.selected_date &&
                              d.answer === "busy",
                          ) &&
                            ownRsvp?.response !== "going" && (
                              <p role="alert">
                                วันนี้ชนกับเวลาของคุณ ตรวจสอบก่อนตอบรับ
                              </p>
                            )}
                        </div>
                      </>
                    ) : closed ? (
                      <>
                        <h2>{owner ? "สรุปแผนทริป" : "รอหัวห้องสรุปแผน"}</h2>
                        {!owner && (
                          <button onClick={() => setTab(2)}>ดูผลโหวต</button>
                        )}
                      </>
                    ) : (
                      <div className="demo-guided-next">
                        <h2>
                          {stage === 0
                            ? "ห้องพร้อมแล้ว ชวนเพื่อนกัน"
                            : !answered
                              ? "คุณว่างวันไหน?"
                              : !voted
                                ? current.places.length
                                  ? "เลือกที่ที่อยากไป"
                                  : "อยากไปไหน เสนอที่แรกเลย"
                                : owner
                                  ? "ดูคำตอบเพื่อน แล้วสรุปทริป"
                                  : "ตอบแล้ว รอเพื่อนคนอื่น"}
                        </h2>
                        <p>
                          {stage === 0
                            ? "ส่งคำเชิญให้เพื่อนที่อยากไปด้วยกัน"
                            : !answered
                              ? "แตะวันที่สะดวกในปฏิทิน"
                              : !voted
                                ? "เลือกได้มากกว่าหนึ่งที่"
                                : "แก้คำตอบได้ก่อนปิดโหวต"}
                        </p>
                        {invite && (
                          <label>
                            ลิงก์ชวนเพื่อน
                            <input readOnly value={invite} />
                          </label>
                        )}
                        <button
                          disabled={busy}
                          className="demo-primary"
                          onClick={() => {
                            if (stage === 0) void share();
                            else if (!answered) setTab(1);
                            else if (!voted) setTab(2);
                            else if (owner) finishVoting();
                            else setTab(2);
                          }}
                        >
                          <Icon
                            name={
                              stage === 0
                                ? "copy"
                                : !answered
                                  ? "calendar"
                                  : !voted
                                    ? "pin"
                                    : "check"
                            }
                          />
                          {stage === 0
                            ? "คัดลอกคำเชิญ"
                            : !answered
                              ? "เลือกวันว่าง"
                              : !voted
                                ? "เลือกที่เที่ยว"
                                : owner
                                  ? "สรุปทริป"
                                  : "ดูผลโหวต"}
                        </button>
                        {stage === 0 && (
                          <button
                            className="demo-text-action"
                            onClick={() => setTab(1)}
                          >
                            เลือกวันว่างก่อน
                          </button>
                        )}
                      </div>
                    )}
                    {owner &&
                      closed &&
                      room.status !== "completed" &&
                      room.status !== "cancelled" && (
                        <details
                          className="demo-confirm-section"
                          open={room.status !== "confirmed"}
                        >
                          <summary>
                            {room.status === "confirmed"
                              ? "เปลี่ยนแผน"
                              : "เลือกวันและสถานที่"}
                          </summary>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const perform = () => {
                                void run(
                                  "confirm",
                                  {
                                    date: selectedDate,
                                    place: selectedPlace || winners[0],
                                  },
                                  "ยืนยันแผนแล้ว รอเพื่อนตอบรับ",
                                );
                              };
                              if (room.status === "confirmed")
                                setConfirm({
                                  text: "เปลี่ยนแผน? ทุกคนต้องตอบรับใหม่ และนัดเดิมจะถูกถอน",
                                  run: perform,
                                });
                              else perform();
                            }}
                          >
                            <label>
                              วันเดินทาง
                              <ThaiDateInput
                                type="date"
                                required
                                min={
                                  room.starts_on > todayBangkok()
                                    ? room.starts_on
                                    : todayBangkok()
                                }
                                max={room.ends_on}
                                value={selectedDate}
                                onChange={(e) => {
                                  setSelectedDate(e.target.value);
                                  if (e.target.value)
                                    setMonth(e.target.value.slice(0, 7));
                                }}
                              />
                            </label>
                            <p aria-live="polite">
                              {selectedMonthLoaded
                                ? `ว่าง ${selectedFree} · ไม่ว่าง ${selectedBusy} · ยังไม่ตอบ ${selectedUnknown} คน`
                                : "กำลังดูวันว่าง…"}
                            </p>
                            <label>
                              <span id="workspace-place-label">
                                สถานที่ที่ชนะ / เสมอ
                              </span>
                              <select
                                aria-labelledby="workspace-place-label"
                                value={selectedPlace || winners[0] || ""}
                                onChange={(e) =>
                                  setSelectedPlace(e.target.value)
                                }
                                required
                              >
                                <option value="" disabled>
                                  ยังไม่มีคะแนน
                                </option>
                                {winners.map((id) => (
                                  <option value={id} key={id}>
                                    {
                                      current.places.find((p) => p.id === id)
                                        ?.name
                                    }
                                  </option>
                                ))}
                              </select>
                            </label>
                            {winners.length > 1 && (
                              <p className="demo-tie">
                                คะแนนเสมอ หัวห้องเลือกจากตัวเลือกที่นำเท่ากันได้
                              </p>
                            )}
                            <button
                              disabled={
                                busy || !winners.length || !selectedMonthLoaded
                              }
                              className="demo-primary"
                            >
                              {room.status === "confirmed"
                                ? "ยืนยันแผนใหม่"
                                : "ยืนยันแผนทริป"}
                            </button>
                          </form>
                        </details>
                      )}
                  </>
                )}
                {tab === 1 && (
                  <>
                    {calendar(true)}
                    <div className="demo-task-footer">
                      <span>บันทึกวันว่างอัตโนมัติ</span>
                      <button
                        className="demo-primary"
                        onClick={() => setTab(2)}
                      >
                        เลือกที่เที่ยว
                        <Icon name="arrow" size={18} />
                      </button>
                    </div>
                  </>
                )}
                {tab === 2 && (
                  <>
                    <div className="demo-section-head">
                      <div>
                        <h2>อยากไปที่ไหนกัน?</h2>
                        <p>เลือกได้หลายที่</p>
                      </div>
                      <span className="demo-tag">
                        {closed ? "ปิดโหวตแล้ว" : "เปิดโหวต"}
                      </span>
                    </div>
                    {winners.length > 1 && (
                      <p className="demo-tie">
                        คะแนนนำเท่ากัน หัวห้องจะตัดสินหลังปิดโหวต
                      </p>
                    )}
                    {current.places.map((p) => {
                      const own = current.votes.some(
                          (v) =>
                            v.place_id === p.id && v.user_id === me.user_id,
                        ),
                        count = current.votes.filter(
                          (v) => v.place_id === p.id,
                        ).length;
                      return (
                        <article key={p.id} className="demo-place">
                          <div className="demo-place-thumb">
                            <Icon name="pin" size={28} />
                          </div>
                          <div>
                            <h3>{p.name}</h3>
                            <p>{p.detail}</p>
                            <small>
                              เสนอโดย{" "}
                              {profile(p.created_by)?.display_name ??
                                "อดีตสมาชิก"}
                            </small>
                            <div className="demo-vote-bar">
                              <span
                                style={{
                                  width: `${(count / current.members.length) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="demo-place-vote">
                            <b>{count} เสียง</b>
                            <button
                              disabled={busy || closed}
                              aria-pressed={own}
                              onClick={() =>
                                void run("vote", {
                                  place: p.id,
                                  selected: !own,
                                })
                              }
                            >
                              <Icon name={own ? "check" : "plus"} size={17} />
                              {own ? "เลือกแล้ว" : "เลือก"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {!closed && (
                      <details
                        className="demo-proposal"
                        open={!current.places.length}
                      >
                        <summary>
                          <Icon name="plus" />
                          เสนอสถานที่
                        </summary>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const form = e.currentTarget,
                              f = new FormData(form);
                            const result = await run(
                              "propose",
                              {
                                name: String(f.get("name")).trim(),
                                detail: String(f.get("detail") ?? ""),
                              },
                              "เพิ่มข้อเสนอแล้ว",
                            );
                            if (result.ok) form.reset();
                          }}
                        >
                          <label>
                            สถานที่
                            <input name="name" required maxLength={160} />
                          </label>
                          <details className="demo-optional">
                            <summary>เพิ่มรายละเอียด</summary>
                            <label>
                              ทำไมถึงอยากไป
                              <input name="detail" maxLength={1000} />
                            </label>
                          </details>
                          <button disabled={busy}>เพิ่มข้อเสนอ</button>
                        </form>
                      </details>
                    )}
                    <div className="demo-task-footer">
                      <span>
                        {voted ? "บันทึกคะแนนแล้ว" : "เลือกสถานที่ที่อยากไป"}
                      </span>
                      <button
                        className="demo-primary"
                        disabled={busy || (owner && !closed && !winners.length)}
                        onClick={() =>
                          owner && !closed ? finishVoting() : setTab(0)
                        }
                      >
                        {owner && !closed ? "สรุปทริป" : "เสร็จแล้ว"}
                        <Icon name="arrow" size={18} />
                      </button>
                    </div>
                  </>
                )}
                {tab === 4 && (
                  <>
                    <h2>เพื่อนร่วมทริป</h2>
                    {owner && (
                      <div className="demo-invite">
                        <div className="demo-actions workspace-invite-actions">
                          <button disabled={busy} onClick={() => void share()}>
                            <Icon name="copy" />
                            สร้างคำเชิญใหม่
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                text: "ยกเลิกคำเชิญทั้งหมดที่ยังเปิดอยู่?",
                                run: () => {
                                  void run(
                                    "revoke_invites",
                                    {},
                                    "ปิดลิงก์เชิญแล้ว",
                                  );
                                  setInvite("");
                                },
                              })
                            }
                          >
                            ปิดลิงก์เชิญ
                          </button>
                        </div>
                        {invite && (
                          <label>
                            ลิงก์เชิญ
                            <input readOnly value={invite} />
                          </label>
                        )}
                        <p className="demo-note">
                          สร้างคำเชิญใหม่จะยกเลิกลิงก์เก่า คำเชิญมีอายุ 30 วัน
                        </p>
                      </div>
                    )}
                    {current.members.map((p) => (
                      <div className="demo-member" key={p.user_id}>
                        <Avatar profile={p} />
                        <div>
                          <b>
                            {p.display_name}
                            {p.user_id === me.user_id ? " (คุณ)" : ""}
                          </b>
                          <small>
                            {p.user_id === room.organizer_id
                              ? "หัวห้อง"
                              : "สมาชิก"}
                          </small>
                        </div>
                        {owner && p.user_id !== me.user_id && (
                          <div className="demo-actions">
                            <button
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  text: `นำ ${p.display_name} ออก? คะแนนและการตอบรับจะถูกถอน แต่เข้าซ้ำด้วยคำเชิญใหม่ได้`,
                                  run: () => {
                                    void run("kick", { user: p.user_id });
                                  },
                                })
                              }
                            >
                              เตะออก
                            </button>
                            <button
                              disabled={busy}
                              className="demo-danger"
                              onClick={() =>
                                setConfirm({
                                  text: `แบน ${p.display_name}? จะเข้าซ้ำไม่ได้จนกว่าจะปลดแบน`,
                                  run: () => {
                                    void run("ban", { user: p.user_id });
                                  },
                                })
                              }
                            >
                              แบน
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {owner && (
                      <>
                        <h3>บัญชีที่ถูกแบน</h3>
                        {!current.bans.length && <p>ยังไม่มีบัญชีที่ถูกแบน</p>}
                        {current.bans.map((p) => (
                          <div className="demo-row" key={p.user_id}>
                            <span>{p.display_name}</span>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run("unban", { user: p.user_id })
                              }
                            >
                              ปลดแบน
                            </button>
                          </div>
                        ))}
                        <hr />
                        <h3>ลบห้องทริป</h3>
                        <p>ลบแชท คะแนน และถอนนัดของทุกคนในห้องนี้</p>
                        <button
                          disabled={busy}
                          className="demo-danger"
                          onClick={() =>
                            setConfirm({
                              text: `ลบห้อง “${room.title}”? ข้อมูลห้องจะหายไปและถอนนัดของทุกคน ย้อนกลับไม่ได้`,
                              run: () => {
                                void run("delete");
                              },
                            })
                          }
                        >
                          ลบห้องทริป
                        </button>
                      </>
                    )}
                  </>
                )}
              </section>
              <aside
                className="demo-panel workspace-chat"
                id="workspace-chat"
                data-active={tab === 3}
                role={tab === 3 ? "tabpanel" : "complementary"}
                aria-label="?????????"
              >
                <div className="demo-section-head">
                  <h2>คุยกันในทริป</h2>
                  <span className="demo-tag">{current.members.length} คน</span>
                </div>
                <div className="demo-messages" aria-live="polite">
                  {!current.messages.length && <p>เริ่มคุยกับเพื่อนได้เลย</p>}
                  {current.messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.kind === "system" ? "demo-system" : "demo-message"
                      }
                      data-self={m.author_id === me.user_id}
                    >
                      <small>
                        {m.kind === "system"
                          ? "ระบบ"
                          : (profile(m.author_id)?.display_name ??
                            "อดีตสมาชิก")}{" "}
                        ·{" "}
                        {new Date(m.created_at).toLocaleTimeString("th-TH", {
                          timeZone: "Asia/Bangkok",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                      <p>{m.body}</p>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      body = String(new FormData(form).get("message")).trim();
                    const result = await run("message", { body });
                    if (result.ok) form.reset();
                  }}
                >
                  <label className="demo-sr" htmlFor="workspace-message">
                    ข้อความ
                  </label>
                  <div className="demo-chat-compose">
                    <input
                      id="workspace-message"
                      name="message"
                      placeholder="พิมพ์ข้อความถึงเพื่อน…"
                      required
                      maxLength={2000}
                    />
                    <button
                      disabled={busy}
                      className="demo-primary"
                      aria-label="ส่งข้อความ"
                    >
                      <Icon name="send" />
                    </button>
                  </div>
                </form>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer className="demo-footer">
        WePlanGo
        <form action="/auth/sign-out" method="post">
          <button type="submit">ออกจากระบบ</button>
        </form>
      </footer>
      {busy && (
        <p className="workspace-saving" role="status">
          กำลังบันทึก…
        </p>
      )}
      {confirm && (
        <div className="demo-modal-backdrop">
          <div
            className="demo-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="workspace-confirm"
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              e.preventDefault();
              const buttons =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
                index = Array.from(buttons).indexOf(
                  document.activeElement as HTMLButtonElement,
                );
              buttons[
                (index + (e.shiftKey ? buttons.length - 1 : 1)) % buttons.length
              ].focus();
            }}
          >
            <h2 id="workspace-confirm">ยืนยันการทำรายการ</h2>
            <p>{confirm.text}</p>
            <div className="demo-actions">
              <button autoFocus onClick={() => setConfirm(null)}>
                ยกเลิก
              </button>
              <button
                className="demo-primary"
                onClick={() => {
                  const action = confirm.run;
                  setConfirm(null);
                  action();
                }}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
