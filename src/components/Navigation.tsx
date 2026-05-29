import { Link, useLocation } from "react-router-dom";
import { Home, Users, Settings, Shield, Building2, BarChart2 } from "lucide-react";
import { useFirebase } from "../contexts/FirebaseProvider";
import { auth } from "../lib/firebase";
import { motion } from "framer-motion";

export function BottomNav() {
  const { role } = useFirebase();
  const { pathname } = useLocation();

  if (role === "super_admin") return null;

  const items = [
    { to: "/",       icon: Home,      label: "Home"   },
    { to: "/leads",  icon: Users,     label: "Leads"  },
    { to: "/funnel", icon: BarChart2, label: "Funnel" },
    ...(role === "client" ? [{ to: "/admin", icon: Building2, label: "Team" }] : []),
    { to: "/settings", icon: Settings, label: "More" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 z-40">
      <div className="flex justify-around">
        {items.map(item => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
          return (
            <Link key={item.to} to={item.to} className="flex flex-col items-center gap-0.5 px-3 py-1.5 relative">
              <item.icon size={20} className={active ? "text-emerald-500" : "text-gray-300"} />
              <span className={`text-[10px] font-medium ${active ? "text-emerald-500" : "text-gray-300"}`}>{item.label}</span>
              {active && <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Sidebar() {
  const { user, role } = useFirebase();
  const { pathname }   = useLocation();

  const items = role === "super_admin"
    ? [{ to: "/hq", icon: Shield, label: "LeadPilot HQ" }]
    : [
        { to: "/",        icon: Home,      label: "Dashboard"  },
        { to: "/leads",   icon: Users,     label: "Leads"      },
        { to: "/funnel",  icon: BarChart2, label: "Pipeline"   },
        ...(role === "client" ? [{ to: "/admin", icon: Building2, label: "Team & Admin" }] : []),
        { to: "/settings", icon: Settings, label: "Settings"   },
      ];

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-100 z-40">
      <div className="p-6 border-b border-gray-100">
  <div className="flex items-center gap-2">
    <img
      src="/icon-192.png"
      alt="LeadPilot"
      className="w-8 h-8 rounded-lg"
    />
    <span className="font-bold text-gray-900">LeadPilot</span>
  </div>
</div>

      <nav className="flex-1 p-4 space-y-1">
        {items.map(item => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
          return (
            <Link key={item.to} to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? "bg-emerald-50 text-emerald-600" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"}`}>
              <item.icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
  <div className="min-w-0 flex-1 mb-3">
    <p className="text-xs font-semibold text-gray-700 truncate">
      {user?.displayName || user?.email?.split("@")[0]}
    </p>
    <p className="text-[10px] text-gray-400 capitalize">{role}</p>
  </div>

  <button
    onClick={() => auth.signOut()}
    className="w-full text-xs text-gray-400 hover:text-red-500 py-2 rounded-lg hover:bg-red-50 transition-colors font-medium"
  >
    Sign out
  </button>
</div>
    </aside>
  );
}