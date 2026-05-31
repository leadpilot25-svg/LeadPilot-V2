import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  deleteDoc,
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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPoll = (cid: string) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const snap = await getDoc(doc(db, "clients", cid));
        if (!snap.exists()) {
          stopPoll();
          sessionStorage.setItem("auth_error", "account_disabled");
          await auth.signOut();
          return;
        }
        const cd = snap.data();
        if (cd.active === false) {
          stopPoll();
          sessionStorage.setItem("auth_error", "account_disabled");
          await auth.signOut();
        }
      } catch (e) { console.warn("poll:", e); }
    }, 15000); // check every 15 seconds
  };

  useEffect(() => {
    if (!auth) { setLoading(false); return; }

    const unsub = onAuthStateChanged(auth, async (authUser) => {
      stopPoll();

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

      // ── Step 1: /users/{realUID} — only trust if clientId is set ───────────
      try {
        const snap = await getDoc(doc(db, "users", realUID));
        if (snap.exists()) {
          const d = snap.data();
          // If clientId is null/missing, fall through to ownerEmail lookup
          if (d.clientId) {
            resolvedRole     = d.role === "admin" ? "client" : d.role;
            resolvedClientId = d.clientId;
            resolvedPlan     = d.plan || "single";
          }
        }
      } catch (e) { console.warn("uid lookup:", e); }

      // ── Step 2: /users by email ──────────────────────────────────────────
      const placeholderDocIds: string[] = [];
      if (!resolvedRole) {
        try {
          const snaps = await getDocs(
            query(collection(db, "users"), where("email", "==", email))
          );
          if (!snaps.empty) {
            snaps.docs.forEach(d => { if (d.id !== realUID) placeholderDocIds.push(d.id); });
            const d = snaps.docs[0].data();
            resolvedRole     = d.role === "admin" ? "client" : d.role;
            resolvedClientId = d.clientId || null;
            resolvedPlan     = d.plan || "single";
          }
        } catch (e) { console.warn("email query:", e); }
      }

      // ── Step 3: /clients by ownerEmail ───────────────────────────────────
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
      }

      // ── Step 4: /clients by email ────────────────────────────────────────
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

      // ── Not registered ───────────────────────────────────────────────────
      if (!resolvedRole || !resolvedClientId) {
        sessionStorage.setItem("auth_error", "unauthorized");
        await auth.signOut();
        setUser(null); setRole(null); setClientId(null); setPlan(null);
        setLoading(false);
        return;
      }

      // ── Check client doc — must exist and must not be disabled ─────────────
      try {
        const cs = await getDoc(doc(db, "clients", resolvedClientId));

        // Doc deleted by superadmin → clear stale /users doc and re-resolve
        if (!cs.exists()) {
          // Wipe the stale clientId from /users so next login re-resolves cleanly
          try {
            await setDoc(doc(db, "users", realUID), { clientId: null }, { merge: true });
          } catch {}

          // Try to find a NEW client doc for this email (superadmin may have re-added)
          let reResolvedClientId: string | null = null;
          try {
            const snaps = await getDocs(
              query(collection(db, "clients"), where("ownerEmail", "==", email))
            );
            if (!snaps.empty && snaps.docs[0].data().active !== false) {
              reResolvedClientId = snaps.docs[0].id;
              resolvedClientId   = reResolvedClientId;
              resolvedPlan       = snaps.docs[0].data().plan || resolvedPlan;
            }
          } catch {}

          // Still no valid client doc → block login
          if (!reResolvedClientId) {
            sessionStorage.setItem("auth_error", "account_disabled");
            await auth.signOut();
            setUser(null); setRole(null); setClientId(null); setPlan(null);
            setLoading(false);
            return;
          }
        } else {
          const cd = cs.data();
          resolvedPlan = cd.plan || resolvedPlan;

          // Explicitly disabled by superadmin → block login
          if (cd.active === false) {
            sessionStorage.setItem("auth_error", "account_disabled");
            await auth.signOut();
            setUser(null); setRole(null); setClientId(null); setPlan(null);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn("client doc check:", e);
        // On Firestore error — allow login, never lock out due to network issues
      }

      // ── Write /users/{realUID} ───────────────────────────────────────────
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

      // ── Lead migrations ──────────────────────────────────────────────────
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
        }
      } catch (e) { console.warn("email lead migration:", e); }

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
          }
          try { await deleteDoc(doc(db, "users", oldId)); } catch {}
        } catch (e) { console.warn("placeholder migration:", e); }
      }

      setUser(authUser);
      setRole(resolvedRole);
      setClientId(resolvedClientId);
      setPlan(resolvedPlan);
      setLoading(false);

      // Start polling ONLY for clients to detect deletion/disable
      if (resolvedRole === "client") startPoll(resolvedClientId);
    });

    return () => { unsub(); stopPoll(); };
  }, []);

  return (
    <FirebaseContext.Provider value={{ user, role, clientId, plan, loading }}>
      {children}
    </FirebaseContext.Provider>
  );
};
