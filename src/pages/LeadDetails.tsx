import { syncToSheets } from "../lib/sheets";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useFirebase } from "../contexts/FirebaseProvider";
import { ArrowLeft, Phone, MessageCircle, Mail, Trash2, ChevronDown, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import Modal from "../components/Modal";

const STATUSES = [
  { label: "New Inquiry",          value: "new" },
  { label: "Contacted",            value: "contacted" },
  { label: "Meeting",              value: "meeting" },
  { label: "Site Visit Scheduled", value: "site_visit" },
  { label: "Site Visit Postponed", value: "site_visit_postponed" },
  { label: "Booked",               value: "booked" },
  { label: "Closed",               value: "closed" },
  { label: "Inactive",             value: "inactive" },
];

const NEXT_ACTIONS = [
  { label: "Follow-up Call",      value: "call"       },
  { label: "Send Message",        value: "message"    },
  { label: "Schedule Meeting",    value: "meeting"    },
  { label: "Schedule Site Visit", value: "site_visit" },
  { label: "No Action Needed",    value: "none"       },
];

const TIMES = [
  "08:00 AM","09:00 AM","10:00 AM","11:00 AM","12:00 PM",
  "01:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM",
  "06:00 PM","07:00 PM","08:00 PM",
];

export default function LeadDetails() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user, role, clientId } = useFirebase();

  const [lead, setLead]       = useState<any>(null);
  const [agents, setAgents]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [callModal, setCallModal] = useState(false);
  const [note, setNote]       = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [callNote,       setCallNote]       = useState("");
  const [callStatus,     setCallStatus]     = useState("contacted");
  const [callInterest,   setCallInterest]   = useState("");
  const [callLocation,   setCallLocation]   = useState("");
  const [callBudget,     setCallBudget]     = useState("");
  const [callNextAction, setCallNextAction] = useState("call");
  const [callDate,       setCallDate]       = useState(new Date().toISOString().split("T")[0]);
  const [callTime,       setCallTime]       = useState("10:00 AM");
  const [savingCall,     setSavingCall]     = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "leads", id), snap => {
      if (snap.exists()) {
        const data: any = { id: snap.id, ...snap.data() };
        setLead(data);
        setCallStatus(data.status || "contacted");
        setCallInterest(data.propertyType || "");
        setCallLocation(data.location || "");
        setCallBudget(data.budget || "");
      }
      setLoading(false);
    });

    if (role === "client" && clientId) {
      getDocs(query(collection(db, "users"),
        where("clientId", "==", clientId),
        where("role", "==", "agent")
      )).then(s => setAgents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    return unsub;
  }, [id, role, clientId]);

  const update = (fields: any) => id && updateDoc(doc(db, "leads", id), fields);

  const assignAgent = async (agentUid: string) => {
    await update({ assignedTo: agentUid });
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    const timestamp = new Date().toLocaleDateString("en-IN");
    await update({
      notes: (lead?.notes ? lead.notes + "\n\n" : "") + `[${timestamp}] ${note.trim()}`
    });
    setNote("");
    setSavingNote(false);
  };

  const confirmCallUpdate = async () => {
    if (!id || !user) return;
    setSavingCall(true);
    try {
      const to24 = (t: string) => {
        const [time, meridiem] = t.split(" ");
        let [h, m] = time.split(":").map(Number);
        if (meridiem === "PM" && h !== 12) h += 12;
        if (meridiem === "AM" && h === 12) h = 0;
        return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      };

      const updates: any = {
        status:            callStatus,
        propertyType:      callInterest || lead.propertyType || "",  // ✅ fixed
        location:          callLocation || lead.location || "",       // ✅ fixed
        followUpDate:      callDate,
        followUpTime:      to24(callTime),
        followUpCompleted: false,
      };
      if (callBudget.trim()) updates.budget = callBudget.trim();
      if (callNote.trim()) {
        const ts = new Date().toLocaleDateString("en-IN");
        updates.notes = (lead?.notes ? lead.notes + "\n\n" : "") + `[${ts}] ${callNote.trim()}`;
      }

      await update(updates);

      await syncToSheets({
        id:           id,
        firstName:    lead.firstName,
        lastName:     lead.lastName || "",
        phone:        lead.phone,
        email:        lead.email || "",
        project:      callInterest || lead.propertyType || "",
        budget:       callBudget.trim() || lead.budget || "",
        location:     callLocation || lead.location || "",
        source:       lead.source || "Manual",
        status:       callStatus,
        notes:        updates.notes || lead.notes || "",
        clientId:     clientId || lead.clientId || "",
        followUpDate: callDate,
      });

      await addDoc(collection(db, "activities"), {
        leadId:    id,
        clientId:  clientId || lead.clientId,
        agentId:   user.uid,
        type:      callNextAction,
        note:      callNote.trim(),
        status:    callStatus,
        createdAt: serverTimestamp(),
      });

      setCallNote("");
      setCallModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save update.");
    } finally {
      setSavingCall(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this lead permanently?")) return;
    await deleteDoc(doc(db, "leads", id!));
    navigate("/leads");
  };

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>;
  if (!lead)   return <div className="p-8 text-center text-gray-400 text-sm">Lead not found</div>;

  const isOverdue = lead.followUpDate &&
    lead.followUpDate < new Date().toISOString().split("T")[0] &&
    !["closed","inactive"].includes(lead.status);

  const assignedAgent = agents.find(a => (a.uid || a.id) === lead.assignedTo);
  const agentName     = assignedAgent?.name || (lead.assignedTo ? "Assigned" : "Unassigned");

  const statusColor: Record<string,string> = {
    new: "bg-blue-50 text-blue-600", contacted: "bg-indigo-50 text-indigo-600",
    meeting: "bg-violet-50 text-violet-600", site_visit: "bg-amber-50 text-amber-600",
    site_visit_postponed: "bg-orange-50 text-orange-600",
    booked: "bg-teal-50 text-teal-600",
    closed: "bg-emerald-500 text-white", inactive: "bg-gray-100 text-gray-400",
  };

  return (
    <div className="p-4 pb-24 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl">
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-bold text-gray-900">Lead Profile</h2>
      </div>

      {/* Lead card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 text-center relative">
        <span className={`absolute top-4 right-4 text-[10px] font-medium px-2.5 py-1 rounded-full ${statusColor[lead.status] || "bg-gray-100 text-gray-500"}`}>
          {lead.status === "new" ? "New" : (lead.status||"").replace(/_/g," ")}
        </span>
        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-3">
          {(lead.firstName||"?")[0]}
        </div>
        <h3 className="text-lg font-bold text-gray-900">{lead.firstName} {lead.lastName}</h3>
        <p className="text-sm text-gray-400 mt-0.5">{lead.propertyType} · {lead.budget || "Budget N/A"}</p>
        <div className="flex justify-center gap-4 mt-4">
          <a href={`tel:${lead.phone}`} className="bg-emerald-500 text-white w-11 h-11 rounded-xl flex items-center justify-center shadow-sm hover:opacity-90">
            <Phone size={18} />
          </a>
          <a href={`https://wa.me/${(lead.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
            className="bg-green-400 text-white w-11 h-11 rounded-xl flex items-center justify-center shadow-sm hover:opacity-90">
            <MessageCircle size={18} />
          </a>
          <a href={`mailto:${lead.email}`} className="bg-gray-400 text-white w-11 h-11 rounded-xl flex items-center justify-center shadow-sm hover:opacity-90">
            <Mail size={18} />
          </a>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={() => setCallModal(true)}
          className="bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2">
          <CheckCircle2 size={16} /> Update After Call
        </button>
        <a href={`tel:${lead.phone}`}
          className="bg-emerald-50 text-emerald-600 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2">
          <Phone size={16} /> Call Now
        </a>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 space-y-3">
        <Row label="Phone"       value={lead.phone} />
        <Row label="Follow-up"
          value={lead.followUpDate ? format(new Date(lead.followUpDate+"T00:00:00"), "dd MMM yyyy") : "Not set"}
          color={isOverdue ? "text-red-500" : ""} />
        <Row label="Location"    value={lead.location || "—"} />
        <Row label="Source"      value={lead.source || "—"} />
        <Row label="Assigned to" value={agentName} />
      </div>

      {/* Reassign — client only */}
      {role === "client" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-3">
            Reassign Agent
          </label>
          <div className="relative">
            <select
              value={lead.assignedTo || ""}
              onChange={e => assignAgent(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 outline-none appearance-none border border-gray-100 focus:border-emerald-400"
            >
              <option value="">Unassigned</option>
              {agents.map(a => {
                const uid = a.uid || a.id;
                return <option key={a.id} value={uid}>{a.name || a.email}</option>;
              })}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {agents.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">No agents yet. Add from Admin Center.</p>
          )}
        </div>
      )}

      {/* Follow-up date */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-3">
          Follow-up Date
        </label>
        <input type="date" value={lead.followUpDate || ""}
          onChange={e => update({ followUpDate: e.target.value })}
          className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 outline-none border border-gray-100 focus:border-emerald-400" />
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-3">Notes</label>
        {lead.notes && (
          <p className="text-sm text-gray-600 whitespace-pre-wrap mb-3 leading-relaxed bg-gray-50 rounded-xl p-3">
            {lead.notes}
          </p>
        )}
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Add a note after the call..."
          className="w-full bg-gray-50 rounded-xl p-3 text-sm text-gray-700 outline-none border border-gray-100 focus:border-emerald-400 resize-none min-h-[80px]" />
        <button onClick={saveNote} disabled={savingNote || !note.trim()}
          className="mt-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl px-4 py-2 text-sm font-medium">
          {savingNote ? "Saving..." : "Save Note"}
        </button>
      </div>

      {/* Delete */}
      {role === "client" && (
        <button onClick={handleDelete}
          className="w-full bg-red-50 hover:bg-red-100 text-red-500 rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2">
          <Trash2 size={15} /> Delete Lead
        </button>
      )}

      {/* Update After Call Modal */}
      <Modal isOpen={callModal} onClose={() => setCallModal(false)} title="Update After Call">
        <div className="space-y-4 pb-8">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Call Notes</label>
            <textarea value={callNote} onChange={e => setCallNote(e.target.value)}
              placeholder="What did the client say?"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-emerald-400 resize-none min-h-[90px]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Update Status</label>
              <div className="relative">
                <select value={callStatus} onChange={e => setCallStatus(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-3 py-3 text-sm font-medium text-gray-700 outline-none appearance-none focus:border-emerald-400">
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Property Interest</label>
              <input type="text" value={callInterest} onChange={e => setCallInterest(e.target.value)}
                placeholder="2BHK, Villa, etc"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-3 py-3 text-sm text-gray-700 outline-none focus:border-emerald-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Update Location</label>
            <input type="text" value={callLocation} onChange={e => setCallLocation(e.target.value)}
              placeholder="City / Area"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-emerald-400" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Budget <span className="normal-case text-gray-300 font-normal">(optional)</span></label>
            <input type="text" value={callBudget} onChange={e => setCallBudget(e.target.value)}
              placeholder="e.g. 1.2 Cr"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-emerald-400" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Schedule Next Action</label>
            <div className="relative">
              <select value={callNextAction} onChange={e => setCallNextAction(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 outline-none appearance-none focus:border-emerald-400">
                {NEXT_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Date</label>
              <input type="date" value={callDate} onChange={e => setCallDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-3 py-3 text-sm text-gray-700 outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Time</label>
              <div className="relative">
                <select value={callTime} onChange={e => setCallTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-3 py-3 text-sm text-gray-700 outline-none appearance-none focus:border-emerald-400">
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <button onClick={confirmCallUpdate} disabled={savingCall}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors">
            {savingCall ? "Saving..." : "✅ Confirm Action"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value, color = "text-gray-800" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className={`text-sm font-medium ${color}`}>{value}</span>
    </div>
  );
}
