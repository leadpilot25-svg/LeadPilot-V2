import { useFirebase } from "../contexts/FirebaseProvider";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, getDocs, doc, writeBatch, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, X, ArrowRight } from "lucide-react";

const STAGES = [
  { label: "New",          value: "new",                  color: "bg-blue-400",    light: "bg-blue-50 text-blue-600"    },
  { label: "Contacted",    value: "contacted",             color: "bg-indigo-400",  light: "bg-indigo-50 text-indigo-600" },
  { label: "Meeting",      value: "meeting",               color: "bg-violet-400",  light: "bg-violet-50 text-violet-600" },
  { label: "Site Visit",   value: "site_visit",            color: "bg-amber-400",   light: "bg-amber-50 text-amber-600"  },
  { label: "Postponed",    value: "site_visit_postponed",  color: "bg-orange-400",  light: "bg-orange-50 text-orange-600" },
  { label: "Booked",       value: "booked",                color: "bg-teal-400",    light: "bg-teal-50 text-teal-600"   },
  { label: "Closed",       value: "closed",                color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-600" },
  { label: "Inactive",     value: "inactive",              color: "bg-gray-300",    light: "bg-gray-100 text-gray-500"  },
];

export default function Funnel() {
  const { user, role, clientId } = useFirebase();
  const navigate = useNavigate();
  const [leads, setLeads]   = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [agentFilter, setAgentFilter] = useState("all");
  const [bulkMode, setBulkMode]   = useState(false);
  const [selected, setSelected]   = useState<string[]>([]);
  const [bulkAgent, setBulkAgent] = useState("");

  useEffect(() => {
    if (!user || !clientId || role === "super_admin") return;
    const base = collection(db, "leads");
    const q = role === "client"
      ? query(base, where("clientId", "==", clientId))
      : query(base, where("clientId", "==", clientId), where("assignedTo", "==", user.uid));
    const unsub = onSnapshot(q, snap =>
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() as any })))
    );
    if (role === "client") {
      getDocs(query(collection(db, "users"), where("clientId","==",clientId), where("role","==","agent")))
        .then(s => setAgents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    return unsub;
  }, [user, role, clientId]);

  const filtered   = leads.filter(l => agentFilter === "all" || l.assignedTo === agentFilter);
  const inStage    = (s: string) => filtered.filter(l => (l.status || "new") === s);
  const changeStatus = (id: string, status: string) => updateDoc(doc(db, "leads", id), { status });

  const bulkAssign = async () => {
    if (!selected.length || !bulkAgent) return;
    const batch = writeBatch(db);
    selected.forEach(id => batch.update(doc(db, "leads", id), { assignedTo: bulkAgent }));
    await batch.commit();
    setSelected([]); setBulkMode(false); setBulkAgent("");
    alert(`Assigned ${selected.length} leads`);
  };

  const total = filtered.length;

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Pipeline</h2>
        <div className="flex items-center gap-2">
          {role === "client" && (
            <>
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
                className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none shadow-sm">
                <option value="all">All agents</option>
                {agents.map(a => <option key={a.id} value={a.uid||a.id}>{a.name||a.email}</option>)}
              </select>
              <button onClick={() => { setBulkMode(!bulkMode); setSelected([]); }}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${bulkMode ? "bg-red-50 text-red-500 border-red-100" : "bg-white text-gray-500 border-gray-100 shadow-sm"}`}>
                Bulk
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk panel */}
      {bulkMode && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 flex-1">{selected.length} selected</span>
          <select value={bulkAgent} onChange={e => setBulkAgent(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none flex-1">
            <option value="">Select agent</option>
            {agents.map(a => <option key={a.id} value={a.uid||a.id}>{a.name||a.email}</option>)}
          </select>
          <button onClick={bulkAssign} disabled={!selected.length || !bulkAgent}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl px-4 py-2 text-xs font-semibold">
            Assign
          </button>
          <button onClick={() => setBulkMode(false)}><X size={14} className="text-gray-400" /></button>
        </div>
      )}

      {/* ── Pipeline overview — clickable cards ── */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {STAGES.map(s => {
          const count = inStage(s.value).length;
          const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <button
              key={s.value}
              onClick={() => navigate(`/leads?status=${s.value}`)}
              className="bg-white border border-gray-100 rounded-2xl p-4 text-left hover:border-gray-200 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.light}`}>
                  {s.label}
                </span>
                <ArrowRight size={12} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{pct}% of pipeline</p>
            </button>
          );
        })}
      </div>

      {/* ── Recent leads across all stages ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">All Leads</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.slice(0, 50).map(l => {
            const stage = STAGES.find(s => s.value === l.status);
            return (
              <div key={l.id} className={`flex items-center gap-3 ${bulkMode ? "" : ""}`}>
                {bulkMode && (
                  <input type="checkbox" checked={selected.includes(l.id)}
                    onChange={() => setSelected(p => p.includes(l.id) ? p.filter(x => x !== l.id) : [...p, l.id])}
                    className="w-4 h-4 accent-emerald-500 shrink-0" />
                )}
                <Link to={`/leads/${l.id}`} className="flex items-center gap-3 flex-1 hover:bg-gray-50 rounded-xl p-2 transition-colors">
                  <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">
                    {(l.firstName||"?")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.firstName} {l.lastName}</p>
                    <p className="text-xs text-gray-400 truncate">{l.phone}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select value={l.status||"new"} onClick={e => e.preventDefault()}
                      onChange={e => { e.preventDefault(); e.stopPropagation(); changeStatus(l.id, e.target.value); }}
                      className={`text-[10px] font-medium px-2 py-1 rounded-full border-none outline-none ${stage?.light || "bg-gray-100 text-gray-500"}`}>
                      {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                </Link>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No leads yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
