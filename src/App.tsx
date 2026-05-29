import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { FirebaseProvider, useFirebase } from "./contexts/FirebaseProvider";
import { Sidebar, BottomNav } from "./components/Navigation";
import Login           from "./pages/Login";
import SuperAdminPanel from "./pages/SuperAdminPanel";
import Dashboard       from "./pages/Dashboard";
import LeadsList       from "./pages/LeadsList";
import LeadDetails     from "./pages/LeadDetails";
import Funnel          from "./pages/Funnel";
import Admin           from "./pages/Admin";
import Settings        from "./pages/Settings";
import AddLeadModal    from "./components/AddLeadModal";
import PublicForm      from "./pages/PublicForm";
import { useState }    from "react";

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useFirebase();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-gray-400">Loading...</p>
      </div>
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppShell() {
  const { role }          = useFirebase();
  const [modal, setModal] = useState(false);

  if (role === "super_admin") {
    return (
      <Routes>
        <Route path="*" element={<SuperAdminPanel />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      <div className="lg:pl-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 bg-white border-b border-gray-100 z-30 px-4 py-3.5 flex items-center justify-between lg:px-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center lg:hidden">
              <span className="text-white font-bold text-xs">L</span>
            </div>
            <span className="font-bold text-gray-900 text-sm">LeadPilot</span>
          </div>
          <button onClick={() => setModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
            + Add Lead
          </button>
        </header>
        <main className="pb-24 lg:pb-8">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/leads"     element={<LeadsList />} />
            <Route path="/leads/:id" element={<LeadDetails />} />
            <Route path="/funnel"    element={<Funnel />} />
            <Route path="/admin"     element={role === "client" ? <Admin /> : <Navigate to="/" />} />
            <Route path="/settings"  element={<Settings />} />
            <Route path="*"          element={<Navigate to="/" />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
      <AddLeadModal isOpen={modal} onClose={() => setModal(false)} />
    </div>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <Router>
        <Routes>
          <Route path="/login"          element={<Login />} />
          <Route path="/form/:clientId" element={<PublicForm />} />  {/* ✅ public — no auth */}
          <Route path="/*"              element={<Guard><AppShell /></Guard>} />
        </Routes>
      </Router>
    </FirebaseProvider>
  );
}