// Shared hook — loads both active agents (/users) and pending agents (/clients)
// Active = logged in at least once, have real UID
// Pending = added by client but not logged in yet

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface AgentOption {
  id: string;         // doc ID
  uid: string;        // real UID to use as assignedTo value
  name: string;
  email: string;
  status: "active" | "pending";
}

export function useAgents(clientId: string | null) {
  const [agents, setAgents] = useState<AgentOption[]>([]);

  useEffect(() => {
    if (!clientId) return;

    let activeAgents: AgentOption[]  = [];
    let pendingAgents: AgentOption[] = [];

    const merge = () => {
      // Remove pending entries that have become active (same email)
      const activeEmails = new Set(activeAgents.map(a => a.email));
      const filteredPending = pendingAgents.filter(p => !activeEmails.has(p.email));
      setAgents([...activeAgents, ...filteredPending]);
    };

    // Active agents — in /users collection with real UID
    const u1 = onSnapshot(
      query(collection(db, "users"),
        where("clientId", "==", clientId),
        where("role", "==", "agent")),
      snap => {
        activeAgents = snap.docs.map(d => {
          const data = d.data();
          return {
            id:     d.id,
            uid:    data.uid || d.id,  // real Firebase Auth UID
            name:   data.name || data.email?.split("@")[0] || "Agent",
            email:  data.email || "",
            status: "active" as const,
          };
        });
        merge();
      }
    );

    // Pending agents — in /clients collection, not logged in yet
    const u2 = onSnapshot(
      query(collection(db, "clients"),
        where("clientId", "==", clientId),
        where("role", "==", "agent")),
      snap => {
        pendingAgents = snap.docs.map(d => {
          const data = d.data();
          return {
            id:     d.id,
            uid:    data.email || "",  // use email as assignedTo for pending agents
            name:   data.name || data.email?.split("@")[0] || "Agent",
            email:  data.email || "",
            status: "pending" as const,
          };
        });
        merge();
      }
    );

    return () => { u1(); u2(); };
  }, [clientId]);

  return agents;
}
