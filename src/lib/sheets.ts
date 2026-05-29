// Google Sheets sync helper
// Saves any lead to your Google Sheets webhook

export async function syncToSheets(lead: {
  id?: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  project?: string;
  budget?: string;
  location?: string;
  source?: string;
  status?: string;
  notes?: string;
  assignedTo?: string;
  clientId?: string;
  followUpDate?: string;
}) {
  // Get webhook URL from localStorage (set in Settings page)
  const webhookUrl = localStorage.getItem("sheetsWebhookUrl");
  if (!webhookUrl) return; // No webhook configured — skip silently

  try {
    await fetch(webhookUrl, {
      method: "POST",
      mode:   "no-cors", // Required for Google Apps Script
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id:           lead.id || "",
        name:         `${lead.firstName} ${lead.lastName || ""}`.trim(),
        firstName:    lead.firstName,
        lastName:     lead.lastName || "",
        phone:        lead.phone,
        email:        lead.email || "",
        project:      lead.project || "",
        budget:       lead.budget || "",
        location:     lead.location || "",
        source:       lead.source || "Manual",
        status:       lead.status || "New Inquiry",
        notes:        lead.notes || "",
        clientId:     lead.clientId || "",
        assignedTo:   lead.assignedTo || "",
        followUpDate: lead.followUpDate || "",
        createdAt:    new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.warn("Sheets sync failed:", e);
  }
}