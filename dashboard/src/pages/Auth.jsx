import { useState } from "react";
import { supabase } from "../supabase";

export default function Auth() {
  const [mode, setMode] = useState("signin"); // or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) setInfo("Check your email to confirm your account, then sign in.");
      }
    } catch (e) {
      setError(e.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>LeetCode Tracker</h1>
        <p className="muted">{mode === "signin" ? "Sign in to view your dashboard." : "Create an account."}</p>
        <form onSubmit={submit} className="auth-form">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email"
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
          />
          <button type="submit" disabled={busy} className="primary">
            {busy ? "..." : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
        {info && <div className="info">{info}</div>}
        <button
          type="button"
          className="link"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have one? Sign in"}
        </button>
      </div>
    </div>
  );
}
