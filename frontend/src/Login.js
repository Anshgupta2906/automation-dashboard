import React, { useState } from "react";
import api from "./api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to sign in. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f8fb", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 420, background: "#fff", padding: 32, borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.08)" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", letterSpacing: ".08em" }}>AUTOMATION DASHBOARD</div>
          <h1 style={{ margin: "8px 0", fontSize: 30 }}>Welcome back</h1>
          <p style={{ color: "#667085", margin: 0 }}>Sign in to manage your broker operations.</p>
        </div>
        <form onSubmit={handleLogin}>
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
              style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #d0d5dd", borderRadius: 8 }} />
          </label>
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Password</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
              style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #d0d5dd", borderRadius: 8 }} />
          </label>
          {error && <div style={{ background: "#fef3f2", color: "#b42318", padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: 13, border: 0, borderRadius: 8, background: "#2563eb", color: "#fff", fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
