import { useFirebase } from "../contexts/FirebaseProvider";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AlertCircle, Clock, Calendar, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import AddLeadModal from "../components/AddLeadModal";

export default function Dashboard() {
  const { user, role, clientId } = useFirebase();
  const [leads, setLeads]         = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!user || !clientId || role === "super_admin") return;
    const base = collection(db, "leads");
    const q = role === "client"
      ? query(base, where("clientId", "==", clientId))
      : query(base, where("clientId", "==", clientId), where("assignedTo", "==", user.uid));
    return onSnapshot(q, snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() as any })));
    });
  }, [user, role, clientId]);

  const today    = new Date().toISOString().split("T")[0];
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning 🌅"
                 : hour < 17 ? "Good afternoon ☀️"
                 : "Good evening 🌙";

  const missed   = leads.filter(l => l.followUpDate < today && l.status !== "closed" && l.status !== "inactive" && !l.followUpCompleted).length;
  const todayFU  = leads.filter(l => l.followUpDate === today && l.status !== "closed").length;
  const meetings = leads.filter(l => ["site_visit","meeting"].includes(l.status) && l.followUpDate === today).length;
  const closed   = leads.filter(l => l.status === "closed").length;
  const total    = leads.length;
  const open     = leads.filter(l => l.status !== "closed" && l.status !== "inactive").length;

  const funnel = [
    { label: "New",                  value: leads.filter(l => l.status === "new").length,                  color: "bg-blue-400",    status: "new"                  },
    { label: "Contacted",            value: leads.filter(l => l.status === "contacted").length,            color: "bg-indigo-400",  status: "contacted"            },
    { label: "Meeting",              value: leads.filter(l => l.status === "meeting").length,              color: "bg-violet-400",  status: "meeting"              },
    { label: "Site Visit Scheduled", value: leads.filter(l => l.status === "site_visit").length,           color: "bg-amber-400",   status: "site_visit"           },
    { label: "Site Visit Postponed", value: leads.filter(l => l.status === "site_visit_postponed").length, color: "bg-orange-400",  status: "site_visit_postponed" },
    { label: "Booked",               value: leads.filter(l => l.status === "booked").length,               color: "bg-teal-400",    status: "booked"               },
    { label: "Closed",               value: closed,                                                         color: "bg-emerald-500", status: "closed"               },
    { label: "Inactive",             value: leads.filter(l => l.status === "inactive").length,             color: "bg-gray-300",    status: "inactive"             },
  ];

  return (
    <div className="p-4 lg:p-6 pb-24 max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Dashboard</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">{greeting}</h1>
      </div>

      {/* Missed alert */}
      {missed > 0 && (
        <Link to="/leads?filter=missed" className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl p-3.5 mb-5 hover:bg-red-100 transition-colors">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">You have <strong>{missed} missed follow-up{missed > 1 ? "s" : ""}</strong></p>
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: "Today's follow-ups", value: todayFU,  icon: Clock,       color: "text-amber-500",   bg: "bg-amber-50",   to: "/leads?filter=today"    },
          { label: "Missed follow-ups",  value: missed,   icon: AlertCircle, color: "text-red-500",     bg: "bg-red-50",     to: "/leads?filter=missed"   },
          { label: "Meetings today",     value: meetings, icon: Calendar,    color: "text-orange-500",  bg: "bg-orange-50",  to: "/leads?filter=meetings" },
          { label: "Closed deals",       value: closed,   icon: Trophy,      color: "text-emerald-500", bg: "bg-emerald-50", to: "/leads?filter=closed"   },
        ].map(s => (
          <Link key={s.label} to={s.to} className={`${s.bg} rounded-2xl p-4 flex items-center gap-3 hover:opacity-90 transition-opacity`}>
            <s.icon size={20} className={s.color} />
            <div>
              <p className="text-xs text-gray-500 font-medium leading-tight">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Overview + Funnel */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Lead Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total",  value: total,   to: "/leads"               },
              { label: "Open",   value: open,    to: "/leads?status=open"   },
              { label: "Closed", value: closed,  to: "/leads?filter=closed" },
              { label: "Today",  value: todayFU, to: "/leads?filter=today"  },
            ].map(s => (
              <Link key={s.label} to={s.to} className="bg-gray-50 hover:bg-gray-100 rounded-xl p-3.5 transition-colors">
                <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Pipeline</h3>
          <div className="space-y-3">
            {funnel.map(f => (
              <Link key={f.label} to={`/leads?status=${f.status}`} className="block hover:bg-gray-50 rounded-xl px-2 py-1 -mx-2 transition-colors">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">{f.label}</span>
                  <span className="text-gray-400">{f.value}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full">
                  <div className={`h-full ${f.color} rounded-full transition-all`} style={{ width: total > 0 ? `${(f.value / total) * 100}%` : "0%" }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <AddLeadModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}