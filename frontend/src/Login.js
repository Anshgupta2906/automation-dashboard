import React, { useState } from "react";
import api from "./api";

export default function Login() {
  const [role, setRole] = useState("broker");
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const getApiErrorMessage = (err, fallback) => {
    const detail = err.response?.data?.detail;

    if (Array.isArray(detail)) {
      const emailError = detail.find(
        (item) => Array.isArray(item?.loc) && item.loc.includes("email")
      );

      if (emailError) return "Please enter a valid email address.";

      const passwordError = detail.find(
        (item) => Array.isArray(item?.loc) && item.loc.includes("password")
      );

      if (passwordError) return "Password must be between 8 and 128 characters.";

      return "Please check the information you entered.";
    }

    if (typeof detail === "string") return detail;
    return fallback;
  };

  const switchRole = (nextRole) => {
    setRole(nextRole);
    setMode("login");
    setPassword("");
    setConfirmPassword("");
    resetMessages();
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    resetMessages();
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const endpoint = role === "staff" ? "/api/auth/staff-login" : "/api/auth/login";
      const { data } = await api.post(endpoint, { email, password });

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = data.user.role === "staff" ? "/staff" : "/dashboard";
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to sign in. Check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    resetMessages();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/api/auth/signup", {
        email,
        password,
        has_message_shooter: true,
        has_lead_distributor: true,
      });

      const { data } = await api.post("/api/auth/login", { email, password });

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/dashboard";
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to create your account."));
    } finally {
      setLoading(false);
    }
  };

  const isSignup = role === "broker" && mode === "signup";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f8fb", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 440, background: "#fff", padding: 32, borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.08)" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", letterSpacing: ".08em" }}>
            AUTOMATION DASHBOARD
          </div>
          <h1 style={{ margin: "8px 0", fontSize: 30 }}>
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p style={{ color: "#667085", margin: 0 }}>
            {isSignup
              ? "Create your broker account to start managing your operations."
              : role === "staff"
                ? "Sign in to your private calling queue."
                : "Sign in to manage your broker operations."}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 22, padding: 4, background: "#f2f4f7", borderRadius: 10 }}>
          <button type="button" onClick={() => switchRole("broker")} style={{ padding: 10, border: 0, borderRadius: 7, background: role === "broker" ? "#fff" : "transparent", fontWeight: 700, cursor: "pointer" }}>
            Broker
          </button>
          <button type="button" onClick={() => switchRole("staff")} style={{ padding: 10, border: 0, borderRadius: 7, background: role === "staff" ? "#fff" : "transparent", fontWeight: 700, cursor: "pointer" }}>
            Staff
          </button>
        </div>

        <form onSubmit={isSignup ? handleSignup : handleLogin}>
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #d0d5dd", borderRadius: 8 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #d0d5dd", borderRadius: 8 }}
            />
            {isSignup && (
              <span style={{ display: "block", marginTop: 5, color: "#667085", fontSize: 12 }}>
                Minimum 8 characters.
              </span>
            )}
          </label>

          {isSignup && (
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Confirm Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #d0d5dd", borderRadius: 8 }}
              />
            </label>
          )}

          {error && (
            <div style={{ background: "#fef3f2", color: "#b42318", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: "#ecfdf3", color: "#027a48", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              {success}
            </div>
          )}

          {role === "staff" && (
            <div style={{ marginBottom: 16, padding: 10, background: "#f9fafb", color: "#667085", borderRadius: 8, fontSize: 13 }}>
              Forgot your password? Contact your broker/admin. They can reset it and give you a temporary password.
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: "100%", padding: 13, border: 0, borderRadius: 8, background: "#2563eb", color: "#fff", fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>
            {loading
              ? (isSignup ? "Creating account..." : "Signing in...")
              : (isSignup ? "Create account" : role === "staff" ? "Staff sign in" : "Broker sign in")}
          </button>
        </form>

        {role === "broker" && (
          <div style={{ textAlign: "center", marginTop: 18, fontSize: 14, color: "#667085" }}>
            {isSignup ? "Already have an account?" : "Don't have a broker account?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(isSignup ? "login" : "signup")}
              style={{ border: 0, background: "transparent", color: "#2563eb", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              {isSignup ? "Sign in" : "Create account"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
