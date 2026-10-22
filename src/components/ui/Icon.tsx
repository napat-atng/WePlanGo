import type { CSSProperties } from "react";

export type IconName =
  | "home"
  | "calendar"
  | "pin"
  | "chat"
  | "users"
  | "check"
  | "plus"
  | "arrow"
  | "copy"
  | "send"
  | "close"
  | "mountain"
  | "sun"
  | "clock"
  | "chevron";
const paths: Record<IconName, string> = {
  chevron: "m6 9 6 6 6-6",
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  calendar:
    "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m3 11h2m4 0h2m-8 4h2",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  chat: "M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4ZM8 10h8m-8 4h5",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M13 3a4 4 0 0 1 0 8M5 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  copy: "M9 9h12v12H9ZM15 5V3H3v12h2",
  send: "m22 2-7 20-4-9L2 9Zm0 0L11 13",
  close: "m6 6 12 12M6 18 18 6",
  mountain: "m2 20 7-14 5 8 3-5 5 11Zm4-8 3 2 2-2",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M7 12a5 5 0 1 0 10 0 5 5 0 0 0-10 0",
  clock: "M12 8v5l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0",
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      className="demo-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
