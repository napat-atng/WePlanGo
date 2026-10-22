"use client";

import { ThaiDateInput } from "@/components/ui/ThaiDateInput";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Icon, type IconName } from "./Icon";
import { nextStep } from "./next-step";
import { MonthPicker } from "./MonthPicker";
import {
  calendarEvents,
  confirmPlan,
  joinTrip,
  leaders,
  removeMember,
  seed,
  type DemoState,
  type Person,
  type Trip,
} from "./model";

const key = "weplango-mockup-v1";
const tabs = ["ทริป", "วันว่าง", "ที่เที่ยว", "แชท", "สมาชิก"];
const tabIcons: IconName[] = ["home", "calendar", "pin", "chat", "users"];
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const uid = () => crypto.randomUUID();
function Avatar({ person }: { person: Person }) {
  return person.photo ? (
    <Image
      className="demo-avatar"
      src={person.photo}
      alt={person.name}
      width={44}
      height={44}
      unoptimized
    />
  ) : (
    <span className="demo-avatar">{person.name.slice(0, 1)}</span>
  );
}

export default function MockupApp() {
  const [state, setState] = useState<DemoState>(seed);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [view, setView] = useState("home");
  const [tripId, setTripId] = useState("chiang-mai");
  const [tab, setTab] = useState(0);
  const [notice, setNotice] = useState("");
  const [month, setMonth] = useState("2026-11");
  const [paint, setPaint] = useState("free");
  const [chosenDate, setChosenDate] = useState("2026-11-14");
  const [chosenPlace, setChosenPlace] = useState("");
  const [pending, setPending] = useState<{
    text: string;
    run: () => void;
  } | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored) as DemoState;
          if (
            data.schema === 1 &&
            Array.isArray(data.people) &&
            data.people.some((p) => p.id === data.user) &&
            Array.isArray(data.trips)
          )
            setState(data);
        }
      } catch {
        setStorageError(true);
      }
      const token = new URLSearchParams(location.search).get("invite");
      if (token) {
        setInviteInput(token);
        setView("join");
      }
      setReady(true);
      setNow(Date.now());
    }, 0);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(hydrate);
      window.clearInterval(clock);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let failed = false;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      failed = true;
    }
    const report = window.setTimeout(() => setStorageError(failed), 0);
    return () => window.clearTimeout(report);
  }, [state, ready]);
  useEffect(() => {
    if (!pending) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPending(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [pending]);
  const me = state.people.find((p) => p.id === state.user)!;
  const trip = state.trips.find((t) => t.id === tripId);
  const member = !!trip?.members.includes(me.id);
  const owner = member && trip?.owner === me.id;
  const person = (id: string) => state.people.find((p) => p.id === id)!;
  const patchPerson = (patch: Partial<Person>) =>
    setState((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === s.user ? { ...p, ...patch } : p)),
    }));
  const patchTrip = (change: (t: Trip) => Trip) =>
    setState((s) => ({
      ...s,
      trips: s.trips.map((t) => (t.id === tripId ? change(t) : t)),
    }));
  const system = (t: Trip, text: string): Trip => ({
    ...t,
    messages: [
      ...t.messages,
      {
        id: uid(),
        author: "system",
        text,
        time: new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ],
  });
  const act = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "ทำรายการไม่ได้ กรุณาลองใหม่");
    }
  };
  const isClosed = (t: Trip) =>
    t.closed || new Date(`${t.deadline}:00+07:00`).getTime() <= now;
  const progressStage = trip
    ? tab === 1
      ? 1
      : tab === 2
        ? 2
        : nextStep(trip, me, isClosed(trip)).stage
    : 0;
  const savePlan = () => {
    if (!trip || !owner) return;
    act(() => {
      const next = confirmPlan(
        { ...trip, closed: isClosed(trip) },
        me.id,
        chosenDate,
        chosenPlace || leaders(trip)[0]?.id || "",
      );
      patchTrip(() =>
        system(
          next,
          `ยืนยันแผนรุ่น ${next.plan!.version} · ${dateLabel(chosenDate)}`,
        ),
      );
      setNotice("ยืนยันแผนแล้ว รอเพื่อนตอบรับ");
    });
  };
  const openTrip = (t: Trip) => {
    setTripId(t.id);
    setView("trip");
    setTab(0);
    setChosenPlace("");
    setChosenDate(
      t.start <= "2026-11-14" && t.end >= "2026-11-14" ? "2026-11-14" : t.start,
    );
    setMonth(t.start.slice(0, 7));
  };
  const appointments = calendarEvents(state, me.id);
  function scenario(value: string) {
    const next = seed();
    next.signedIn = true;
    if (value === "empty")
      next.people.forEach((p) => {
        p.availability = {};
      });
    if (value === "conflict") {
      next.people[0].availability["2026-11-14"] = "busy";
      next.people[0].connected = true;
    }
    if (value === "sync") {
      next.people[0].connected = true;
      next.people[0].syncError = true;
    }
    if (value === "invite") {
      next.trips[0].inviteActive = false;
      setInviteInput("cnx-friends");
    }
    setState(next);
    setTripId(next.trips[0].id);
    setTab(value === "empty" || value === "conflict" ? 1 : 2);
    setView(
      value === "sync" ? "profile" : value === "invite" ? "join" : "trip",
    );
    setNotice("โหลดสถานการณ์ใหม่แล้ว ข้อมูลทดลองเดิมถูกแทนที่");
  }
  function calendar(shared: boolean) {
    const [year, mon] = month.split("-").map(Number);
    if (!year || !mon) return <p>เลือกเดือนเพื่อดูปฏิทิน</p>;
    const offset = (new Date(year, mon - 1, 1).getDay() + 6) % 7;
    const total = new Date(year, mon, 0).getDate();
    return (
      <section className="demo-calendar">
        <div className="demo-section-head">
          <div>
            <h2>{shared ? "เลือกวันที่คุณว่าง" : "ปฏิทินของฉัน"}</h2>
            <p>{shared ? "เลือกได้หลายวัน" : "ใช้วันว่างนี้กับทุกทริป"}</p>
          </div>
          <MonthPicker value={month} onChange={setMonth} />
        </div>
        <fieldset className="demo-availability-mode">
          <legend className="demo-sr">แตะวันที่เพื่อระบุ</legend>
          {[
            { value: "free", label: "ว่าง", icon: "check" },
            { value: "busy", label: "ไม่ว่าง", icon: "close" },
            { value: "unset", label: "ยังไม่ตอบ", icon: "clock" },
          ].map((mode) => (
            <button
              key={mode.value}
              type="button"
              aria-pressed={paint === mode.value}
              onClick={() => setPaint(mode.value)}
            >
              <Icon name={mode.icon as IconName} size={16} />
              {mode.label}
            </button>
          ))}
        </fieldset>
        {shared && (
          <p className="demo-calendar-hint">
            <Icon name="users" size={15} /> คนว่าง / สมาชิก
          </p>
        )}
        <div className="demo-calendar-grid" key={month}>
          {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((d) => (
            <strong className="demo-weekday" key={d}>
              {d}
            </strong>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`blank${i}`} />
          ))}
          {Array.from({ length: total }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            const busyImport = me.connected && date.endsWith("-15");
            const event = appointments.find((a) => a.date === date);
            const status = busyImport || event ? "busy" : me.availability[date];
            const participants =
              shared && trip
                ? state.people.filter((p) => trip.members.includes(p.id))
                : [];
            const free = participants.filter(
              (p) =>
                p.availability[date] === "free" &&
                !(p.connected && date.endsWith("-15")) &&
                !calendarEvents(state, p.id).some((a) => a.date === date),
            ).length;
            const outside =
              shared && trip && (date < trip.start || date > trip.end);
            return (
              <button
                key={date}
                disabled={!!outside}
                className="demo-day"
                data-status={status}
                aria-label={`${dateLabel(date)} ${status === "free" ? "ว่าง" : status === "busy" ? "ไม่ว่าง" : "ยังไม่ตอบ"}${shared ? ` กลุ่มว่าง ${free} คน` : ""}`}
                onClick={() => {
                  if (busyImport || event) {
                    setNotice(
                      "วันนี้มีนัดหมายอยู่แล้ว ลองเลือกวันอื่น หรือจัดการรายการต้นทาง",
                    );
                    return;
                  }
                  const availability = { ...me.availability };
                  if (paint === "unset") delete availability[date];
                  else availability[date] = paint as "free" | "busy";
                  patchPerson({ availability });
                  setChosenDate(date);
                }}
              >
                <b>{i + 1}</b>
                <span>
                  {event || busyImport || status === "busy" ? (
                    <Icon name="close" size={14} />
                  ) : status === "free" ? (
                    <Icon name="check" size={14} />
                  ) : (
                    <span aria-hidden="true">·</span>
                  )}
                </span>
                {shared && (
                  <small>
                    {free}/{participants.length}
                  </small>
                )}
              </button>
            );
          })}
        </div>
        {shared && trip && (
          <details className="demo-responses">
            <summary>ดูว่าใครว่างบ้าง</summary>
            <h3>คำตอบวันที่ {dateLabel(chosenDate)}</h3>
            <ThaiDateInput
              aria-label="ดูคำตอบวันที่"
              type="date"
              min={trip.start}
              max={trip.end}
              value={chosenDate}
              onChange={(e) => setChosenDate(e.target.value)}
            />
            {trip.members.map((id) => {
              const p = person(id);
              const busy =
                (p.connected && chosenDate.endsWith("-15")) ||
                calendarEvents(state, id).some((a) => a.date === chosenDate);
              return (
                <div className="demo-row" key={id}>
                  <span>
                    {p.name}
                    {id === me.id ? " (คุณ)" : ""}
                  </span>
                  <span>
                    {busy || p.availability[chosenDate] === "busy"
                      ? "ไม่ว่าง"
                      : p.availability[chosenDate] === "free"
                        ? "ว่าง"
                        : "ยังไม่ตอบ"}
                  </span>
                </div>
              );
            })}
          </details>
        )}
        {!shared && (
          <p className="demo-note">
            ตัวอย่าง Google Calendar จำลอง: วันที่ 15 ของแต่ละเดือนติดธุระ
            รายละเอียดกิจกรรมเห็นเฉพาะคุณ
          </p>
        )}
      </section>
    );
  }
  function chat(t: Trip) {
    return (
      <section className="demo-chat">
        <div className="demo-section-head">
          <h2>คุยกันในทริป</h2>
          <span className="demo-tag">{t.members.length} คน</span>
        </div>

        <div className="demo-messages" aria-live="polite">
          {t.messages.length === 0 && (
            <p>ยังไม่มีข้อความ เริ่มคุยกับเพื่อนได้เลย</p>
          )}
          {t.messages.map((m) => (
            <div
              key={m.id}
              className={m.author === "system" ? "demo-system" : "demo-message"}
              data-self={m.author === me.id}
            >
              <small>
                {m.author === "system"
                  ? "ระบบ"
                  : (person(m.author)?.name ?? "อดีตสมาชิก")}{" "}
                · {m.time}
              </small>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const text = String(new FormData(form).get("message") ?? "").trim();
            if (!text || !member) return;
            patchTrip((t) => ({
              ...t,
              messages: [
                ...t.messages,
                {
                  id: uid(),
                  author: me.id,
                  text,
                  time: new Date().toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
              ],
            }));
            form.reset();
          }}
        >
          <label className="demo-sr" htmlFor={`message-${tab}`}>
            ข้อความ
          </label>
          <div className="demo-chat-compose">
            <input
              id={`message-${tab}`}
              name="message"
              placeholder="พิมพ์ข้อความถึงเพื่อน…"
              maxLength={1000}
              required
              autoComplete="off"
            />
            <button className="demo-primary" aria-label="ส่งข้อความ">
              <Icon name="send" />
            </button>
          </div>
        </form>
      </section>
    );
  }
  if (!ready)
    return (
      <main className="demo-app">
        <p role="status">กำลังเปิดต้นแบบ…</p>
      </main>
    );
  return (
    <div className="demo-app">
      <div className="demo-prototype">
        <span>ต้นแบบทดลอง</span>
        <details className="demo-test-tools">
          <summary>เครื่องมือทดสอบ</summary>
          <div>
            {" "}
            <label className="demo-switch">
              ทดลองเป็น
              <select
                value={me.id}
                onChange={(e) => {
                  setState((s) => ({ ...s, user: e.target.value }));
                  setNotice("เปลี่ยนผู้ใช้ทดลองแล้ว");
                }}
              >
                {state.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {trip?.owner === p.id ? "หัวห้อง" : "สมาชิก"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              สถานการณ์
              <select
                aria-label="สถานการณ์"
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (value)
                    setPending({
                      text: "แทนที่ข้อมูลทดลองด้วยสถานการณ์ที่เลือก?",
                      run: () => scenario(value),
                    });
                }}
              >
                <option value="">เลือกสถานการณ์</option>
                <option value="tie">คะแนนเสมอ</option>
                <option value="conflict">วันชนกัน</option>
                <option value="empty">ยังไม่มีคำตอบ</option>
                <option value="invite">ลิงก์ใช้ไม่ได้</option>
                <option value="sync">ซิงก์ล้มเหลว</option>
              </select>
            </label>
            <button
              onClick={() =>
                setPending({
                  text: "ล้างข้อมูลทดลองทั้งหมดและเริ่มใหม่?",
                  run: () => {
                    setState(seed());
                    setView("home");
                    setNotice("รีเซ็ตแล้ว");
                  },
                })
              }
            >
              รีเซ็ต
            </button>
          </div>
        </details>
      </div>
      <header className="demo-header">
        <button className="demo-brand" onClick={() => setView("home")}>
          <span className="demo-brand-mark">
            <Icon name="mountain" size={24} />
          </span>
          WePlanGo
        </button>
        <nav aria-label="เมนูต้นแบบ">
          <button
            aria-current={view === "home" ? "page" : undefined}
            onClick={() => setView("home")}
          >
            <Icon name="home" /> ทริปของฉัน
          </button>
          <button
            aria-current={view === "profile" ? "page" : undefined}
            onClick={() => setView("profile")}
          >
            <Icon name="calendar" /> ปฏิทิน & Profile
          </button>
        </nav>
      </header>
      {storageError && (
        <div role="alert" className="demo-alert">
          บันทึกในเบราว์เซอร์ไม่ได้ ข้อมูลอาจหายเมื่อรีเฟรช
          ลองลดขนาดรูปหรือรีเซ็ตข้อมูล
        </div>
      )}
      {notice && (
        <div className="demo-notice" role="status" key={notice}>
          <span>{notice}</span>
          <button aria-label="ปิดข้อความแจ้งผล" onClick={() => setNotice("")}>
            ปิด
          </button>
        </div>
      )}
      {!state.signedIn ? (
        <main className="demo-login">
          <div>
            <h1>
              ทริปดี ๆ เริ่มจาก
              <br />
              วันที่เราว่างตรงกัน
            </h1>
            <p>
              รวมวันว่าง เสนอสถานที่ แล้วตัดสินใจไปด้วยกัน
              <br />
              ที่เดียวสำหรับทุกคนในทริป
            </p>
            <button
              className="demo-primary"
              onClick={() => setState((s) => ({ ...s, signedIn: true }))}
            >
              เข้าสู่ระบบด้วย Google (จำลอง)
            </button>
            <p className="demo-note">ไม่เชื่อมบัญชีจริง ไม่ขอสิทธิ์ปฏิทิน</p>
          </div>
          <section className="demo-login-preview">
            <Image
              src="/mockup/chiang-mai.jpg"
              alt="ภูเขาเชียงใหม่ยามเย็น"
              fill
              sizes="(max-width: 600px) 100vw, 600px"
              unoptimized
              priority
            />
            <div className="demo-login-preview-copy">
              <span className="demo-tag">แผนเที่ยวครั้งต่อไป</span>
              <h2>
                เชียงใหม่
                <br />
                ไปพักใจกัน
              </h2>
              <p>14 พฤศจิกายน · ว่างตรงกัน 3 คน</p>
              <div className="demo-people">
                {state.people.map((p) => (
                  <Avatar key={p.id} person={p} />
                ))}
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="demo-main">
          {view === "home" && (
            <>
              <div className="demo-page-heading">
                <div>
                  <h1>ไปเที่ยวด้วยกัน</h1>
                  <p>สวัสดี {me.name} ทริปไหนต่อดี?</p>
                </div>
                <div className="demo-actions">
                  <button onClick={() => setView("join")}>
                    <Icon name="users" /> เข้าร่วม
                  </button>
                  <button
                    className="demo-primary"
                    onClick={() => setView("create")}
                  >
                    <Icon name="plus" /> สร้างทริปใหม่
                  </button>
                </div>
              </div>
              <div className="demo-home-grid">
                <section>
                  <h2>ทริปของฉัน</h2>
                  {state.trips.filter((t) => t.members.includes(me.id))
                    .length === 0 && (
                    <p>ยังไม่มีทริป สร้างห้องหรือใช้ลิงก์เชิญจากเพื่อนได้เลย</p>
                  )}
                  {state.trips
                    .filter((t) => t.members.includes(me.id))
                    .map((t) => (
                      <button
                        className="demo-trip-card"
                        key={t.id}
                        onClick={() => openTrip(t)}
                      >
                        <div className="demo-trip-art">
                          <Image
                            src="/mockup/chiang-mai.jpg"
                            alt="ภาพบรรยากาศภูเขาประกอบทริป"
                            fill
                            sizes="(max-width: 600px) 100vw, 720px"
                            unoptimized
                          />
                          <span className="demo-tag">
                            {t.plan ? "ยืนยันแผนแล้ว" : "กำลังวางแผน"}
                          </span>
                        </div>
                        <div className="demo-trip-copy">
                          <h3>{t.name}</h3>
                          <p>{t.detail}</p>
                          <div className="demo-row">
                            <span>
                              {t.members.length} คน ·{" "}
                              {t.owner === me.id ? "คุณเป็นหัวห้อง" : "สมาชิก"}
                            </span>
                            <b>
                              เปิดทริป <Icon name="arrow" size={18} />
                            </b>
                          </div>
                        </div>
                      </button>
                    ))}
                </section>
                <aside className="demo-home-aside">
                  <h2>เวลาของคุณ</h2>
                  <p>กำหนดวันว่างไว้ก่อน เพื่อนจะได้หาวันที่ตรงกันง่ายขึ้น</p>
                  <button onClick={() => setView("profile")}>
                    <Icon name="calendar" /> วันว่างของฉัน
                  </button>
                  <hr />
                  <h3>นัดหมายที่ตอบรับ</h3>
                  {appointments.length ? (
                    appointments.map((a) => (
                      <p key={a.id}>
                        {a.title}
                        <br />
                        <b>{dateLabel(a.date)}</b>
                      </p>
                    ))
                  ) : (
                    <p>ยังไม่มีนัดหมายที่ตอบรับ</p>
                  )}
                </aside>
              </div>
            </>
          )}
          {view === "profile" && (
            <>
              <div className="demo-page-heading">
                <div>
                  <h1>พื้นที่ของ {me.name}</h1>
                  <p>ข้อมูลส่วนตัวและปฏิทินที่เชื่อมทุกทริปเข้าด้วยกัน</p>
                </div>
                <Avatar person={me} />
              </div>
              <div className="demo-profile-grid">
                <div className="demo-panel">{calendar(false)}</div>
                <aside className="demo-panel">
                  <h2>Profile</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = String(
                        new FormData(e.currentTarget).get("name"),
                      ).trim();
                      if (name) {
                        patchPerson({ name });
                        setNotice("บันทึกชื่อแล้ว");
                      }
                    }}
                  >
                    <label>
                      ชื่อที่แสดง
                      <input
                        key={me.id + me.name}
                        name="name"
                        defaultValue={me.name}
                        required
                        maxLength={40}
                      />
                    </label>
                    <button>บันทึกชื่อ</button>
                  </form>
                  <label>
                    เปลี่ยนรูป Profile
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (
                          file.size > 1000000 ||
                          !["image/png", "image/jpeg", "image/webp"].includes(
                            file.type,
                          )
                        ) {
                          setNotice(
                            "เลือกรูป PNG, JPEG หรือ WebP ไม่เกิน 1 MB",
                          );
                          return;
                        }
                        const id = me.id;
                        const reader = new FileReader();
                        reader.onload = () =>
                          setState((s) => ({
                            ...s,
                            people: s.people.map((p) =>
                              p.id === id
                                ? { ...p, photo: String(reader.result) }
                                : p,
                            ),
                          }));
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  <hr />
                  <h3>Google Calendar</h3>
                  <p>
                    {me.connected
                      ? me.syncError
                        ? "ซิงก์ไม่สำเร็จ · นัดยังอยู่ใน Profile"
                        : "เชื่อมต่อแล้ว · ข้อมูลจำลอง"
                      : "ยังไม่ได้เชื่อมต่อ"}
                  </p>
                  <button
                    onClick={() => {
                      patchPerson({
                        connected: !me.connected,
                        syncError: false,
                      });
                      setNotice(
                        me.connected
                          ? "ยกเลิกการเชื่อมต่อจำลองแล้ว"
                          : "เชื่อมต่อจำลองแล้ว อ่านช่วงไม่ว่างและส่งนัดที่ตอบรับ",
                      );
                    }}
                  >
                    {me.connected
                      ? "ยกเลิกการเชื่อมต่อ"
                      : "เชื่อมต่อ Google (จำลอง)"}
                  </button>
                  {me.syncError && (
                    <button
                      onClick={() => {
                        patchPerson({ syncError: false });
                        setNotice("ซิงก์นัดหมายจำลองสำเร็จแล้ว");
                      }}
                    >
                      ลองซิงก์อีกครั้ง
                    </button>
                  )}
                  <p className="demo-note">
                    เพื่อนเห็นเฉพาะว่าง/ไม่ว่าง
                    คุณเท่านั้นที่เห็นรายละเอียดส่วนตัว
                  </p>
                  {me.connected && (
                    <p>กิจกรรมส่วนตัวจำลอง: นัดส่วนตัวทุกวันที่ 15</p>
                  )}
                  <hr />
                  <h3>นัดจากทริป</h3>
                  {appointments.length === 0 ? (
                    <p>ตอบรับแผนทริปเพื่อเพิ่มนัดที่นี่</p>
                  ) : (
                    appointments.map((a) => (
                      <div className="demo-appointment" key={a.id}>
                        <b>{a.title}</b>
                        <p>
                          {dateLabel(a.date)} · แผนรุ่น {a.version}
                        </p>
                        <small>
                          {me.connected
                            ? me.syncError
                              ? "รอซิงก์ Google"
                              : "ส่งเข้า Google จำลองแล้ว"
                            : "บันทึกใน Profile"}
                        </small>
                      </div>
                    ))
                  )}
                </aside>
              </div>
            </>
          )}
          {view === "create" && (
            <section className="demo-panel demo-narrow">
              <h1>เริ่มทริปใหม่</h1>
              <p>ตั้งชื่อก่อน แล้วค่อยชวนเพื่อน</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const start = String(data.get("start"));
                  const end = String(data.get("end"));
                  if (end < start) {
                    setNotice("วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น");
                    return;
                  }
                  const t: Trip = {
                    id: uid(),
                    name: String(data.get("name")).trim(),
                    detail: String(data.get("detail")).trim(),
                    start,
                    end,
                    deadline: String(data.get("deadline")),
                    owner: me.id,
                    members: [me.id],
                    banned: [],
                    invite: uid().slice(0, 8),
                    inviteActive: true,
                    places: [],
                    messages: [],
                    closed: false,
                    plan: null,
                    rsvps: {},
                  };
                  if (!t.name) return;
                  setState((s) => ({ ...s, trips: [...s.trips, t] }));
                  openTrip(t);
                  setNotice("");
                }}
              >
                <label>
                  ชื่อทริป
                  <input
                    name="name"
                    required
                    maxLength={80}
                    placeholder="เช่น ทะเลวันหยุดกับเพื่อน"
                  />
                </label>
                <div className="demo-create-fields">
                  <label>
                    รายละเอียด
                    <textarea
                      name="detail"
                      maxLength={500}
                      placeholder="อยากไปทำอะไรด้วยกัน?"
                    />
                  </label>
                  <div className="demo-two">
                    <label>
                      หาวันตั้งแต่
                      <ThaiDateInput
                        name="start"
                        type="date"
                        defaultValue="2026-11-01"
                        required
                      />
                    </label>
                    <label>
                      ถึงวันที่
                      <ThaiDateInput
                        name="end"
                        type="date"
                        defaultValue="2026-11-30"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    ปิดโหวต (เวลาไทย)
                    <ThaiDateInput
                      name="deadline"
                      type="datetime-local"
                      defaultValue="2026-11-10T18:00"
                      required
                    />
                  </label>
                </div>
                <div className="demo-actions">
                  <button type="button" onClick={() => setView("home")}>
                    ยกเลิก
                  </button>
                  <button className="demo-primary">สร้างห้องทริป</button>
                </div>
              </form>
            </section>
          )}
          {view === "join" && (
            <section className="demo-panel demo-narrow">
              <h1>เพื่อนชวนไปเที่ยว</h1>
              <p>วางลิงก์หรือรหัสเชิญจากหัวห้อง ตัวอย่าง: cnx-friends</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() => {
                    let token = inviteInput.trim();
                    try {
                      token =
                        new URL(token).searchParams.get("invite") ?? token;
                    } catch {
                      /* short token */
                    }
                    const t = state.trips.find((t) => t.invite === token);
                    if (!t)
                      throw new Error("ไม่พบลิงก์นี้ ขอรหัสเชิญใหม่จากหัวห้อง");
                    const joined = joinTrip(t, me.id, token);
                    setState((s) => ({
                      ...s,
                      trips: s.trips.map((x) =>
                        x.id === t.id
                          ? system(joined, `${me.name} เข้าร่วมห้อง`)
                          : x,
                      ),
                    }));
                    openTrip(joined);
                    setNotice("เข้าร่วมห้องแล้ว");
                  });
                }}
              >
                <label>
                  ลิงก์หรือรหัสเชิญ
                  <input
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    required
                  />
                </label>
                <button className="demo-primary">เข้าร่วมทริป</button>
              </form>
            </section>
          )}
          {view === "trip" && (!trip || !member) && (
            <section className="demo-panel">
              <h1>ยังเข้าห้องนี้ไม่ได้</h1>
              <p>
                {trip?.banned.includes(me.id)
                  ? "คุณถูกแบนจากห้องนี้ ติดต่อหัวห้องเพื่อปลดแบน"
                  : "คุณไม่ได้เป็นสมาชิกแล้ว ใช้คำเชิญใหม่เพื่อเข้าร่วม"}
              </p>
              <button onClick={() => setView("join")}>ใช้ลิงก์เชิญ</button>
            </section>
          )}
          {view === "trip" && trip && member && (
            <>
              <button className="demo-back" onClick={() => setView("home")}>
                ← ทริปของฉัน
              </button>
              <div className="demo-room-hero" data-compact={tab !== 0}>
                <div className="demo-page-heading demo-room-heading">
                  <div>
                    <h1>{trip.name}</h1>
                    {trip.detail && <p>{trip.detail}</p>}
                    <div className="demo-meta">
                      <span className="demo-tag">
                        {trip.plan
                          ? "ยืนยันแผนแล้ว"
                          : isClosed(trip)
                            ? "รอสรุปแผน"
                            : "กำลังวางแผน"}
                      </span>
                      <details className="demo-room-info">
                        <summary>รายละเอียดทริป</summary>
                        <p>
                          หัวห้อง: {person(trip.owner).name}
                          <br />
                          ปิดโหวต {dateLabel(trip.deadline.slice(0, 10))}{" "}
                          {trip.deadline.slice(11)} น.
                        </p>
                      </details>
                    </div>
                  </div>
                  <button onClick={() => setTab(4)}>
                    <Icon name="users" /> {trip.members.length} คน
                  </button>
                </div>
                <div className="demo-room-image">
                  <Image
                    src="/mockup/chiang-mai.jpg"
                    alt="ภาพบรรยากาศภูเขาประกอบทริป"
                    fill
                    sizes="(max-width: 600px) 100vw, 450px"
                    unoptimized
                  />
                </div>
              </div>
              <details className="demo-flow-outline">
                <summary>
                  ขั้นตอน {progressStage + 1}/5 ·{" "}
                  {
                    [
                      "ชวนเพื่อน",
                      "เลือกวัน",
                      "โหวตที่เที่ยว",
                      "สรุปแผน",
                      "ตอบรับ",
                    ][progressStage]
                  }
                </summary>
                <ol
                  className="demo-steps demo-guide-steps"
                  aria-label="ขั้นตอนวางแผน"
                >
                  {[
                    "ชวนเพื่อน",
                    "เลือกวัน",
                    "โหวตที่เที่ยว",
                    "สรุปแผน",
                    "ตอบรับ",
                  ].map((label, i) => (
                    <li key={label} data-active={progressStage === i}>
                      <button onClick={() => setTab([4, 1, 2, 0, 0][i])}>
                        {label}
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
              <div
                className="demo-tabs"
                role="tablist"
                aria-label="ส่วนต่าง ๆ ของทริป"
                onKeyDown={(e) => {
                  const next =
                    e.key === "ArrowRight"
                      ? (tab + 1) % tabs.length
                      : e.key === "ArrowLeft"
                        ? (tab + tabs.length - 1) % tabs.length
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? tabs.length - 1
                            : null;
                  if (next === null) return;
                  e.preventDefault();
                  setTab(next);
                  e.currentTarget
                    .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                    [next].focus();
                }}
              >
                {tabs.map((label, i) => (
                  <button
                    role="tab"
                    aria-selected={tab === i}
                    tabIndex={tab === i ? 0 : -1}
                    aria-controls="demo-tab-content"
                    key={label}
                    onClick={() => setTab(i)}
                  >
                    <Icon name={tabIcons[i]} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="demo-workspace demo-focused-workspace">
                <section
                  id="demo-tab-content"
                  role="tabpanel"
                  aria-label={tabs[tab]}
                  className="demo-panel"
                >
                  {tab === 0 && (
                    <>
                      {(trip.plan || isClosed(trip)) && (
                        <div className="demo-section-head">
                          <h2>{trip.plan ? "แผนของเรา" : "สรุปแผนทริป"}</h2>
                          <span className="demo-tag">
                            {trip.plan
                              ? `แผนรุ่น ${trip.plan.version}`
                              : "ยังไม่ยืนยัน"}
                          </span>
                        </div>
                      )}
                      {trip.plan ? (
                        <div className="demo-plan">
                          <h3>
                            {
                              trip.places.find((p) => p.id === trip.plan!.place)
                                ?.name
                            }
                          </h3>
                          <p>{dateLabel(trip.plan.date)}</p>
                          <p>
                            ตอบรับแล้ว{" "}
                            {
                              Object.values(trip.rsvps).filter(
                                (v) => v === trip.plan!.version,
                              ).length
                            }
                            /{trip.members.length} คน
                          </p>
                          <button
                            className="demo-primary"
                            disabled={trip.rsvps[me.id] === trip.plan.version}
                            onClick={() => {
                              patchTrip((t) =>
                                system(
                                  {
                                    ...t,
                                    rsvps: {
                                      ...t.rsvps,
                                      [me.id]: t.plan!.version,
                                    },
                                  },
                                  `${me.name} ตอบรับแผนรุ่น ${t.plan!.version}`,
                                ),
                              );
                              setNotice(
                                "เพิ่มนัดใน Profile แล้ว" +
                                  (me.connected
                                    ? me.syncError
                                      ? " · รอซิงก์ Google"
                                      : " · ซิงก์ Google จำลองแล้ว"
                                    : ""),
                              );
                            }}
                          >
                            {trip.rsvps[me.id] === trip.plan.version
                              ? "คุณตอบรับแผนนี้แล้ว"
                              : "ตอบรับและเพิ่มลงปฏิทิน"}
                          </button>
                          {trip.rsvps[me.id] && (
                            <button
                              onClick={() =>
                                patchTrip((t) => ({
                                  ...t,
                                  rsvps: Object.fromEntries(
                                    Object.entries(t.rsvps).filter(
                                      ([id]) => id !== me.id,
                                    ),
                                  ),
                                }))
                              }
                            >
                              ยกเลิกการตอบรับและนัด
                            </button>
                          )}
                          {(me.availability[trip.plan.date] === "busy" ||
                            (me.connected && trip.plan.date.endsWith("-15")) ||
                            appointments.some(
                              (a) =>
                                a.id !== trip.id && a.date === trip.plan!.date,
                            )) && (
                            <p role="alert">
                              วันนี้ชนกับเวลาของคุณ ตรวจสอบก่อนตอบรับ
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="demo-next demo-guided-next">
                          <h2>{nextStep(trip, me, isClosed(trip)).title}</h2>
                          <p>
                            {nextStep(trip, me, isClosed(trip)).stage === 0
                              ? "ส่งลิงก์นี้ให้เพื่อนที่อยากไปด้วยกัน"
                              : nextStep(trip, me, isClosed(trip)).stage === 1
                                ? "แตะวันที่สะดวกในปฏิทิน"
                                : nextStep(trip, me, isClosed(trip)).stage === 2
                                  ? "เลือกได้มากกว่าหนึ่งที่"
                                  : owner
                                    ? "เช็กวันว่างและคะแนนก่อนปิดโหวต"
                                    : "แก้วันว่างหรือคะแนนได้จนกว่าจะปิดโหวต"}
                          </p>
                          {nextStep(trip, me, isClosed(trip)).stage === 0 && (
                            <label>
                              <span className="demo-sr">ลิงก์ชวนเพื่อน</span>
                              <input
                                readOnly
                                value={`${typeof location === "undefined" ? "" : location.origin}/mockup?invite=${trip.invite}`}
                              />
                            </label>
                          )}
                          {!isClosed(trip) && (
                            <button
                              className="demo-primary"
                              onClick={() => {
                                const step = nextStep(trip, me, false);
                                if (step.stage === 0) {
                                  if (!navigator.clipboard) {
                                    setNotice("เลือกคัดลอกจากช่องลิงก์ด้านบน");
                                    return;
                                  }
                                  navigator.clipboard
                                    .writeText(
                                      `${location.origin}/mockup?invite=${trip.invite}`,
                                    )
                                    .then(
                                      () => {
                                        patchTrip((t) => ({
                                          ...t,
                                          inviteShared: true,
                                        }));
                                        setNotice(
                                          "คัดลอกแล้ว ส่งให้เพื่อนได้เลย",
                                        );
                                        setTab(1);
                                      },
                                      () =>
                                        setNotice(
                                          "คัดลอกไม่ได้ เลือกคัดลอกจากช่องลิงก์ด้านบน",
                                        ),
                                    );
                                } else if (step.stage === 3 && owner)
                                  setPending({
                                    text: "ปิดโหวต? เพื่อนจะเปลี่ยนคะแนนไม่ได้",
                                    run: () =>
                                      patchTrip((t) =>
                                        system(
                                          { ...t, closed: true },
                                          "หัวห้องปิดโหวตแล้ว",
                                        ),
                                      ),
                                  });
                                else setTab(step.tab);
                              }}
                            >
                              <Icon
                                name={
                                  nextStep(trip, me, false).stage === 0
                                    ? "copy"
                                    : nextStep(trip, me, false).stage === 1
                                      ? "calendar"
                                      : nextStep(trip, me, false).stage === 2
                                        ? "pin"
                                        : "check"
                                }
                              />
                              {nextStep(trip, me, false).action}
                            </button>
                          )}
                          {nextStep(trip, me, isClosed(trip)).stage === 0 && (
                            <button
                              className="demo-text-action"
                              onClick={() => {
                                patchTrip((t) => ({
                                  ...t,
                                  inviteShared: true,
                                }));
                                setTab(1);
                              }}
                            >
                              เลือกวันว่างก่อน
                            </button>
                          )}
                        </div>
                      )}
                      <details className="demo-results">
                        <summary>
                          ดูผลโหวต · {trip.places.length} สถานที่
                        </summary>

                        {trip.places.map((p) => (
                          <div className="demo-row" key={p.id}>
                            <span>{p.name}</span>
                            <b>
                              {
                                p.votes.filter((id) =>
                                  trip.members.includes(id),
                                ).length
                              }{" "}
                              เสียง
                            </b>
                          </div>
                        ))}
                        {!trip.places.length && (
                          <p>ยังไม่มีสถานที่ เริ่มเสนอในแท็บโหวตได้เลย</p>
                        )}
                      </details>
                      {owner && isClosed(trip) && (
                        <details
                          className="demo-confirm-section"
                          open={!trip.plan}
                        >
                          <summary>
                            {trip.plan ? "เปลี่ยนแผน" : "เลือกวันและสถานที่"}
                          </summary>
                          <hr />
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (trip.plan)
                                setPending({
                                  text: "เปลี่ยนแผน? ทุกคนต้องตอบรับใหม่ นัดเดิมจะถูกถอนจนกว่าจะตอบรับแผนใหม่",
                                  run: savePlan,
                                });
                              else savePlan();
                            }}
                          >
                            <label>
                              วันเดินทาง
                              <ThaiDateInput
                                type="date"
                                min={trip.start}
                                max={trip.end}
                                value={chosenDate}
                                onChange={(e) => setChosenDate(e.target.value)}
                                required
                              />
                            </label>
                            <label>
                              สถานที่ที่ชนะ / เสมอ
                              <select
                                value={
                                  chosenPlace || leaders(trip)[0]?.id || ""
                                }
                                onChange={(e) => setChosenPlace(e.target.value)}
                              >
                                <option value="" disabled>
                                  ยังไม่มีคะแนน
                                </option>
                                {leaders(trip).map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {leaders(trip).length > 1 && (
                              <p className="demo-note">
                                คะแนนเสมอ หัวห้องเลือกจากตัวเลือกเหล่านี้ได้
                              </p>
                            )}
                            <button
                              className="demo-primary"
                              disabled={
                                !isClosed(trip) || !leaders(trip).length
                              }
                            >
                              {trip.plan ? "ยืนยันแผนใหม่" : "ยืนยันแผนทริป"}
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
                          เลือกที่เที่ยว <Icon name="arrow" size={18} />
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
                          {isClosed(trip) ? "ปิดโหวตแล้ว" : "เปิดโหวต"}
                        </span>
                      </div>
                      {leaders(trip).length > 1 && (
                        <p className="demo-tie">
                          มี {leaders(trip).length} สถานที่คะแนนนำเท่ากัน
                          หัวห้องจะตัดสินหลังปิดโหวต
                        </p>
                      )}
                      {trip.places.length === 0 && (
                        <p>ยังไม่มีข้อเสนอ ลองเพิ่มสถานที่แรกของทริป</p>
                      )}
                      {trip.places.map((p) => (
                        <article className="demo-place" key={p.id}>
                          <div className="demo-place-thumb">
                            {p.id === "doi" || p.id === "mae" ? (
                              <Image
                                src={
                                  p.id === "doi"
                                    ? "/mockup/mountain.jpg"
                                    : "/mockup/chiang-mai.jpg"
                                }
                                alt="ภาพบรรยากาศภูเขาประกอบข้อเสนอ"
                                fill
                                sizes="100px"
                                unoptimized
                              />
                            ) : (
                              <Icon name="pin" size={28} />
                            )}
                          </div>
                          <div>
                            <h3>{p.name}</h3>
                            <p>{p.detail}</p>
                            <small>เสนอโดย {person(p.author)?.name}</small>
                            <div className="demo-vote-bar">
                              <span
                                style={{
                                  width: `${(p.votes.length / trip.members.length) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="demo-place-vote">
                            <b>{p.votes.length} เสียง</b>
                            <button
                              aria-pressed={p.votes.includes(me.id)}
                              disabled={isClosed(trip)}
                              onClick={() =>
                                patchTrip((t) => ({
                                  ...t,
                                  places: t.places.map((x) =>
                                    x.id === p.id
                                      ? {
                                          ...x,
                                          votes: x.votes.includes(me.id)
                                            ? x.votes.filter(
                                                (id) => id !== me.id,
                                              )
                                            : [...x.votes, me.id],
                                        }
                                      : x,
                                  ),
                                }))
                              }
                            >
                              <Icon
                                name={
                                  p.votes.includes(me.id) ? "check" : "plus"
                                }
                                size={17}
                              />
                              {p.votes.includes(me.id) ? "เลือกแล้ว" : "เลือก"}
                            </button>
                          </div>
                        </article>
                      ))}
                      <details
                        className="demo-proposal"
                        open={trip.places.length === 0}
                      >
                        <summary>
                          <Icon name="plus" /> เสนอสถานที่
                        </summary>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (isClosed(trip)) return;
                            const form = e.currentTarget;
                            const data = new FormData(form);
                            const name = String(data.get("place")).trim();
                            if (!name) return;
                            patchTrip((t) => ({
                              ...t,
                              places: [
                                ...t.places,
                                {
                                  id: uid(),
                                  name,
                                  detail: String(data.get("detail")).trim(),
                                  author: me.id,
                                  votes: [],
                                },
                              ],
                            }));
                            form.reset();
                            setNotice("เพิ่มสถานที่แล้ว ชวนเพื่อนมาโหวตได้เลย");
                          }}
                        >
                          <label>
                            สถานที่
                            <input
                              name="place"
                              required
                              maxLength={80}
                              disabled={isClosed(trip)}
                              placeholder="ชื่อสถานที่ที่อยากไป"
                            />
                          </label>
                          <details className="demo-optional">
                            <summary>เพิ่มรายละเอียด</summary>
                            <label>
                              ทำไมถึงอยากไป
                              <input
                                name="detail"
                                maxLength={200}
                                disabled={isClosed(trip)}
                                placeholder="กิจกรรม บรรยากาศ หรือข้อมูลสั้น ๆ"
                              />
                            </label>
                          </details>
                          <button disabled={isClosed(trip)}>
                            เพิ่มข้อเสนอ
                          </button>
                        </form>
                      </details>
                    </>
                  )}
                  {tab === 2 && (
                    <div className="demo-task-footer">
                      <span>
                        {trip.places.some((p) => p.votes.includes(me.id))
                          ? "บันทึกคะแนนแล้ว"
                          : "เลือกสถานที่ที่อยากไป"}
                      </span>
                      <button
                        className="demo-primary"
                        disabled={
                          owner && !isClosed(trip) && !leaders(trip).length
                        }
                        onClick={() => {
                          if (owner && !isClosed(trip))
                            setPending({
                              text: "ปิดโหวตและสรุปทริป? เพื่อนจะเปลี่ยนคะแนนไม่ได้",
                              run: () => {
                                patchTrip((t) =>
                                  system(
                                    { ...t, closed: true },
                                    "หัวห้องปิดโหวตแล้ว",
                                  ),
                                );
                                setTab(0);
                              },
                            });
                          else setTab(0);
                        }}
                      >
                        {owner && !isClosed(trip) ? "สรุปทริป" : "เสร็จแล้ว"}
                        <Icon name="arrow" size={18} />
                      </button>
                    </div>
                  )}
                  {tab === 3 && chat(trip)}
                  {tab === 4 && (
                    <>
                      <h2>เพื่อนร่วมทริป</h2>
                      {owner && (
                        <div className="demo-invite">
                          <h3>ชวนเพื่อนเข้าห้อง</h3>
                          <label>
                            ลิงก์เชิญ
                            <input
                              readOnly
                              value={`${typeof location === "undefined" ? "" : location.origin}/mockup?invite=${trip.invite}`}
                            />
                          </label>
                          <p>
                            {trip.inviteActive
                              ? "ลิงก์เปิดใช้งาน · ใช้กับผู้ใช้จำลองในเบราว์เซอร์นี้"
                              : "ลิงก์ปิดใช้งาน"}
                          </p>
                          <button
                            onClick={() => {
                              navigator.clipboard
                                ?.writeText(
                                  `${location.origin}/mockup?invite=${trip.invite}`,
                                )
                                .then(
                                  () => {
                                    patchTrip((t) => ({
                                      ...t,
                                      inviteShared: true,
                                    }));
                                    setNotice("คัดลอกลิงก์แล้ว");
                                  },
                                  () =>
                                    setNotice(
                                      "คัดลอกไม่ได้ เลือกคัดลอกจากช่องลิงก์ด้านบน",
                                    ),
                                );
                            }}
                          >
                            คัดลอกลิงก์
                          </button>
                          <button
                            onClick={() =>
                              patchTrip((t) => ({
                                ...t,
                                inviteActive: !t.inviteActive,
                              }))
                            }
                          >
                            {trip.inviteActive
                              ? "ปิดลิงก์เชิญ"
                              : "เปิดลิงก์เชิญ"}
                          </button>
                          <button
                            onClick={() => {
                              patchTrip((t) => ({
                                ...t,
                                invite: uid().slice(0, 8),
                                inviteActive: true,
                              }));
                              setNotice(
                                "สร้างลิงก์ใหม่แล้ว ลิงก์เก่าใช้ไม่ได้",
                              );
                            }}
                          >
                            สร้างลิงก์ใหม่
                          </button>
                        </div>
                      )}
                      {trip.members.map((id) => (
                        <div className="demo-member" key={id}>
                          <Avatar person={person(id)} />
                          <div>
                            <b>
                              {person(id).name}
                              {id === me.id ? " (คุณ)" : ""}
                            </b>
                            <small>
                              {id === trip.owner ? "หัวห้อง" : "สมาชิก"}
                            </small>
                          </div>
                          {owner && id !== me.id && (
                            <div className="demo-actions">
                              <button
                                onClick={() =>
                                  setPending({
                                    text: `เตะ ${person(id).name} ออก? คะแนนและการตอบรับจะถูกถอน แต่ใช้คำเชิญใหม่เข้าซ้ำได้`,
                                    run: () =>
                                      patchTrip((t) =>
                                        system(
                                          removeMember(t, me.id, id, false),
                                          `${person(id).name} ถูกนำออกจากห้อง`,
                                        ),
                                      ),
                                  })
                                }
                              >
                                เตะออก
                              </button>
                              <button
                                className="demo-danger"
                                onClick={() =>
                                  setPending({
                                    text: `แบน ${person(id).name}? จะเข้าซ้ำด้วยลิงก์ไม่ได้จนกว่าจะปลดแบน`,
                                    run: () =>
                                      patchTrip((t) =>
                                        system(
                                          removeMember(t, me.id, id, true),
                                          `${person(id).name} ถูกแบนจากห้อง`,
                                        ),
                                      ),
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
                          {trip.banned.length === 0 && (
                            <p>ยังไม่มีบัญชีที่ถูกแบน</p>
                          )}
                          {trip.banned.map((id) => (
                            <div className="demo-row" key={id}>
                              <span>{person(id).name}</span>
                              <button
                                onClick={() =>
                                  patchTrip((t) => ({
                                    ...t,
                                    banned: t.banned.filter((x) => x !== id),
                                  }))
                                }
                              >
                                ปลดแบน
                              </button>
                            </div>
                          ))}
                          <hr />
                          <h3>ลบห้องทริป</h3>
                          <p>
                            ถอนนัดจำลองของทุกคนและลบข้อมูลห้องนี้จากเบราว์เซอร์
                          </p>
                          <button
                            className="demo-danger"
                            onClick={() =>
                              setPending({
                                text: `ลบห้อง “${trip.name}” พร้อมแชท คะแนน และนัดจำลองของทุกคน? ย้อนกลับไม่ได้ ยกเว้นรีเซ็ตข้อมูล`,
                                run: () => {
                                  setState((s) => ({
                                    ...s,
                                    trips: s.trips.filter(
                                      (t) => t.id !== trip.id,
                                    ),
                                  }));
                                  setView("home");
                                  setNotice("ลบห้องและถอนนัดจำลองแล้ว");
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
              </div>
            </>
          )}
        </main>
      )}
      <footer className="demo-footer">
        WePlanGo · ต้นแบบทดลอง
        {state.signedIn && (
          <button onClick={() => setState((s) => ({ ...s, signedIn: false }))}>
            ออกจากระบบจำลอง
          </button>
        )}
      </footer>
      {pending && (
        <div className="demo-modal-backdrop">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="demo-confirm-title"
            className="demo-modal"
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const buttons =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                const index = Array.from(buttons).indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                buttons[
                  (index + (e.shiftKey ? buttons.length - 1 : 1)) %
                    buttons.length
                ].focus();
              }
            }}
          >
            <h2 id="demo-confirm-title">ยืนยันการทำรายการ</h2>
            <p>{pending.text}</p>
            <div className="demo-actions">
              <button autoFocus onClick={() => setPending(null)}>
                ยกเลิก
              </button>
              <button
                className="demo-primary"
                onClick={() => {
                  const run = pending.run;
                  setPending(null);
                  run();
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
