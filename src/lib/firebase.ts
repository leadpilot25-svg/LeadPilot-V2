import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⚠️ STEP 1: Paste your Firebase config here
// Get it from: Firebase Console → Project Settings → Your apps → Config
const firebaseConfig = {
  apiKey:            "AIzaSyDfEW33v6JyKzNLkrAr7qHNfHg3xYKYnE0",
  authDomain:        "leadpilot-v2.firebaseapp.com",
  projectId:         "leadpilot-v2",
  storageBucket:     "leadpilot-v2.firebasestorage.app",
  messagingSenderId: "1055885130387",
  appId:             "1:1055885130387:web:f6747872265bcf7cb22b66",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
