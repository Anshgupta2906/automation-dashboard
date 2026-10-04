import React, { useEffect, useState } from "react";
import api from "./api";

const card = {
  background: "#fff",
  border: "1px solid #eaecf0",
  borderRadius: 14,
  padding: 22,
  marginBottom: 18,
};

export default function StaffDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [staff, setStaff] = useState(user);
  const [status, setStatus] = useState("stopped");
  const [bufferSeconds, setBufferSeconds] = useState(7);
  const [nextLead, setNextLead] = useState(null);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeCall, setActiveCall] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const [me, statusRes, nextRes, statsRes, logsRes] = await Promise.all([
        api.get("/api/staff-calling/me"),
        api.get("/api/staff-calling/status"),
        api.get("/api/staff-calling/next"),
        api.get("/api/staff-calling/stats"),
        api.get("/api/staff-calling/logs"),
      ]);
      setStaff(me.data);
      setStatus(statusRes.data.status || "stopped");
      setBufferSeconds(statusRes.data.buffer_seconds || 7);
      setNextLead(nextRes.data.status === "ready" ? nextRes.data.contact : null);
      setStats(statsRes.data);
      setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load your calling queue.");
    }
  };

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const start = async () => {
    setLoading(true);
    setError("");
    try {
      await api.post("/api/staff-calling/start", { buffer_seconds: bufferSeconds });
      setNotice("Calling queue started.");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to start calling.");
    } finally {
      setLoading(false);
    }
  };

  const pause = async () => {
    setLoading(true);
    try {
      await api.post("/api/staff-calling/pause");
      setNotice("Calling queue paused.");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to pause calling.");
    } finally {
      setLoading(false);
    }
  };

  const stop = async () => {
    setLoading(true);
    try {
      await api.post("/api/staff-calling/stop");
      setNotice("Calling queue stopped.");
      setActiveCall(null);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to stop calling.");
    } finally {
      setLoading(false);
    }
  };

  const callNext = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post("/api/staff-calling/claim-next");
      if (data.status !== "claimed") {
        setNotice(data.message || "No leads remain.");
        await refresh();
        return;
      }
      setActiveCall({
        callId: data.call_id,
        contactId: data.contact.id,
        name: data.contact.name,
        phone: data.contact.phone,
      });
      window.location.href = "tel:" + data.contact.phone;
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to start the next call.");
    } finally {
      setLoading(false);
    }
  };

  const complete = async (outcome) => {
    if (!activeCall) return;
    setLoading(true);
    try {
      await api.post("/api/staff-calling/complete", {
        call_id: activeCall.callId,
        contact_id: activeCall.contactId,
        status: outcome,
        duration: 0,
      });
      setActiveCall(null);
      setNotice("Call saved. The next lead is ready.");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to save the call outcome.");
    } finally {
      setLoading(false);
    }
  };

  const current = activeCall || nextLead;

  return (
    <main style={{ minHeight: "100vh", background: "#f6f8fb", padding: 20 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ color: "#2563eb", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>AUTOMATION DASHBOARD</div>
            <h1 style={{ margin: "6px 0 4px" }}>Hi, {staff.name || "Staff"}</h1>
            <div style={{ color: "#667085" }}>Your private lead calling queue</div>
          </div>
          <button onClick={logout} style={{ padding: "9px 14px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Logout</button>
        </header>

        {notice && <div style={{ ...card, background: "#ecfdf3", color: "#067647", padding: 14 }}>{notice}</div>}
        {error && <div style={{ ...card, background: "#fef3f2", color: "#b42318", padding: 14 }}>{error}</div>}

        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Calling Queue</h2>
              <p style={{ color: "#667085", marginBottom: 0 }}>Only leads assigned to you are shown here.</p>
            </div>
            <span style={{ padding: "6px 10px", borderRadius: 999, background: status === "running" ? "#ecfdf3" : "#f2f4f7", color: status === "running" ? "#067647" : "#475467", fontWeight: 700 }}>{status}</span>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
            <select value={bufferSeconds} onChange={(e) => setBufferSeconds(Number(e.target.value))} disabled={loading} style={{ padding: 10, border: "1px solid #d0d5dd", borderRadius: 8 }}>
              <option value={5}>5 sec buffer</option>
              <option value={7}>7 sec buffer</option>
              <option value={10}>10 sec buffer</option>
            </select>
            {status !== "running" ? (
              <button onClick={start} disabled={loading} style={{ padding: "10px 16px", border: 0, borderRadius: 8, background: "#16a34a", color: "#fff", fontWeight: 700 }}>Start Calling</button>
            ) : (
              <button onClick={pause} disabled={loading} style={{ padding: "10px 16px", border: 0, borderRadius: 8, background: "#d97706", color: "#fff", fontWeight: 700 }}>Pause</button>
            )}
            <button onClick={stop} disabled={loading || status === "stopped"} style={{ padding: "10px 16px", border: 0, borderRadius: 8, background: "#dc2626", color: "#fff", fontWeight: 700 }}>Stop</button>
          </div>
        </section>

        <section style={{ ...card, textAlign: "center" }}>
          <div style={{ color: "#667085", fontSize: 13, fontWeight: 700, letterSpacing: ".05em" }}>NEXT LEAD</div>
          {current ? (
            <>
              <h2 style={{ margin: "10px 0 4px" }}>{current.name || "Unnamed lead"}</h2>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>{current.phone}</div>
              {activeCall ? (
                <>
                  <div style={{ marginBottom: 14, color: "#667085" }}>The phone dialer should now be open. Finish the call, return here, then choose the outcome.</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => complete("answered")} disabled={loading} style={{ padding: "11px 16px" }}>Answered</button>
                    <button onClick={() => complete("no_answer")} disabled={loading} style={{ padding: "11px 16px" }}>No answer</button>
                    <button onClick={() => complete("busy")} disabled={loading} style={{ padding: "11px 16px" }}>Busy / voicemail</button>
                    <button onClick={() => complete("cancelled")} disabled={loading} style={{ padding: "11px 16px" }}>Cancelled</button>
                  </div>
                </>
              ) : (
                <button onClick={callNext} disabled={loading || status !== "running"} style={{ padding: "15px 34px", border: 0, borderRadius: 10, background: status === "running" ? "#2563eb" : "#98a2b3", color: "#fff", fontSize: 17, fontWeight: 800, cursor: status === "running" ? "pointer" : "not-allowed" }}>
                  {loading ? "Opening..." : "📞 Call Next Lead"}
                </button>
              )}
            </>
          ) : (
            <div style={{ padding: "28px 0", color: "#667085" }}>{status === "running" ? "No uncalled leads remain for today." : "Start calling to load your next assigned lead."}</div>
          )}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          {[
            ["Calls today", stats?.total_calls_today ?? "—"],
            ["Answered", stats?.answered_calls ?? "—"],
            ["Missed", stats?.missed_calls ?? "—"],
            ["Failed / busy", stats?.failed_calls ?? "—"],
            ["Remaining", stats?.remaining ?? "—"],
          ].map(([label, value]) => (
            <div key={label} style={{ ...card, marginBottom: 0 }}>
              <div style={{ color: "#667085", fontSize: 13 }}>{label}</div>
              <strong style={{ fontSize: 24 }}>{value}</strong>
            </div>
          ))}
        </section>

        <section style={{ ...card, marginTop: 18 }}>
          <h3 style={{ marginTop: 0 }}>Recent calls</h3>
          {logs.length === 0 ? <p style={{ color: "#667085" }}>No calls recorded yet.</p> : logs.map((log) => (
            <div key={log.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: "1px solid #eaecf0" }}>
              <span>{log.phone}</span>
              <span style={{ color: "#667085" }}>{log.status} · {new Date(log.called_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
