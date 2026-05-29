import { useFirebase } from "../contexts/FirebaseProvider";
import { auth, db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { LogOut, User, Shield, Building2, Copy, Check, ExternalLink, Save } from "lucide-react";

export default function Settings() {
  const { user, role, plan, clientId } = useFirebase();
  const [sheetsUrl, setSheetsUrl]       = useState("");
  const [saved, setSaved]               = useState(false);
  const [copied, setCopied]             = useState(false);

  const publicFormUrl = clientId
    ? `${window.location.origin}/form/${clientId}`
    : "";

  useEffect(() => {
    const saved = localStorage.getItem("sheetsWebhookUrl") || "";
    setSheetsUrl(saved);
  }, []);

  const saveSheets = async () => {
    localStorage.setItem("sheetsWebhookUrl", sheetsUrl);
    // Also save to Firestore so public form can use it
    if (clientId) {
      try {
        await updateDoc(doc(db, "clients", clientId), {
          sheetsWebhookUrl: sheetsUrl,
        });
      } catch {}
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicFormUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 pb-24 max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              : <User size={24} className="text-gray-400" />
            }
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.displayName || "User"}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 space-y-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</h3>
        <Row icon={Shield}    label="Role"  value={role || "—"} />
        <Row icon={Building2} label="Plan"  value={plan || "—"} />
      </div>

      {/* Public form link — only for clients */}
      {role === "client" && clientId && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Public Lead Form
          </h3>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Share this link in Facebook ads, Instagram bio, WhatsApp — customers fill it and leads appear instantly in the app.
          </p>
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-xs text-gray-600 flex-1 truncate font-mono">{publicFormUrl}</p>
            <button onClick={copyLink} className="p-1.5 text-gray-400 hover:text-emerald-500 transition-colors shrink-0">
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
            <a href={publicFormUrl} target="_blank" rel="noreferrer"
              className="p-1.5 text-gray-400 hover:text-emerald-500 transition-colors shrink-0">
              <ExternalLink size={14} />
            </a>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            📢 For Facebook ads: use this as the "Website URL" in your ad settings
          </p>
        </div>
      )}

      {/* Google Sheets webhook */}
      {(role === "client" || role === "super_admin") && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Google Sheets Sync
          </h3>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Every new lead (from the app, public form, or WhatsApp) gets saved to your Google Sheet automatically.
          </p>
          <input
            type="url"
            value={sheetsUrl}
            onChange={e => setSheetsUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 font-mono mb-2"
          />
          <button onClick={saveSheets}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Webhook URL</>}
          </button>

          {/* Setup guide */}
          <details className="mt-3">
            <summary className="text-xs text-emerald-600 font-medium cursor-pointer">
              📋 How to set up Google Sheets sync
            </summary>
            <div className="mt-2 text-xs text-gray-500 space-y-1.5 leading-relaxed">
              <p>1. Open a Google Sheet</p>
              <p>2. Click <strong>Extensions → Apps Script</strong></p>
              <p>3. Delete all code and paste the script below</p>
              <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-[10px] overflow-x-auto mt-2 whitespace-pre-wrap">{`function doPost(e) {
  var data  = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSheet();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "ID","Date","Name","Phone","Email",
      "Project","Budget","Location","Status",
      "Source","Notes","Follow-up Date","Last Updated"
    ]);
  }

  var row = [
    data.id          || "",
    data.createdAt   || new Date().toISOString(),
    data.name        || "",
    data.phone       || "",
    data.email       || "",
    data.project     || "",
    data.budget      || "",
    data.location    || "",
    data.status      || "",
    data.source      || "",
    data.notes       || "",
    data.followUpDate || "",
    new Date().toISOString()
  ];

  var lastRow  = sheet.getLastRow();
  var foundRow = -1;
  if (lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === data.id) { foundRow = i + 2; break; }
    }
  }

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}`}</pre>
              <p>4. Click <strong>Deploy → New Deployment → Web App</strong></p>
              <p>5. Set "Who has access" to <strong>Anyone</strong></p>
              <p>6. Copy the Web App URL and paste above</p>
            </div>
          </details>
        </div>
      )}

      {/* Sign out */}
      <button onClick={() => auth.signOut()}
        className="w-full bg-red-50 hover:bg-red-100 text-red-500 rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-500">
        <Icon size={15} />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-gray-700 capitalize">{value}</span>
    </div>
  );
}
