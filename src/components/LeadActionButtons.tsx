import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { buildWhatsAppMessage, buildEmailSubject, buildEmailBody, Lead } from "../utils/leadUtils";

interface Props {
  lead: Lead;
  onFollowUpUpdated?: () => void;
}

export const LeadActionButtons: React.FC<Props> = ({ lead, onFollowUpUpdated }) => {
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showEmailModal, setShowEmailModal]       = useState(false);
  const [waMessage, setWaMessage]                 = useState("");
  const [emailSubject, setEmailSubject]           = useState("");
  const [emailBody, setEmailBody]                 = useState("");

  const openWAModal = () => {
    setWaMessage(buildWhatsAppMessage(lead));
    setShowWhatsAppModal(true);
  };

  const openEmailModal = () => {
    setEmailSubject(buildEmailSubject(lead));
    setEmailBody(buildEmailBody(lead));
    setShowEmailModal(true);
  };

  // Auto-set follow-up date to today + 10 days in Firestore
  const setFollowUpIn10Days = async () => {
    if (!lead.id) return;
    const next = new Date();
    next.setDate(next.getDate() + 10);
    const nextDate = next.toISOString().split("T")[0];
    try {
      await updateDoc(doc(db, "leads", lead.id), { followUpDate: nextDate });
      onFollowUpUpdated?.();
    } catch (e) { console.warn("follow-up update:", e); }
  };

  const sendWhatsApp = async () => {
    let phone = (lead.phone || "").replace(/\D/g, "");
    if (!phone || phone.length < 7) { alert("Invalid phone number: " + lead.phone); return; }
    const text = waMessage || buildWhatsAppMessage(lead);
    window.open(
      "https://api.whatsapp.com/send?phone=" + phone + "&text=" + encodeURIComponent(text),
      "_blank"
    );
    setShowWhatsAppModal(false);
    await setFollowUpIn10Days(); // ← updates Firestore follow-up date
  };

  const sendEmail = async () => {
    if (!lead.email) { alert("No email address for this lead."); return; }
    const subject = emailSubject || buildEmailSubject(lead);
    const body    = emailBody    || buildEmailBody(lead);
    window.open(
      "mailto:" + lead.email
        + "?subject=" + encodeURIComponent(subject)
        + "&body="    + encodeURIComponent(body),
      "_blank"
    );
    setShowEmailModal(false);
    await setFollowUpIn10Days(); // ← updates Firestore follow-up date
  };

  return (
    <>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>

        {/* WhatsApp */}
        <button onClick={openWAModal} style={btnStyle("#25D366")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L.054 23.25a.75.75 0 00.916.916l5.386-1.479A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.713 9.713 0 01-4.953-1.354l-.355-.212-3.668 1.007 1.007-3.668-.212-.355A9.713 9.713 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
          </svg>
          WhatsApp
        </button>

        {/* Email */}
        <button onClick={openEmailModal} style={btnStyle("#3b82f6")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Email
        </button>

      </div>

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <Modal title="Send WhatsApp" onClose={() => setShowWhatsAppModal(false)}>
          <p style={toStyle}>To: {lead.phone || "No phone number"}</p>
          <textarea value={waMessage} onChange={e => setWaMessage(e.target.value)} rows={9} style={textareaStyle} />
          <p style={{ fontSize: "11px", color: "#9ca3af", margin: "8px 0 0" }}>
            📅 Sending will auto-set follow-up to 10 days from today
          </p>
          <div style={footerStyle}>
            <button onClick={() => setShowWhatsAppModal(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={sendWhatsApp} style={btnStyle("#25D366")}>Open WhatsApp ↗</button>
          </div>
        </Modal>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <Modal title="Send Email" onClose={() => setShowEmailModal(false)}>
          <p style={toStyle}>To: {lead.email || "No email"}</p>
          <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Subject"
            style={{ ...textareaStyle, height: "38px", marginBottom: "8px" }} />
          <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={10} style={textareaStyle} />
          <p style={{ fontSize: "11px", color: "#9ca3af", margin: "8px 0 0" }}>
            📅 Sending will auto-set follow-up to 10 days from today
          </p>
          <div style={footerStyle}>
            <button onClick={() => setShowEmailModal(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={sendEmail} style={btnStyle("#3b82f6")}>Open Email ↗</button>
          </div>
        </Modal>
      )}
    </>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:"16px" }}>
    <div style={{ background:"#fff", borderRadius:"14px", padding:"24px", width:"100%", maxWidth:"500px", boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
        <h3 style={{ margin:0, fontSize:"16px", fontWeight:700 }}>{title}</h3>
        <button onClick={onClose} style={{ background:"none", border:"none", fontSize:"22px", cursor:"pointer", color:"#6b7280", lineHeight:1 }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const btnStyle = (bg: string): React.CSSProperties => ({
  display:"inline-flex", alignItems:"center", gap:"6px",
  background:bg, color:"#fff", border:"none",
  padding:"7px 14px", borderRadius:"8px", fontSize:"13px", fontWeight:600, cursor:"pointer",
});
const cancelBtnStyle: React.CSSProperties = {
  background:"#f3f4f6", color:"#374151", border:"none",
  padding:"7px 14px", borderRadius:"8px", fontSize:"13px", fontWeight:600, cursor:"pointer",
};
const textareaStyle: React.CSSProperties = {
  width:"100%", padding:"10px 12px", borderRadius:"8px",
  border:"1px solid #e5e7eb", fontSize:"13px", lineHeight:"1.6",
  resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", display:"block",
};
const toStyle: React.CSSProperties = { margin:"0 0 8px", fontSize:"12px", color:"#6b7280", fontWeight:500 };
const footerStyle: React.CSSProperties = { display:"flex", gap:"10px", justifyContent:"flex-end", marginTop:"16px" };

export default LeadActionButtons;