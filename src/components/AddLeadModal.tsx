import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useFirebase } from "../contexts/FirebaseProvider";
import Modal from "./Modal";
import { syncToSheets } from "../lib/sheets";
import { User, Phone, Mail, Home, DollarSign, Calendar, MapPin, FileText, UserCheck, Send } from "lucide-react";

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Agent {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
}

export default function AddLeadModal({ isOpen, onClose }: AddLeadModalProps) {
  const { user, role, clientId } = useFirebase();
  const [agents, setAgents]      = useState<Agent[]>([]);
  const [loading, setLoading]    = useState(false);
  const blank = {
    name: "", phone: "", email: "", project: "", budget: "",
    location: "", notes: "",
    followUpDate: new Date().toISOString().split("T")[0],
    assignedTo: "",
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!clientId || role !== "client") return;
    getDocs(query(collection(db, "users"),
      where("clientId", "==", clientId),
      where("role", "==", "agent"))
    ).then(s => setAgents(s.docs.map(d => ({ id: d.id, ...d.data() as any }))));
  }, [clientId, role]);

  const set = (key: string) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !clientId) return;
    setLoading(true);
    try {
      const parts      = form.name.trim().split(" ");
      const firstName  = parts[0] || "New";
      const lastName   = parts.slice(1).join(" ") || "";
      const assignedTo = form.assignedTo || (role === "agent" ? user.uid : "");

      const docRef = await addDoc(collection(db, "leads"), {
        firstName, lastName,
        phone:        form.phone,
        email:        form.email || "",
        project:      form.project || "Not specified",
        propertyType: form.project || "Not specified",
        budget:       form.budget || "",
        location:     form.location || "",
        notes:        form.notes || "",
        followUpDate: form.followUpDate,
        followUpTime: "10:00",
        status:       "new",
        source:       "Manual",
        clientId,
        assignedTo,
        createdBy:    user.uid,
        userId:       user.uid,
        createdAt:    serverTimestamp(),
      });

      await syncToSheets({
        id:           docRef.id,
        firstName,    lastName,
        phone:        form.phone,
        email:        form.email,
        project:      form.project,
        budget:       form.budget,
        location:     form.location,
        notes:        form.notes,
        followUpDate: form.followUpDate,
        source:       "Manual",
        status:       "new",
        clientId,
        assignedTo,
      });

      setForm(blank);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save lead.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Lead">
      <form onSubmit={submit} className="space-y-3 pb-8">
        <Field label="Full Name *"         icon={User}       placeholder="John Smith"       value={form.name}         onChange={set("name")}        required />
        <Field label="Phone *"             icon={Phone}      placeholder="+91 98765 43210"  value={form.phone}        onChange={set("phone")}       required type="tel" />
        <Field label="Email (optional)"    icon={Mail}       placeholder="john@example.com" value={form.email}        onChange={set("email")}       type="email" />
        <Field label="Project (optional)"  icon={Home}       placeholder="Horizon Heights"  value={form.project}      onChange={set("project")} />
        <Field label="Budget (optional)"   icon={DollarSign} placeholder="1.2 Cr"           value={form.budget}       onChange={set("budget")} />
        <Field label="Location (optional)" icon={MapPin}     placeholder="City / Area"      value={form.location}     onChange={set("location")} />
        <Field label="Follow-up Date"      icon={Calendar}   type="date"                    value={form.followUpDate} onChange={set("followUpDate")} />

        {role === "client" && agents.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5 flex items-center gap-1">
              <UserCheck size={12} /> Assign Agent
            </label>
            <select value={form.assignedTo} onChange={e => setForm(f => ({...f, assignedTo: e.target.value}))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white">
              <option value="">Unassigned</option>
              {agents.map(a => (
                <option key={a.id} value={a.uid||a.id}>{a.name||a.email}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1.5 flex items-center gap-1">
            <FileText size={12} /> Notes
          </label>
          <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
            placeholder="Key details from conversation..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 resize-none min-h-[72px]" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors mt-2">
          <Send size={15} />
          {loading ? "Saving..." : "Create Lead"}
        </button>
      </form>
    </Modal>
  );
}

interface FieldProps {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}

function Field({ label, icon: Icon, value, onChange, placeholder, required, type = "text" }: FieldProps) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1.5">{label}</label>
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-emerald-400 transition-colors bg-white">
        <Icon size={14} className="text-gray-400 shrink-0" />
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className="flex-1 text-sm outline-none text-gray-800 bg-transparent placeholder-gray-300" />
      </div>
    </div>
  );
}
