import type { Metadata } from "next";
import type { ReactNode } from "react";
import { InteractionEffects } from "@/components/ui/InteractionEffects";
import "./globals.css";
import "@/components/ui/thai-date.css";
import "@/components/ui/motion.css";

export const metadata: Metadata = {
  title: "WePlanGo",
  description: "วางแผนทริปกับเพื่อนในที่เดียว",
};
export const maxDuration = 60;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}<InteractionEffects /></body>
    </html>
  );
}
