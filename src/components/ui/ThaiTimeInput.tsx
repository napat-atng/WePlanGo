"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
};

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

/** Explicit numeric options keep the visible clock independent of browser locale. */
export function ThaiTimeInput({ value, onChange, required, disabled }: Props) {
  const [hour = "", minute = ""] = value.split(":");

  return <span className="thai-time-field" role="group" aria-label="เวลา (24 ชั่วโมง)">
    <select aria-label="ชั่วโมง (00–23)" value={hour} required={required} disabled={disabled}
      onChange={(event) => onChange(`${event.target.value}:${minute || "00"}`)}>
      <option value="" disabled>ชั่วโมง</option>
      {hours.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
    <span aria-hidden="true">:</span>
    <select aria-label="นาที (00–59)" value={minute} required={required} disabled={disabled}
      onChange={(event) => onChange(`${hour || "00"}:${event.target.value}`)}>
      <option value="" disabled>นาที</option>
      {minutes.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
    <span className="thai-time-unit" aria-hidden="true">น.</span>
  </span>;
}
