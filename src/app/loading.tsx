import { Icon } from "@/components/ui/Icon";
import "@/components/ui/workspace.css";

export default function Loading() {
  return <div className="demo-app workspace-loading">
    <header className="demo-header">
      <div className="demo-brand"><span className="demo-brand-mark"><Icon name="mountain" size={24} /></span>WePlanGo</div>
    </header>
    <main className="loading-workspace" aria-busy="true" aria-label="กำลังโหลดพื้นที่วางแผนทริป">
      <p role="status">กำลังเตรียมทริปของคุณ…</p>
      <div className="loading-cover skeleton" aria-hidden="true" />
      <div className="loading-tabs" aria-hidden="true">{[0, 1, 2, 3, 4].map((item) => <span className="skeleton" key={item} />)}</div>
      <div className="loading-columns" aria-hidden="true">
        <div className="demo-panel"><div className="skeleton loading-title" />{[0, 1, 2].map((item) => <div className="skeleton loading-row" key={item} />)}</div>
        <div className="demo-panel"><div className="skeleton loading-title" /><div className="skeleton loading-row" /></div>
      </div>
    </main>
  </div>;
}
