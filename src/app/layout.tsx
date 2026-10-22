import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "@/components/ui/thai-date.css";

export const metadata: Metadata = {
  title: "WePlanGo",
  description: "วางแผนทริปกับเพื่อนในที่เดียว",
};
export const maxDuration = 60;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
