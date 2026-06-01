// ─────────────────────────────────────────────────────────────────────────────
// FollowUpDashboard.tsx  —  shows all scheduled follow-ups in one view
// Drop into src/components/FollowUpDashboard.tsx
// Usage: <FollowUpDashboard onContact={(lead) => openWhatsApp(lead)} />
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  getAllFollowUps,
  cancelFollowUp,
  checkAndNotifyDueFollowUps,
} from "../utils/leadUtils";

interface FollowUpRecord {
  leadId: string;
  leadName: string;
  phone?: string;
  email?: string;
  nextFollowUpAt: string;
}

interface Props {
  onWhatsApp?: (leadId: string) => void;
  onEmail?: (leadId: string) => void;
}

export const FollowUpDashboard: React.FC<Props> = ({ onWhatsApp, onEmail }) => {
  const [records, setRecords] = useState<FollowUpRecord[]>([]);

  const reload = () => {
    const all = getAllFollowUps().sort(
      (a, b) => new Date(a.nextFollowUpAt).getTime() - new Date(b.nextFollowUpAt).getTime()
    );
    setRecords(all);
  };

  useEffect(() => {
    reload();
    checkAndNotifyDueFollowUps(); // request notification permission + show due alerts
  }, []);

  const cancel = (leadId: string) => {
    cancelFollowUp(leadId);
    reload();
  };

  const daysLabel = (iso: string) => {
    const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
    if (diff < 0)  return { text: `Overdue ${Math.abs(diff)}d`, color: "#ef4444", bg: "#fef2f2" };
    if (diff === 0) return { text: "Due today",  color: "#f59e0b", bg: "#fffbeb" };
    return { text: `In ${diff} days`, color: "#10b981", bg: "#f0fdf4" };
  };

  if (records.length === 0) return (
    <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
      No follow-ups scheduled. After contacting a lead via WhatsApp or Email,
      a 10-day follow-up reminder will appear here automatically.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {records.map(r => {
        const lbl = daysLabel(r.nextFollowUpAt);
        return (
          <div key={r.leadId} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderRadius: "10px",
            border: "1px solid #e5e7eb", background: "#fff",
            flexWrap: "wrap", gap: "8px",
          }}>
            <div style={{ flex: 1, minWidth: "140px" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "#111827" }}>{r.leadName}</div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                {new Date(r.nextFollowUpAt).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric"
                })}
              </div>
            </div>

            <span style={{
              fontSize: "12px", fontWeight: 700, color: lbl.color,
              background: lbl.bg, padding: "3px 10px", borderRadius: "20px",
            }}>
              🔔 {lbl.text}
            </span>

            <div style={{ display: "flex", gap: "6px" }}>
              {r.phone && (
                <button onClick={() => onWhatsApp?.(r.leadId)} style={actionBtn("#25D366")} title="WhatsApp">
                  WA
                </button>
              )}
              {r.email && (
                <button onClick={() => onEmail?.(r.leadId)} style={actionBtn("#3b82f6")} title="Email">
                  ✉
                </button>
              )}
              <button onClick={() => cancel(r.leadId)} style={actionBtn("#ef4444")} title="Cancel follow-up">
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const actionBtn = (bg: string): React.CSSProperties => ({
  background: bg, color: "#fff", border: "none",
  width: "30px", height: "30px", borderRadius: "6px",
  fontSize: "13px", fontWeight: 700, cursor: "pointer",
});

export default FollowUpDashboard;