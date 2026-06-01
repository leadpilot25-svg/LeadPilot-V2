import { useFirebase } from "../contexts/FirebaseProvider";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, getDocs, doc, writeBatch, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Search, Trash2, ChevronRight, FileSpreadsheet, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import LeadActionButtons from "../components/LeadActionButtons";

export default function LeadsList() {
  const { user, role, clientId } = useFirebase();
  const [searchParams]           = useSearchParams();
  const filterType               = searchParams.get("filter");
  const statusFilter             = searchParams.get("status");

  const [leads, setLeads]       = useState<any[]>([]);
  const [agents, setAgents]     = useState<any[]>([]);
  const [search, setSearch]     = useState("");
  const [agentFilter, setAgentFilter] = useState("all");

  const [bulkMode, setBulkMode]     = useState(false);
  const [selected, setSelected]     = useState<string[]>([]);
  const [bulkAgent, setBulkAgent]   = useState("");

  const [csvRows, setCsvRows]       = useState<any[]>([]);
  const [csvOpen, setCsvOpen]       = useState(false);
  const [csvAgent, setCsvAgent]     = useState("");
  const [importing, setImporting]   = useState(false);

  useEffect(() => {
    if (!user || !clientId || role === "super_admin") return;
    const base = collection(db, "leads");
    const q = role === "client"
      ? query(base, where("clientId", "==", clientId))
      : query(base, where("clientId", "==", clientId), where("assignedTo", "==", user.uid));

    const unsub = onSnapshot(q, snap => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      const today = new Date().toISOString().split("T")[0];
      if (filterType === "today")    data = data.filter(l => l.followUpDate === today);
      if (filterType === "missed")   data = data.filter(l => l.followUpDate < today && l.status !== "closed" && l.status !== "inactive" && !l.followUpCompleted);
      if (filterType === "closed")   data = data.filter(l => l.status === "closed");
      if (filterType === "meetings") data = data.filter(l => ["site_visit","meeting"].includes(l.status) && l.followUpDate === today);
      if (statusFilter === "open")   data = data.filter(l => l.status !== "closed" && l.status !== "inactive");
      else if (statusFilter)         data = data.filter(l => l.status === statusFilter);
      setLeads(data);
    });

    if (role === "client") {
      getDocs(query(collection(db, "users"), where("clientId","==",clientId), where("role","==","agent")))
        .then(snap => setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }

    return unsub;
  }, [user, role, clientId, filterType, statusFilter]);

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: results => {
        const rows = (results.data as any[]).map(r => ({
          name:    r.firstName || r.name || "",
          phone:   r.phone || r.phoneNumber || "",
          email:   r.email || "",
          project: r.project || r.propertyType || "",
          budget:  r.budget || "",
          valid:   !!(r.firstName || r.name) && !!(r.phone || r.phoneNumber),
        }));
        setCsvRows(rows);
        setCsvOpen(true);
        e.target.value = "";
      }
    });
  };

  const importCSV = async () => {
    if (!user || !clientId) return;
    setImporting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const batch = writeBatch(db);
      let n = 0;
      csvRows.filter(r => r.valid).forEach(r => {
        const [firstName, ...rest] = r.name.trim().split(" ");
        const ref = doc(collection(db, "leads"));
        batch.set(ref, {
          firstName, lastName: rest.join(" ") || "",
          phone: r.phone, email: r.email,
          project: r.project || "Not specified",
          propertyType: r.project || "Not specified",
          budget: r.budget, status: "new",
          clientId, assignedTo: csvAgent || "",
          createdBy: user.uid, source: "CSV Import",
          followUpDate: today, followUpTime: "10:00",
          createdAt: serverTimestamp(),
        });
        n++;
      });
      await batch.commit();
      alert(`✅ Imported ${n} leads!`);
      setCsvOpen(false); setCsvRows([]); setCsvAgent("");
    } catch { alert("Import failed."); }
    finally { setImporting(false); }
  };

  const bulkAssign = async () => {
    if (!selected.length || !bulkAgent) return;
    const batch = writeBatch(db);
    selected.forEach(id => batch.update(doc(db, "leads", id), { assignedTo: bulkAgent }));
    await batch.commit();
    alert(`Assigned ${selected.length} leads`);
    setSelected([]); setBulkMode(false); setBulkAgent("");
  };

  const deleteLead = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this lead?")) return;
    await deleteDoc(doc(db, "leads", id));
  };

  const filtered = leads.filter(l => {
    const name = `${l.firstName||""} ${l.lastName||""}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || (l.phone||"").includes(search);
    const matchAgent  = agentFilter === "all" || l.assignedTo === agentFilter;
    return matchSearch && matchAgent;
  });

  const statusColors: Record<string, string> = {
    new: "bg-blue-50 text-blue-600", contacted: "bg-indigo-50 text-indigo-600",
    meeting: "bg-violet-50 text-violet-600", site_visit: "bg-amber-50 text-amber-600",
    site_visit_postponed: "bg-orange-50 text-orange-600", booked: "bg-teal-50 text-teal-600",
    closed: "bg-emerald-500 text-white", inactive: "bg-gray-100 text-gray-400",
  };

  return (
    <div className="p-4 pb-24 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Leads</h2>
        <div className="flex items-center gap-2">
          <label className="p-2 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-emerald-500 cursor-pointer transition-colors shadow-sm">
            <FileSpreadsheet size={18} />
            <input type="file" accept=".csv" onChange={handleCSV} className="hidden" />
          </label>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input type="text" placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-emerald-400 shadow-sm transition-colors" />
        </div>
        {role === "client" && (
          <div className="flex items-center gap-2">
            <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
              className="flex-1 bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-400 shadow-sm">
              <option value="all">All agents</option>
              {agents.map(a => <option key={a.id} value={a.uid || a.id}>{a.name || a.email}</option>)}
            </select>
            <button onClick={() => { setBulkMode(!bulkMode); setSelected([]); }}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${bulkMode ? "bg-red-50 text-red-500 border-red-100" : "bg-white text-gray-500 border-gray-100 shadow-sm"}`}>
              Bulk assign
            </button>
          </div>
        )}
      </div>

      {/* Bulk assign panel */}
      {bulkMode && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">{selected.length} selected</span>
            <button onClick={() => setBulkMode(false)}><X size={14} className="text-gray-400" /></button>
          </div>
          <div className="flex gap-2">
            <select value={bulkAgent} onChange={e => setBulkAgent(e.target.value)}
              className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none">
              <option value="">Select agent...</option>
              {agents.map(a => <option key={a.id} value={a.uid || a.id}>{a.name || a.email}</option>)}
            </select>
            <button onClick={bulkAssign} disabled={!selected.length || !bulkAgent}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl px-4 text-xs font-semibold transition-colors">
              Assign
            </button>
          </div>
        </div>
      )}

      {/* Lead list */}
      <div className="space-y-2">
        {filtered.map(l => {
          // Build lead object with correct fields for WhatsApp/Email
          const leadForActions = {
            id:               l.id,
            name:             `${l.firstName || ""} ${l.lastName || ""}`.trim(),
            phone:            l.phone || "",
            email:            l.email || "",
            propertyInterest: l.project || l.propertyType || "",
            budget:           l.budget || "",
            agentName:        "Treen Foods",
          };

          return (
            <div key={l.id} className="relative">
              {bulkMode && (
                <input type="checkbox" checked={selected.includes(l.id)}
                  onChange={() => setSelected(p => p.includes(l.id) ? p.filter(x => x !== l.id) : [...p, l.id])}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 accent-emerald-500" />
              )}

              {/* Card — NOT a link, use a separate Link for navigation */}
              <div className={`bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition-colors ${bulkMode ? "pl-10" : ""}`}>
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center font-semibold text-gray-500 shrink-0">
                    {(l.firstName || "?")[0].toUpperCase()}
                  </div>

                  {/* Name + status — tapping this navigates */}
                  <Link to={`/leads/${l.id}`} className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{l.firstName} {l.lastName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[l.status] || "bg-gray-100 text-gray-500"}`}>
                        {l.status === "new" ? "New" : (l.status || "").replace(/_/g, " ")}
                      </span>
                      {l.project && l.project !== "Not specified" && (
                        <span className="text-[10px] text-gray-400 truncate">{l.project}</span>
                      )}
                    </div>
                  </Link>

                  {/* Delete + chevron */}
                  <div className="flex items-center gap-1 shrink-0">
                    {role === "client" && (
                      <button onClick={e => deleteLead(e, l.id)} className="p-1.5 text-gray-300 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <Link to={`/leads/${l.id}`}>
                      <ChevronRight size={16} className="text-gray-200" />
                    </Link>
                  </div>
                </div>

                {/* WhatsApp + Email buttons — outside the Link, no nesting issue */}
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <LeadActionButtons lead={leadForActions} />
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
            <p className="text-sm text-gray-400">No leads found</p>
          </div>
        )}
      </div>

      {/* CSV Modal */}
      {csvOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Import CSV</h3>
              <button onClick={() => setCsvOpen(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            {role === "client" && (
              <div className="mb-4">
                <label className="text-xs text-gray-500 font-medium block mb-1">Assign all leads to</label>
                <select value={csvAgent} onChange={e => setCsvAgent(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400">
                  <option value="">Unassigned</option>
                  {agents.map(a => <option key={a.id} value={a.uid || a.id}>{a.name || a.email}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4 border border-gray-100 rounded-xl p-2">
              {csvRows.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg p-2">
                  <div>
                    <p className="font-medium text-gray-800">{r.name || "No name"}</p>
                    <p className="text-gray-400">{r.phone || "No phone"}</p>
                  </div>
                  {r.valid ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-red-400" />}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCsvOpen(false)} className="flex-1 bg-gray-100 text-gray-600 rounded-xl py-3 text-sm font-medium">Cancel</button>
              <button onClick={importCSV} disabled={importing || !csvRows.some(r => r.valid)}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-semibold transition-colors">
                {importing ? "Importing..." : `Import ${csvRows.filter(r => r.valid).length} leads`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
