import React, { useEffect, useState } from "react";
import api from "./api";

export default function CallingSystem() {
  const [staff, setStaff] = useState([]);
  const [staffId, setStaffId] = useState("");
  const [nextLead, setNextLead] = useState(null);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("stopped");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const loadStaff = async () => {
    try {
      const { data } = await api.get("/api/lead-distributor/staff");
      setStaff(data);
      if (!staffId && data.length) setStaffId(String(data[0].id));
    } catch (err) {
      setNotice(err.response?.data?.detail || "Unable to load staff.");
    }
  };

  const refresh = async (id = staffId) => {
    if (!id) return;
    try {
      const [statusResponse, statsResponse, logsResponse, nextResponse] = await Promise.all([
        api.get("/api/calling/status", { params: { staff_id: id } }),
        api.get("/api/calling/stats", { params: { staff_id: id } }),
        api.get("/api/calling/logs", { params: { staff_id: id } }),
        api.get("/api/calling/next", { params: { staff_id: id } }),
      ]);
      setStatus(statusResponse.data.is_calling ? "active" : "stopped");
      setStats(statsResponse.data);
      setLogs(logsResponse.data);
      setNextLead(nextResponse.data.status === "ready" ? nextResponse.data.contact : null);
    } catch (err) {
      setNotice(err.response?.data?.detail || "Unable to refresh calling data.");
    }
  };

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { if (staffId) refresh(); }, [staffId]);

  const start = async () => {
    setLoading(true);
    try {
      await api.post("/api/calling/start", { staff_id: Number(staffId), buffer_seconds: 10 });
      setNotice("Call queue started. No external provider is being used yet.");
      await refresh();
    } catch (err) {
      setNotice(err.response?.data?.detail || "Unable to start queue.");
    } finally {
      setLoading(false);
    }
  };

  const stop = async () => {
    setLoading(true);
    try {
      await api.post("/api/calling/stop", null, { params: { staff_id: Number(staffId) } });
      await refresh();
    } catch (err) {
      setNotice(err.response?.data?.detail || "Unable to stop queue.");
    } finally {
      setLoading(false);
    }
  };

  const complete = async (outcome) => {
    if (!nextLead) return;
    setLoading(true);
    try {
      await api.post("/api/calling/complete", {
        staff_id: Number(staffId),
        contact_id: nextLead.id,
        status: outcome,
        duration: 0,
      });
      setNotice(`Call marked as ${outcome.replace("_", " ")}.`);
      await refresh();
    } catch (err) {
      setNotice(err.response?.data?.detail || "Unable to save call outcome.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Calling Queue</h2>
      <p style={{ color: "#667085" }}>The queue is provider-independent. Add telephony integration later without changing the workflow.</p>

      {notice && <div style={{ padding: 12, background: "#eef4ff", borderRadius: 8, marginBottom: 16 }}>{notice}</div>}

      <section style={{ padding: 20, border: "1px solid #eaecf0", borderRadius: 12, marginBottom: 20 }}>
        <label style={{ fontWeight: 600 }}>Staff member </label>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ padding: 10, marginLeft: 8 }}>
          <option value="">Select staff</option>
          {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>

        <button onClick={start} disabled={!staffId || loading || status === "active"} style={{ marginLeft: 12, padding: "9px 14px", border: 0, borderRadius: 8, background: "#16a34a", color: "#fff" }}>Start queue</button>
        <button onClick={stop} disabled={!staffId || loading || status !== "active"} style={{ marginLeft: 8, padding: "9px 14px", border: 0, borderRadius: 8, background: "#dc2626", color: "#fff" }}>Stop</button>
        <button onClick={() => refresh()} disabled={!staffId || loading} style={{ marginLeft: 8, padding: "9px 14px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff" }}>Refresh</button>
      </section>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
          {[
            ["Calls today", stats.total_calls_today],
            ["Answered", stats.answered_calls],
            ["Missed", stats.missed_calls],
            ["Remaining", stats.remaining],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 16, border: "1px solid #eaecf0", borderRadius: 10, background: "#fff" }}>
              <div style={{ color: "#667085", fontSize: 13 }}>{label}</div>
              <strong style={{ fontSize: 24 }}>{value}</strong>
            </div>
          ))}
        </div>
      )}

      <section style={{ padding: 20, border: "1px solid #eaecf0", borderRadius: 12, marginBottom: 20 }}>
        <h3>Next lead</h3>
        {!nextLead ? <p style={{ color: "#667085" }}>No uncalled lead is currently available.</p> : (
          <>
            <strong>{nextLead.name || "Unnamed lead"}</strong>
            <div style={{ margin: "6px 0 16px", color: "#667085" }}>{nextLead.phone}</div>
            <a href={`tel:${nextLead.phone}`} style={{ display: "inline-block", padding: "9px 14px", background: "#2563eb", color: "#fff", borderRadius: 8, textDecoration: "none", marginRight: 8 }}>Call from phone</a>
            <button onClick={() => complete("answered")} disabled={loading} style={{ padding: "9px 14px", marginRight: 6 }}>Answered</button>
            <button onClick={() => complete("no_answer")} disabled={loading} style={{ padding: "9px 14px", marginRight: 6 }}>No answer</button>
            <button onClick={() => complete("busy")} disabled={loading} style={{ padding: "9px 14px" }}>Busy</button>
          </>
        )}
      </section>

      <section>
        <h3>Recent calls</h3>
        {logs.length === 0 ? <p style={{ color: "#667085" }}>No calls recorded yet.</p> : logs.map((log) => (
          <div key={log.id} style={{ display: "flex", justifyContent: "space-between", padding: 12, borderBottom: "1px solid #eaecf0" }}>
            <span>{log.phone}</span><span>{log.status} · {new Date(log.called_at).toLocaleTimeString()}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
