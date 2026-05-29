import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider 
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebase } from "../contexts/FirebaseProvider";

const provider = new GoogleAuthProvider();

export default function Login() {
  const { user, loading } = useFirebase();
  const navigate          = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy]   = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  // Handle redirect result when page loads
  useEffect(() => {
    getRedirectResult(auth)
      .then(result => {
        if (result?.user) navigate("/", { replace: true });
      })
      .catch(err => {
        console.error("Redirect result error:", err);
      });
  }, [navigate]);

  // Check for auth_error from FirebaseProvider
  useEffect(() => {
    const err = sessionStorage.getItem("auth_error");
    if (err === "unauthorized") {
      setError("Your email is not registered. Contact your administrator.");
      sessionStorage.removeItem("auth_error");
    }
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError("");
    try {
      // Try popup first
      const result = await signInWithPopup(auth, provider);
      if (result.user) navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Popup error:", err.code, err.message);
      // If popup blocked or failed, fall back to redirect
      if (
        err.code === "auth/popup-blocked" ||
        err.code === "auth/popup-closed-by-user" ||
        err.code === "auth/cancelled-popup-request"
      ) {
        try {
          await signInWithRedirect(auth, provider);
          // Will redirect away from page
          return;
        } catch (redirectErr: any) {
          console.error("Redirect error:", redirectErr);
          setError("Sign in failed: " + redirectErr.message);
        }
      } else {
        setError("Sign in failed: " + err.message);
      }
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-sm border border-gray-100 text-center">

        <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <span className="text-white font-bold text-2xl">L</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">LeadPilot</h1>
        <p className="text-sm text-gray-400 mb-8">Real estate lead management</p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl p-3 mb-5 text-left">
            {error}
          </div>
        )}

        <button
          onClick={signIn}
          disabled={busy}
          className="w-full bg-white hover:bg-gray-50 border border-gray-200 rounded-xl py-3.5 text-sm font-medium text-gray-700 flex items-center justify-center gap-3 transition-colors disabled:opacity-60 shadow-sm"
        >
          {busy ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {busy ? "Opening Google..." : "Continue with Google"}
        </button>

        <p className="text-xs text-gray-400 mt-6 leading-relaxed">
          Only registered team members can access.<br/>
          Contact your admin if you need access.
        </p>
      </div>
    </div>
  );
}
