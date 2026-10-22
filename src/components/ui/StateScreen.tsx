import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function StateScreen({ title, description, icon = "pin", children }: {
  title: string;
  description: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return <main className="page state-page">
    <section className="auth-card state-card">
      <div className="brand"><span className="state-brand-mark"><Icon name="mountain" size={24} /></span>WePlanGo</div>
      <div className="state-emblem" aria-hidden="true"><Icon name={icon} size={34} /></div>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="state-actions">{children}</div>
    </section>
  </main>;
}
