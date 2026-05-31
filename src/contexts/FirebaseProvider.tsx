import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc, setDoc, getDoc, collection,
  query, where, getDocs, writeBatch, deleteDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export const SUPER_ADMIN_EMAIL = "mail.nasiya@gmail.com";

type Role = "super_admin" | "client" | "agent" | null;
type Plan = "single" | "multi" | null;

interface Ctx {
  user: User | null;
  role: Role;
  clientId: string | null;
  plan: Plan;
  loading: boolean;
}

const FirebaseContext = createContext<Ctx>({
  user: null, role: null, clientId: null, plan: null, loading: true,
});

export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]         = useState<User | null>(null);
  const [role, setRole]         = useState<Role>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [plan, setPlan]         = useState<Plan>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }

    const unsub = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) {
        setUser(null); setRole(null); setClientId(null); setPlan(null);
        setLoading(false);
        return;
      }

      const realUID = authUser.uid;
      const email   = (authUser.email || "").toLowerCase();

      // ── Super admin ──────────────────────────────────────────────────────
      if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
        setUser(authUser); setRole("super_admin");
        setClientId(null); setPlan("multi");
        setLoading(false);
        return;
      }

      let resolvedRole: Role = null;
      let resolvedClientId: string | null = null;
      let resolvedPlan: Plan = "single";

      // ── Step 1: Check /users/{realUID} ───────────────────────────────────
      try {
        const snap = await getDoc(doc(db, "users", realUID));
        if (snap.exists()) {
          const d = snap.data();
          resolvedRole     = d.role === "admin" ? "client" : d.role;
          resolvedClientId = d.clientId || null;
          resolvedPlan     = d.plan || "single";
        }
      } catch (e) { console.warn("uid lookup:", e); }

      // ── Step 2: If not found by UID, search /users by email ──────────────
      const placeholderDocIds: string[] = [];
      if (!resolvedRole) {
        try {
          const snaps = await getDocs(
            query(collection(db, "users"), where("email", "==", email))
          );
          if (!snaps.empty) {
            snaps.docs.forEach(d => {
              if (d.id !== realUID) placeholderDocIds.push(d.id);
            });
            const d = snaps.docs[0].data();
            resolvedRole     = d.role === "admin" ? "client" : d.role;
            resolvedClientId = d.clientId || null;
            resolvedPlan     = d.plan || "single";
          }
        } catch (e) { console.warn("email query:", e); }
      }

      // ── Step 3: Check /clients by ownerEmail or email ────────────────────
      if (!resolvedRole) {
        try {
          const snaps = await getDocs(
            query(collection(db, "clients"), where("ownerEmail", "==", email))
          );
          if (!snaps.empty) {
            resolvedRole     = "client";
            resolvedClientId = snaps.docs[0].id;
            resolvedPlan     = snaps.docs[0].data().plan || "single";
          }
        } catch (e) { console.warn("ownerEmail lookup:", e); }

        if (!resolvedRole) {
          try {
            const snaps = await getDocs(
              query(collection(db, "clients"), where("email", "==", email))
            );
            if (!snaps.empty) {
              const d = snaps.docs[0].data();
              resolvedRole     = d.role || "agent";
              resolvedClientId = d.clientId || snaps.docs[0].id;
              resolvedPlan     = d.plan || "single";
            }
          } catch (e) { console.warn("client email lookup:", e); }
        }
      }

      // ── Deny if not registered ───────────────────────────────────────────
      if (!resolvedRole || !resolvedClientId) {
        sessionStorage.setItem("auth_error", "unauthorized");
        await auth.signOut();
        setUser(null); setRole(null); setClientId(null); setPlan(null);
        setLoading(false);
        return;
      }

      // Refresh plan from /clients + check access
      try {
        const cs = await getDoc(doc(db, "clients", resolvedClientId));

        if (cs.exists()) {
          const cd = cs.data();
          resolvedPlan = cd.plan || "single";

          // ✅ Blocked by superadmin toggle
          if (cd.active === false) {
            sessionStorage.setItem("auth_error", "account_disabled");
            await auth.signOut();
            setUser(null); setRole(null); setClientId(null); setPlan(null);
            setLoading(false);
            return;
          }

          // ✅ Trial expired
          if (cd.trialEndsAt && cd.status !== "active") {
            const trialEnd = new Date(cd.trialEndsAt + "T23:59:59");
            if (!isNaN(trialEnd.getTime()) && new Date() > trialEnd) {
              sessionStorage.setItem("auth_error", "trial_expired");
              await auth.signOut();
              setUser(null); setRole(null); setClientId(null); setPlan(null);
              setLoading(false);
              return;
            }
          }
        }
      } catch {}

      // ── Write canonical /users/{realUID} doc ─────────────────────────────
      try {
        const userRef  = doc(db, "users", realUID);
        const existing = await getDoc(userRef);
        await setDoc(userRef, {
          uid:       realUID,
          name:      authUser.displayName || email.split("@")[0],
          email:     authUser.email,
          role:      resolvedRole,
          clientId:  resolvedClientId,
          plan:      resolvedPlan,
          createdAt: existing.exists()
            ? existing.data().createdAt || new Date().toISOString()
            : new Date().toISOString(),
        }, { merge: true });
      } catch (e) { console.warn("upsert user:", e); }

      // ── Migrate leads assigned to email → realUID ────────────────────────
      try {
        const byEmail = await getDocs(
          query(collection(db, "leads"),
            where("clientId",  "==", resolvedClientId),
            where("assignedTo","==", email)
          )
        );
        if (!byEmail.empty) {
          const batch = writeBatch(db);
          byEmail.docs.forEach(d => batch.update(d.ref, { assignedTo: realUID }));
          await batch.commit();
          console.log(`Migrated ${byEmail.size} leads from email → UID`);
        }
      } catch (e) { console.warn("email lead migration:", e); }

      // ── Migrate leads stuck on placeholder doc IDs → realUID ─────────────
      // Placeholder /users docs (from the old addAgent bug) had random auto-IDs.
      // Leads assigned to those IDs are unreachable by the agent; fix them here.
      for (const oldId of placeholderDocIds) {
        try {
          const byOldId = await getDocs(
            query(collection(db, "leads"),
              where("clientId",  "==", resolvedClientId),
              where("assignedTo","==", oldId)
            )
          );
          if (!byOldId.empty) {
            const batch = writeBatch(db);
            byOldId.docs.forEach(d => batch.update(d.ref, { assignedTo: realUID }));
            await batch.commit();
            console.log(`Migrated ${byOldId.size} leads from ${oldId} → UID`);
          }
          // Best-effort cleanup of placeholder doc
          try { await deleteDoc(doc(db, "users", oldId)); } catch {}
        } catch (e) { console.warn("placeholder migration:", e); }
      }

      setUser(authUser);
      setRole(resolvedRole);
      setClientId(resolvedClientId);
      setPlan(resolvedPlan);
      setLoading(false);
    });

    return unsub;
  }, []);

  return (
    <FirebaseContext.Provider value={{ user, role, clientId, plan, loading }}>
      {children}
    </FirebaseContext.Provider>
  );
};
