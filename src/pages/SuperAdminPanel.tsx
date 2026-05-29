import React, { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useFirebase } from "../contexts/FirebaseProvider";
import { Plus, Trash2, LogOut, Shield, Building2, Mail, Check, Copy, ToggleLeft, ToggleRight, X } from "lucide-react";

export default function SuperAdminPanel() {
  const { role } = useFirebase();
  const [clients, setClients]   = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding]     = useState(false);
  const [copied, setCopied]     = useState<string | null>(null);
  const [form, setForm]         = useState({ name: "", ownerEmail: "", plan: "multi" as "single" | "multi", trialDays: "30" });

  useEffect(() => {
    if (role !== "super_admin") return;
    return onSnapshot(collection(db, "clients"), snap => {
      setClients(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((c: any) => c.ownerEmail)
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      );
    });
  }, [role]);

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ownerEmail.trim()) return;
    setAdding(true);
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + parseInt(form.trialDays || "30"));
      await addDoc(collection(db, "clients"), {
        name:        form.name.trim(),
        ownerEmail:  form.ownerEmail.trim().toLowerCase(),
        plan:        form.plan,
        active:      true,
        status:      "trial",
        trialEndsAt: trialEnd.toISOString().split("T")[0],
        createdAt:   new Date().toISOString(),
      });
      setForm({ name: "", ownerEmail: "", plan: "multi", trialDays: "30" });
      setShowForm(false);
      alert(`✅ Done! Tell ${form.ownerEmail} to login at your app URL with Google.`);
    } catch (err) {
      alert("Failed. Check Firestore rules.");
    } finally { setAdding(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "clients", id), { active: !current });
  };

  const activateClient = async (id: string) => {
    await updateDoc(doc(db, "clients", id), { status: "active", trialEndsAt: null });
    alert("Client activated!");
  };

  const deleteClient = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await deleteDoc(doc(db, "clients", id));
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
  };

  if (role !== "super_admin") return <div className="h-screen flex items-center justify-center text-gray-400">Access denied</div>;

  const total   = clients.length;
  const active  = clients.filter((c: any) => c.active !== false).length;
  const trials  = clients.filter((c: any) => c.status === "trial").length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">LeadPilot HQ</h1>
            <p className="text-xs text-gray-400">Super Admin</p>
          </div>
        </div>
        <button onClick={() => auth.signOut()} className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-500 transition-colors">
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total clients", value: total },
            { label: "Active",        value: active },
            { label: "On trial",      value: trials },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Add client */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 mb-6 transition-colors shadow-sm shadow-emerald-100"
          >
            <Plus size={16} /> Add New Client
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">New Client Workspace</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <form onSubmit={addClient} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Company name *</label>
                <input type="text" placeholder="Acme Realty" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Owner email *</label>
                <input type="email" placeholder="owner@company.com" value={form.ownerEmail} onChange={e => setForm({...form, ownerEmail: e.target.value})} required className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Plan</label>
                  <div className="flex gap-2">
                    {(["single","multi"] as const).map(p => (
                      <button key={p} type="button" onClick={() => setForm({...form, plan: p})}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${form.plan === p ? "bg-emerald-500 border-emerald-500 text-white" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                        {p === "single" ? "Solo" : "Team"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Trial days</label>
                  <select value={form.trialDays} onChange={e => setForm({...form, trialDays: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400">
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="999">No trial</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={adding} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-semibold transition-colors mt-1">
                {adding ? "Creating..." : "Create Workspace"}
              </button>
            </form>
          </div>
        )}

        {/* Client list */}
        <div className="space-y-3">
          {clients.map((c: any) => {
            const isExpired = c.trialEndsAt && new Date(c.trialEndsAt) < new Date() && c.status !== "active";
            const daysLeft  = c.trialEndsAt ? Math.max(0, Math.ceil((new Date(c.trialEndsAt).getTime() - Date.now()) / 86400000)) : null;
            return (
              <div key={c.id} className={`bg-white rounded-2xl border p-4 ${c.active === false ? "opacity-50 border-gray-100" : "border-gray-100"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center font-bold text-emerald-600 text-sm shrink-0 uppercase">
                      {(c.name || "?")[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail size={10} className="text-gray-400 shrink-0" />
                        <p className="text-xs text-gray-400 truncate">{c.ownerEmail}</p>
                        <button onClick={() => copyEmail(c.ownerEmail)} className="text-gray-300 hover:text-emerald-500 shrink-0 ml-1">
                          {copied === c.ownerEmail ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.plan === "multi" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                      {c.plan === "multi" ? "Team" : "Solo"}
                    </span>
                    <button onClick={() => toggleActive(c.id, c.active !== false)}>
                      {c.active === false ? <ToggleLeft size={18} className="text-gray-300" /> : <ToggleRight size={18} className="text-emerald-500" />}
                    </button>
                    <button onClick={() => deleteClient(c.id, c.name)} className="p-1 bg-red-50 text-red-400 hover:text-red-600 rounded-lg">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    {c.status === "active" ? (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
                    ) : isExpired ? (
                      <span className="text-[10px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Trial expired</span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        Trial · {daysLeft} days left
                      </span>
                    )}
                  </div>
                  {c.status !== "active" && (
                    <button onClick={() => activateClient(c.id)} className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors">
                      Activate ✓
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {clients.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
              <Building2 size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No clients yet. Add your first one above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
