"use client";

import { useEffect } from "react";

/** A bounded, visual-only press response; native clicks and focus stay untouched. */
export function InteractionEffects() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const active = new Set<HTMLElement>();

    function clear() {
      for (const element of active) element.remove();
      active.clear();
    }

    function press(event: PointerEvent) {
      if (preference.matches || event.button !== 0 || !(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>("button, a[href]");
      if (!control || control.matches(":disabled, [aria-disabled='true']")) return;
      const rect = control.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // Cap concurrent overlays during rapid input; they never affect page layout.
      if (active.size >= 4) clear();
      const overlay = document.createElement("span");
      overlay.className = "press-feedback";
      overlay.setAttribute("aria-hidden", "true");
      Object.assign(overlay.style, {
        left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
        borderRadius: getComputedStyle(control).borderRadius,
      });
      const wave = document.createElement("span");
      const diameter = Math.hypot(rect.width, rect.height) * 2;
      Object.assign(wave.style, {
        width: `${diameter}px`, height: `${diameter}px`,
        left: `${event.clientX - rect.left - diameter / 2}px`,
        top: `${event.clientY - rect.top - diameter / 2}px`,
        backgroundColor: getComputedStyle(control).color,
      });
      overlay.append(wave);
      document.body.append(overlay);
      active.add(overlay);
      const animation = wave.animate([
        { transform: "scale(.05)", opacity: .18 },
        { transform: "scale(1)", opacity: 0 },
      ], { duration: 380, easing: "cubic-bezier(.16,1,.3,1)" });
      animation.finished.then(() => { overlay.remove(); active.delete(overlay); }).catch(() => overlay.remove());
    }

    function visibility() { if (document.hidden) clear(); }
    document.addEventListener("pointerdown", press, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("scroll", clear, { passive: true, capture: true });
    preference.addEventListener("change", clear);
    return () => {
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("scroll", clear, true);
      preference.removeEventListener("change", clear);
      clear();
    };
  }, []);
  return null;
}
