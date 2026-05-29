import React, { useState } from "react";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { syncToSheets } from "../lib/sheets";
import { useParams } from "react-router-dom";
import { Phone, User, Home, MapPin, DollarSign, Send, CheckCircle2 } from "lucide-react";

// Public form — no login required
// URL: /form/:clientId
// Put this URL in Facebook ads and Instagram bio

export default function PublicForm() {
  const { clientId } = useParams<{ clientId: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [form, setForm]           = useState({
    name: "", phone: "", email: "",
    project: "", budget: "", location: "", notes: "",
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { setError("Invalid form link. Contact the company."); return; }
    if (!form.name.trim() || !form.phone.trim()) { setError("Name and phone are required."); return; }
    setLoading(true);
    setError("");

    try {
      const parts     = form.name.trim().split(" ");
      const firstName = parts[0];
      const lastName  = parts.slice(1).join(" ") || "";
      const today     = new Date().toISOString().split("T")[0];

      // Get sheet URL for this client
      let sheetsUrl = "";
      try {
        const clientSnap = await getDocs(
          query(collection(db, "clients"), where("__name__", "==", clientId))
        );
        if (!clientSnap.empty) {
          sheetsUrl = clientSnap.docs[0].data().sheetsWebhookUrl || "";
        }
      } catch {}

      const docRef = await addDoc(collection(db, "leads"), {
        firstName, lastName,
        phone:        form.phone,
        email:        form.email || "",
        project:      form.project || "Not specified",
        propertyType: form.project || "Not specified",
        budget:       form.budget || "",
        location:     form.location || "",
        notes:        form.notes || "",
        status:       "new",
        source:       "Public Form",
        clientId,
        assignedTo:   "",
        createdBy:    "public",
        followUpDate: today,
        followUpTime: "10:00",
        createdAt:    serverTimestamp(),
      });

      // Sync to Google Sheets
      if (sheetsUrl) {
        localStorage.setItem("sheetsWebhookUrl", sheetsUrl);
      }
      await syncToSheets({
        id: docRef.id, firstName, lastName,
        phone: form.phone, email: form.email,
        project: form.project, budget: form.budget,
        location: form.location, notes: form.notes,
        source: "Public Form", status: "new", clientId,
      });

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-sm border border-gray-100">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Your enquiry has been received. Our team will contact you shortly.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-sm border border-gray-100">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Home size={22} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Enquire Now</h1>
          <p className="text-sm text-gray-400 mt-1">Fill in your details and we'll get back to you</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 mb-4">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <Field label="Full Name *"    icon={User}       placeholder="Your full name"    value={form.name}     onChange={set("name")}     required />
          <Field label="Phone Number *" icon={Phone}      placeholder="+91 98765 43210"   value={form.phone}    onChange={set("phone")}    required type="tel" />
          <Field label="Email"          icon={User}       placeholder="your@email.com"    value={form.email}    onChange={set("email")}    type="email" />

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Interested In</label>
            <select value={form.project} onChange={set("project")}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white text-gray-700">
              <option value="">Select property type</option>
              <option>1 BHK Apartment</option>
              <option>2 BHK Apartment</option>
              <option>3 BHK Apartment</option>
              <option>Villa / Independent House</option>
              <option>Plot / Land</option>
              <option>Commercial Space</option>
              <option>Other</option>
            </select>
          </div>

          <Field label="Budget"    icon={DollarSign} placeholder="e.g. 50 Lakhs"    value={form.budget}   onChange={set("budget")} />
          <Field label="Location"  icon={MapPin}     placeholder="Preferred area"   value={form.location} onChange={set("location")} />

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Message (optional)</label>
            <textarea value={form.notes} onChange={set("notes")} placeholder="Any specific requirements..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 resize-none min-h-[60px]" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            <Send size={15} />
            {loading ? "Submitting..." : "Submit Enquiry"}
          </button>
        </form>

        <p className="text-[10px] text-gray-400 text-center mt-4">
          Your information is safe and will not be shared.
        </p>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}

function Field({ label, icon: Icon, value, onChange, placeholder, required, type = "text" }: FieldProps) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1.5">{label}</label>
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-emerald-400 transition-colors">
        <Icon size={14} className="text-gray-400 shrink-0" />
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
          className="flex-1 text-sm outline-none text-gray-800 bg-transparent placeholder-gray-300" />
      </div>
    </div>
  );
}
