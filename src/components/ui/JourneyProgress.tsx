import type { CSSProperties } from "react";
import { Icon } from "./Icon";

const steps = ["ชวนเพื่อน", "เลือกวัน", "เลือกที่เที่ยว", "สรุปแผน", "ตอบรับ"];

export function JourneyProgress({ stage }: { stage: number }) {
  return <div className="journey-progress">
    <p>ขั้นตอน {stage + 1}/5 · <strong>{steps[stage]}</strong></p>
    <div className="journey-route" aria-hidden="true" style={{ "--journey-step": stage } as CSSProperties}>
      {steps.map((step, index) => <span className="journey-stop" key={step} data-active={stage === index} />)}
      <span className="journey-marker"><Icon name="pin" size={18} /></span>
    </div>
  </div>;
}
