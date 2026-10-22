"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatThaiDate } from "@/lib/thai-date";
import { ThaiTimeInput } from "./ThaiTimeInput";

const months = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month, 1))),
);

type Props = {
  id?: string;
  name?: string;
  type?: "date" | "datetime-local";
  value?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (event: { target: { value: string } }) => void;
};

/** Thai display only; form submissions retain ISO dates and local wall times. */
export function ThaiDateInput({ id, name, type = "date", value, defaultValue = "", min, max, required, disabled, onChange }: Props) {
  const generatedId = useId();
  const root = useRef<HTMLSpanElement>(null);
  const displayInput = useRef<HTMLInputElement>(null);
  const validationInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(defaultValue);
  const current = value ?? draft;
  const [open, setOpen] = useState(false);
  const initialMonth = (current || min || new Date().toISOString()).slice(0, 7);
  const [view, setView] = useState(initialMonth);
  const [year, month] = view.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const display = current ? formatThaiDate(current) : "";
  useEffect(() => {
    validationInput.current?.setCustomValidity(current && ((min && current < min) || (max && current > max))
      ? "กรุณาเลือกวันที่และเวลาในช่วงที่กำหนด" : "");
  }, [current, min, max]);

  function update(next: string) {
    setDraft(next);
    onChange?.({ target: { value: next } });
  }

  return <span className="thai-date-field" ref={root} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key === "Escape") { event.stopPropagation(); setOpen(false); displayInput.current?.focus(); }
  }}>
    <input type="hidden" name={name} value={current} disabled={disabled} />
    <input ref={displayInput} id={id ?? generatedId} className="thai-date-display" type="text" value={display}
      placeholder="เลือกวัน เดือน ปี" readOnly inputMode="none" aria-required={required} disabled={disabled}
      role="combobox" aria-autocomplete="none" aria-readonly="true" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${generatedId}-calendar` : undefined}
      onClick={() => { setView(initialMonth); setOpen(!open); }}
      onKeyDown={(event) => { if (["Enter", " ", "ArrowDown"].includes(event.key)) { event.preventDefault(); setView(initialMonth); setOpen(true); } }}
      />
    {/* Read-only controls do not participate in native required validation. */}
    <input ref={validationInput} className="thai-date-validation" type="text" value={current}
      required={required} disabled={disabled} tabIndex={-1} aria-hidden="true" onChange={() => {}}
      onInvalid={(event) => {
        event.preventDefault();
        setView(initialMonth);
        setOpen(true);
        displayInput.current?.focus();
      }} />
    {type === "datetime-local" && <ThaiTimeInput required={required} disabled={disabled}
      value={current.slice(11, 16)} onChange={(time) => {
        update(`${current.slice(0, 10) || view + "-01"}T${time}`);
      }} />}
    {open && <span id={`${generatedId}-calendar`} className="thai-date-popover" role="dialog" aria-label="เลือกวันที่ภาษาไทย">
      <span className="thai-date-heading">
        <select aria-label="เดือน" value={month} onChange={(event) => setView(`${year}-${event.target.value.padStart(2, "0")}`)}>
          {months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
        </select>
        <select aria-label="ปี พ.ศ." value={year} onChange={(event) => setView(`${event.target.value}-${String(month).padStart(2, "0")}`)}>
          {Array.from({ length: Math.max(21, Number(max?.slice(0, 4) || year + 10) - Number(min?.slice(0, 4) || year - 10) + 1) }, (_, index) => Number(min?.slice(0, 4) || year - 10) + index).map((item) => <option key={item} value={item}>{item + 543}</option>)}
        </select>
      </span>
      <span className="thai-date-grid">
        {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((day) => <span key={day}>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const date = `${view}-${String(index + 1).padStart(2, "0")}`;
          return <button key={date} type="button" disabled={!!((min && date < min.slice(0, 10)) || (max && date > max.slice(0, 10)))}
            aria-label={`${index + 1} ${months[month - 1]} ${year + 543}`} aria-pressed={current.slice(0, 10) === date}
            onClick={() => { update(type === "date" ? date : `${date}T${current.slice(11, 16) || "09:00"}`); setOpen(false); displayInput.current?.focus(); }}>{index + 1}</button>;
        })}
      </span>
      <button type="button" className="thai-date-close" onClick={() => { setOpen(false); displayInput.current?.focus(); }}>ปิดปฏิทิน</button>
    </span>}
  </span>;
}
