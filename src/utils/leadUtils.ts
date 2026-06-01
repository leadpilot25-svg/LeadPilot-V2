export interface Lead {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  propertyInterest?: string;
  budget?: string;
  agentName?: string;
  lastContactedAt?: string;
  nextFollowUpAt?: string;
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

export function openWhatsApp(lead: Lead, customMessage?: string) {
  let phone = (lead.phone || "").replace(/\D/g, "");
  if (!phone || phone.length < 7) { alert("Invalid phone number: " + lead.phone); return; }

  const message = customMessage || buildWhatsAppMessage(lead);

  // Use api.whatsapp.com/send which reliably prefills the message on all devices
  const url = "https://api.whatsapp.com/send?phone=" + phone + "&text=" + encodeURIComponent(message);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function buildWhatsAppMessage(lead: Lead): string {
  const name = lead.name || ((lead as any).firstName ? `${(lead as any).firstName} ${(lead as any).lastName || ""}`.trim() : "there");
  return `Hi ${name},

Are you looking for a natural alternative to refined sugar for your bakery?

Treen Foods Palm Sugar, Coconut Sugar & Palm Candy add a rich taste that makes cakes, cookies, breads, and desserts even more delicious.

Would you be interested in our sample packs or special Baker's packs and pricing?

Looking forward to hearing from you! 😊
${lead.agentName ? "\n— " + lead.agentName + ", Treen Foods" : "\n— Treen Foods"}`;
}

// ─── Email ───────────────────────────────────────────────────────────────────

export function openEmail(lead: Lead, customSubject?: string, customBody?: string) {
  if (!lead.email) { alert("No email address for this lead."); return; }

  const subject = customSubject || buildEmailSubject(lead);
  const body    = customBody    || buildEmailBody(lead);

  const url = "mailto:" + lead.email
    + "?subject=" + encodeURIComponent(subject)
    + "&body="    + encodeURIComponent(body);

  window.location.href = url;
}

export function buildEmailSubject(lead: Lead): string {
  return "Natural Sugar Alternative for Your Bakery – Treen Foods";
}

export function buildEmailBody(lead: Lead): string {
  return `Hi ${lead.name || "there"},

Are you looking for a natural alternative to refined sugar for your bakery?

Treen Foods Palm Sugar, Coconut Sugar & Palm Candy add a rich taste that makes cakes, cookies, breads, and desserts even more delicious.

Would you be interested in our sample packs or special Baker's packs and pricing?

Looking forward to hearing from you!

Best regards,
${lead.agentName || "Treen Foods Team"}`;
}

// ─── 10-day follow-up (localStorage + Notification API) ──────────────────────

const FOLLOWUP_KEY = "leadpilot_followups";

interface FollowUpRecord {
  leadId: string;
  leadName: string;
  phone?: string;
  email?: string;
  nextFollowUpAt: string;
}

function loadFollowUps(): FollowUpRecord[] {
  try { return JSON.parse(localStorage.getItem(FOLLOWUP_KEY) || "[]"); }
  catch { return []; }
}

function saveFollowUps(records: FollowUpRecord[]) {
  localStorage.setItem(FOLLOWUP_KEY, JSON.stringify(records));
}

export function scheduleFollowUp(lead: Lead): Date {
  const records = loadFollowUps().filter(r => r.leadId !== lead.id);
  const next = new Date();
  next.setDate(next.getDate() + 10);
  records.push({
    leadId: lead.id, leadName: lead.name,
    phone: lead.phone, email: lead.email,
    nextFollowUpAt: next.toISOString(),
  });
  saveFollowUps(records);
  return next;
}

export function cancelFollowUp(leadId: string) {
  saveFollowUps(loadFollowUps().filter(r => r.leadId !== leadId));
}

export function getDueFollowUps(): FollowUpRecord[] {
  return loadFollowUps().filter(r => new Date(r.nextFollowUpAt) <= new Date());
}

export function getAllFollowUps(): FollowUpRecord[] {
  return loadFollowUps();
}

export function daysUntilFollowUp(leadId: string): number | null {
  const record = loadFollowUps().find(r => r.leadId === leadId);
  if (!record) return null;
  return Math.ceil((new Date(record.nextFollowUpAt).getTime() - Date.now()) / 86400000);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export async function checkAndNotifyDueFollowUps() {
  const due = getDueFollowUps();
  if (!due.length) return;
  const ok = await requestNotificationPermission();
  if (!ok) return;
  due.forEach(r => {
    const n = new Notification("Treen Foods – Follow-up Due", {
      body: `Time to follow up with ${r.leadName}!`,
      icon: "/favicon.ico",
      tag:  "followup-" + r.leadId,
    });
    n.onclick = () => { window.focus(); n.close(); };
  });
}