import { useFirebase } from "../contexts/FirebaseProvider";
import { db } from "../lib/firebase";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { UserPlus, Trash2, Mail, Shield, Clock } from "lucide-react";

export default function Admin() {
  const { user, role, clientId } = useFirebase();
  const [agents, setAgents]   = useState<any[]>([]);   // /users  (logged in)
  const [pending, setPending] = useState<any[]>([]);   // /clients (never logged in)
  const [leads, setLeads]     = useState<any[]>([]);
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [adding, setAdding]   = useState(false);

  useEffect(() => {
    if (!user || !clientId) return;

    // Active agents — logged in at least once, real UID exists
    const u1 = onSnapshot(
      query(collection(db, "users"), where("clientId","==",clientId), where("role","==","agent")),
      snap => setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // Pending agents — pre-registered in /clients, never logged in yet
    const u2 = onSnapshot(
      query(collection(db, "clients"), where("clientId","==",clientId), where("role","==","agent")),
      snap => setPending(snap.docs.map(d => ({ id: d.id, ...d.data(), isPending: true })))
    );

    const u3 = onSnapshot(
      query(collection(db, "leads"), where("clientId","==",clientId)),
      snap => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { u1(); u2(); u3(); };
  }, [user, clientId]);

  // Merge: active agents take precedence; hide /clients entry once agent has logged in
  const activeEmails = new Set(agents.map(a => (a.email || "").toLowerCase()));
  const pendingOnly  = pending.filter(p => !activeEmails.has((p.email || "").toLowerCase()));
  const allAgents    = [...agents, ...pendingOnly];

  const addAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !clientId) return;
    setAdding(true);
    try {
      const emailLower = email.trim().toLowerCase();

      // ✅ Write ONLY to /clients for pre-registration.
      // DO NOT create /users placeholder — it causes a UID mismatch that
      // breaks lead assignment and the migration in FirebaseProvider.
      // FirebaseProvider creates /users/{realUID} automatically on first login.
      await addDoc(collection(db, "clients"), {
        email:     emailLower,
        name:      name.trim(),
        role:      "agent",
        clientId,
        createdAt: new Date().toISOString(),
      });

      alert(`✅ ${name} added!\n\nTell them to:\n1. Open the app\n2. Sign in with Google using ${emailLower}\n\nThey will see their leads immediately.`);
      setName(""); setEmail("");
    } catch (err) {
      console.error(err);
      alert("Failed to add agent. Check Firestore rules.");
    } finally { setAdding(false); }
  };

  const deleteAgent = async (agent: any) => {
  if (!confirm(`Remove agent "${agent.name}"?`)) return;
  try {
    if (agent.isPending) {
      await deleteDoc(doc(db, "clients", agent.id));
    } else {
      await deleteDoc(doc(db, "users", agent.id));
    }
  } catch (err) {
    console.error(err);
    alert("Failed to delete. Check Firestore rules.");
  }
};

  // Match leads by real UID OR email (covers pre-login assignment)
  const metrics = (agent: any) => {
    const uid        = agent.uid || agent.id;
    const agentEmail = (agent.email || "").toLowerCase();
    const al = leads.filter(l =>
      l.assignedTo === uid ||
      (l.assignedTo || "").toLowerCase() === agentEmail
    );
    return {
      total:  al.length,
      active: al.filter(l => !["closed","inactive"].includes(l.status)).length,
      closed: al.filter(l => l.status === "closed").length,
    };
  };

  return (
    <div className="p-4 pb-24 max-w-xl mx-auto">
      <div className="mb-6">
        <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Admin Center</p>
        <h2 className="text-xl font-bold text-gray-900 mt-0.5">Team Management</h2>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
          <Shield size={14} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold text-emerald-700">Logged in as Client</p>
          <p className="text-xs text-gray-500 mt-0.5">You can add and manage agents</p>
        </div>
      </div>

      {/* Add agent */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UserPlus size={16} className="text-emerald-500" /> Add New Agent
        </h3>
        <form onSubmit={addAgent} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Full name</label>
            <input type="text" placeholder="e.g. Ramesh Kumar" value={name}
              onChange={e => setName(e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Gmail address</label>
            <input type="email" placeholder="agent@gmail.com" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
          </div>
          <button type="submit" disabled={adding}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2">
            <UserPlus size={15} /> {adding ? "Adding..." : "Add Agent"}
          </button>
        </form>
        <div className="mt-3 bg-blue-50 rounded-xl p-3">
          <p className="text-xs text-blue-700 font-medium">📋 How it works:</p>
          <p className="text-xs text-blue-600 mt-1 leading-relaxed">
            1. Add agent email here<br/>
            2. Assign leads to them from the Leads page<br/>
            3. Agent opens app → signs in with Google<br/>
            4. They see their leads <strong>automatically</strong>
          </p>
        </div>
      </div>

      {/* Agent list */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Agents ({allAgents.length})</h3>
      <div className="space-y-3">
        {allAgents.map(a => {
          const uid = a.uid || a.id;
          const m   = metrics(a);
          return (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-semibold text-sm uppercase shrink-0">
                  {(a.name||"?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{a.name || "—"}</p>
                    {a.isPending && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 border border-amber-100 rounded-full px-2 py-0.5">
                        <Clock size={8} /> Pending login
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Mail size={10} /> {a.email}
                  </p>
                  {!a.isPending && (
                    <p className="text-[10px] text-gray-300 mt-0.5">UID: {uid.substring(0,12)}...</p>
                  )}
                </div>
                <button onClick={() => deleteAgent(a)}
                  className="p-2 bg-red-50 text-red-400 hover:text-red-600 rounded-lg">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 bg-gray-50 rounded-xl p-3 text-center">
                {[["Total",m.total,"text-gray-900"],["Active",m.active,"text-blue-600"],["Closed",m.closed,"text-emerald-600"]].map(([l,v,c])=>(
                  <div key={String(l)}>
                    <p className={`text-base font-bold ${c}`}>{v}</p>
                    <p className="text-[10px] text-gray-400">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {allAgents.length === 0 && (
          <div className="text-center py-10 bg-white border border-dashed border-gray-200 rounded-2xl">
            <p className="text-sm text-gray-400">No agents yet</p>
          </div>
        )}
      </div>
    </div>
  );
}