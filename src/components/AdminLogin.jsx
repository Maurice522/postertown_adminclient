import React, { useState } from "react";
import { KeyRound, LogIn, ShieldCheck, User } from "lucide-react";
import { loginAdmin } from "../services/api.js";

// Username + the current 6-digit code from the authenticator app.
export default function AdminLogin({ onLoggedIn, notice }) {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      onLoggedIn(await loginAdmin(username.trim(), code));
    } catch (err) {
      setError(err.message);
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="login-icon">
            <ShieldCheck size={22} />
          </span>
          <div>
            <p className="eyebrow">Poster Town</p>
            <h1>Admin Console</h1>
          </div>
        </div>

        {notice && <p className="login-notice">{notice}</p>}

        <label className="login-field">
          <span>Username</span>
          <div>
            <User size={16} />
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
            />
          </div>
        </label>

        <label className="login-field">
          <span>Authenticator code</span>
          <div>
            <KeyRound size={16} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              placeholder="6-digit code"
              title="The 6-digit code from your authenticator app"
              required
            />
          </div>
          <small>Open your authenticator app and enter the current code for Poster Town.</small>
        </label>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="primary-button login-submit" disabled={loading}>
          <LogIn size={16} /> {loading ? "Checking..." : "Log in"}
        </button>
      </form>
    </main>
  );
}
