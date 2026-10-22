"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";

const months = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const shortMonths = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [year, month] = value.split("-").map(Number);
  const [open, setOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState(year);
  const [focusIndex, setFocusIndex] = useState(month - 1);
  const dialogId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const monthGrid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      monthGrid.current
        ?.querySelector<HTMLButtonElement>('[tabindex="0"]')
        ?.focus(),
    );
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  function shiftMonth(delta: number) {
    const date = new Date(0);
    date.setFullYear(year, month - 1 + delta, 1);
    if (date.getFullYear() < 1 || date.getFullYear() > 9999) return;
    onChange(
      `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
    setOpen(false);
  }

  return (
    <div
      className="demo-month-picker"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className="demo-month-control">
        <button
          type="button"
          className="demo-month-arrow"
          aria-label="เดือนก่อนหน้า"
          onClick={() => shiftMonth(-1)}
        >
          <Icon
            name="arrow"
            size={17}
            style={{ transform: "rotate(180deg)" }}
          />
        </button>
        <button
          ref={trigger}
          type="button"
          className="demo-month-trigger"
          aria-label={`เดือนปฏิทิน ${months[month - 1]} ${year + 543}`}
          aria-haspopup="dialog"
          aria-controls={open ? dialogId : undefined}
          aria-expanded={open}
          onClick={() => {
            if (!open) {
              setDisplayYear(year);
              setFocusIndex(month - 1);
            }
            setOpen(!open);
          }}
        >
          <Icon name="calendar" size={18} />
          <span>
            {months[month - 1]} {year + 543}
          </span>
          <Icon
            name="chevron"
            size={15}
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          />
        </button>
        <button
          type="button"
          className="demo-month-arrow"
          aria-label="เดือนถัดไป"
          onClick={() => shiftMonth(1)}
        >
          <Icon name="arrow" size={17} />
        </button>
      </div>
      {open && (
        <div
          className="demo-month-popover"
          id={dialogId}
          role="dialog"
          aria-label="เลือกเดือนปฏิทิน"
        >
          <div className="demo-month-year">
            <button
              type="button"
              aria-label="ปีก่อนหน้า"
              disabled={displayYear <= 1}
              onClick={() => setDisplayYear(displayYear - 1)}
            >
              <Icon
                name="arrow"
                size={17}
                style={{ transform: "rotate(180deg)" }}
              />
            </button>
            <strong aria-live="polite">{displayYear + 543}</strong>
            <button
              type="button"
              aria-label="ปีถัดไป"
              disabled={displayYear >= 9999}
              onClick={() => setDisplayYear(displayYear + 1)}
            >
              <Icon name="arrow" size={17} />
            </button>
          </div>
          <div className="demo-month-grid" ref={monthGrid}>
            {shortMonths.map((label, index) => (
              <button
                key={label}
                type="button"
                tabIndex={focusIndex === index ? 0 : -1}
                aria-label={`${months[index]} ${displayYear + 543}`}
                aria-pressed={displayYear === year && index === month - 1}
                onFocus={() => setFocusIndex(index)}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % 12
                      : event.key === "ArrowLeft"
                        ? (index + 11) % 12
                        : event.key === "ArrowDown"
                          ? (index + 3) % 12
                          : event.key === "ArrowUp"
                            ? (index + 9) % 12
                            : event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? 11
                                : null;
                  if (next === null) return;
                  event.preventDefault();
                  monthGrid.current
                    ?.querySelectorAll<HTMLButtonElement>("button")
                    [next].focus();
                }}
                onClick={() => {
                  onChange(
                    `${String(displayYear).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`,
                  );
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
