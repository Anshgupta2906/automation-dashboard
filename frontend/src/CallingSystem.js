import React, { useEffect, useState } from "react";
import api from "./api";

const cardStyle = {
  padding: 20,
  border: "1px solid #eaecf0",
  borderRadius: 12,
  background: "#fff",
  marginBottom: 20,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: 11,
  border: "1px solid #d0d5dd",
  borderRadius: 8,
};

const statusMeta = {
  running: { label: "Running", background: "#ecfdf3", color: "#067647" },
  paused: { label: "Paused", background: "#fffaeb", color: "#b54708" },
  stopped: { label: "Stopped", background: "#f2f4f7", color: "#475467" },
};

export default function CallingSystem() {
  const [staff, setStaff] = useState([]);
  const [staffId, setStaffId] = useState("");
  const [nextLead, setNextLead] = useState(null);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("stopped");
  const [bufferSeconds, setBufferSeconds] = useState(7);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const loadStaff = async () => {
    setStaffLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/lead-distributor/staff");
      setStaff(Array.isArray(data) ? data : []);
      if (staffId && !data.some((member) => String(member.id) === String(staffId))) {
        setStaffId("");
      }
      if (!staffId && data.length) setStaffId(String(data[0].id));
    } catch (err) {
      setStaff([]);
      setError(err.response?.data?.detail || "Unable to load staff.");
    } finally {
      setStaffLoading(false);
    }
  };

  const refresh = async (id = staffId) => {
    if (!id) {
      setStats(null);
      setLogs([]);
      setNextLead(null);
      return;
    }

    try {
      const [statusResponse, statsResponse, logsResponse, nextResponse] = await Promise.all([
        api.get("/api/calling/status", { params: { staff_id: id } }),
        api.get("/api/calling/stats", { params: { staff_id: id } }),
        api.get("/api/calling/logs", { params: { staff_id: id } }),
        api.get("/api/calling/next", { params: { staff_id: id } }),
      ]);

      setStatus(statusResponse.data.status || (statusResponse.data.is_calling ? "running" : "stopped"));
      setBufferSeconds(statusResponse.data.buffer_seconds || 7);
      setStats(statsResponse.data);
      setLogs(Array.isArray(logsResponse.data) ? logsResponse.data : []);
      setNextLead(nextResponse.data.status === "ready" ? nextResponse.data.contact : null);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to refresh calling data.");
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    if (staffId) refresh(staffId);
  }, [staffId]);

  useEffect(() => {
    if (!staffId) return undefined;
    const interval = setInterval(() => refresh(staffId), 3000);
    return () => clearInterval(interval);
  }, [staffId]);

  const addStaff = async (event) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Staff name and email are required.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const { data } = await api.post("/api/lead-distributor/staff", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });

      setName("");
      setEmail("");
      setNotice(`${data.name} was added to your team.`);
      await loadStaff();
      setStaffId(String(data.id));
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to add staff member.");
    } finally {
      setLoading(false);
    }
  };

  const start = async () => {
    if (!staffId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/api/calling/start", {
        staff_id: Number(staffId),
        buffer_seconds: Number(bufferSeconds),
      });
      setNotice(data.message);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to start queue.");
    } finally {
      setLoading(false);
    }
  };

  const pause = async () => {
    if (!staffId) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/api/calling/pause", { staff_id: Number(staffId) });
      setNotice("Calling paused. The next lead will remain untouched until resume.");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to pause queue.");
    } finally {
      setLoading(false);
    }
  };

  const resume = async () => {
    if (!staffId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/api/calling/resume", {
        staff_id: Number(staffId),
        buffer_seconds: Number(bufferSeconds),
      });
      setNotice(data.status === "resumed" ? "Calling resumed from the next unattempted lead." : "Calling resumed.");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to resume queue.");
    } finally {
      setLoading(false);
    }
  };

  const stop = async () => {
    if (!staffId) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/api/calling/stop", null, {
        params: { staff_id: Number(staffId) },
      });
      setNotice("Calling queue stopped.");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to stop queue.");
    } finally {
      setLoading(false);
    }
  };

  const complete = async (outcome) => {
    if (!nextLead || !staffId) return;

    setLoading(true);
    setError("");
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
      setError(err.response?.data?.detail || "Unable to save call outcome.");
    } finally {
      setLoading(false);
    }
  };

  const selectedStaff = staff.find((member) => String(member.id) === String(staffId));
  const meta = statusMeta[status] || statusMeta.stopped;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Calling Queue</h2>
      <p style={{ color: "#667085" }}>
        Each staff member has an independent persistent calling session. Start, pause, resume,
        and stop are saved on the server so progress is not lost on refresh or restart.
      </p>

      {notice && (
        <div style={{ padding: 12, background: "#ecfdf3", color: "#067647", borderRadius: 8, marginBottom: 16 }}>
          {notice}
        </div>
      )}

      {error && (
        <div style={{ padding: 12, background: "#fef3f2", color: "#b42318", borderRadius: 8, marginBottom: 16 }}>
          {error}
          <button
            onClick={() => { setError(""); loadStaff(); }}
            disabled={staffLoading}
            style={{ marginLeft: 10, padding: "6px 10px", border: "1px solid #fda29b", borderRadius: 7, background: "#fff", color: "#b42318" }}
          >
            Retry
          </button>
        </div>
      )}

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Team</h3>
        <p style={{ color: "#667085", marginTop: 0 }}>
          Add the staff members who will receive leads and make calls.
        </p>

        <form onSubmit={addStaff} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) minmax(220px,1fr) auto", gap: 10, marginBottom: 16 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Staff full name" autoComplete="name" required style={inputStyle} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Staff email" autoComplete="email" required style={inputStyle} />
          <button type="submit" disabled={loading} style={{ padding: "11px 16px", border: 0, borderRadius: 8, background: "#111827", color: "#fff", fontWeight: 700 }}>
            {loading ? "Saving..." : "Add staff"}
          </button>
        </form>

        {staffLoading ? (
          <p style={{ color: "#667085" }}>Loading staff...</p>
        ) : staff.length === 0 ? (
          <p style={{ color: "#667085", marginBottom: 0 }}>No staff members yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {staff.map((member) => (
              <div key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#f8fafc", borderRadius: 8 }}>
                <div>
                  <strong>{member.name}</strong>
                  <div style={{ color: "#667085", fontSize: 13 }}>{member.email}</div>
                </div>
                {String(member.id) === String(staffId) && (
                  <span style={{ color: "#067647", fontSize: 13, fontWeight: 700 }}>Selected</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontWeight: 600 }}>Caller</label>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} disabled={staffLoading || loading} style={{ padding: 10, minWidth: 220, border: "1px solid #d0d5dd", borderRadius: 8 }}>
            <option value="">Select staff</option>
            {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>

          <label style={{ fontWeight: 600 }}>Buffer</label>
          <select value={bufferSeconds} onChange={(e) => setBufferSeconds(Number(e.target.value))} disabled={loading} style={{ padding: 10, border: "1px solid #d0d5dd", borderRadius: 8 }}>
            <option value={5}>5 sec</option>
            <option value={7}>7 sec</option>
            <option value={10}>10 sec</option>
          </select>

          <button onClick={start} disabled={!staffId || loading || status === "running"} style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: "#16a34a", color: "#fff" }}>
            Start Queue
          </button>

          {status === "running" ? (
            <button onClick={pause} disabled={!staffId || loading} style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: "#d97706", color: "#fff" }}>
              Pause
            </button>
          ) : (
            <button onClick={resume} disabled={!staffId || loading || status !== "paused"} style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: "#2563eb", color: "#fff" }}>
              Resume
            </button>
          )}

          <button onClick={stop} disabled={!staffId || loading || status === "stopped"} style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: "#dc2626", color: "#fff" }}>
            Stop
          </button>

          <button onClick={() => refresh()} disabled={!staffId || loading} style={{ padding: "9px 14px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff" }}>
            Refresh
          </button>
        </div>

        {selectedStaff && (
          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong>{selectedStaff.name}</strong>
            <span style={{ padding: "4px 9px", borderRadius: 999, background: meta.background, color: meta.color, fontSize: 13, fontWeight: 700 }}>
              {meta.label}
            </span>
            <span style={{ color: "#667085", fontSize: 13 }}>Auto-dial provider: pending connection</span>
          </div>
        )}
      </section>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
          {[
            ["Calls today", stats.total_calls_today],
            ["Answered", stats.answered_calls],
            ["Missed", stats.missed_calls],
            ["Failed / busy", stats.failed_calls],
            ["Remaining", stats.remaining],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 16, border: "1px solid #eaecf0", borderRadius: 10, background: "#fff" }}>
              <div style={{ color: "#667085", fontSize: 13 }}>{label}</div>
              <strong style={{ fontSize: 24 }}>{value}</strong>
            </div>
          ))}
        </div>
      )}

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Next lead</h3>
        {!nextLead ? (
          <p style={{ color: "#667085", marginBottom: 0 }}>
            {staffId ? "No uncalled lead is currently available for this staff member." : "Select a staff member to load the calling queue."}
          </p>
        ) : (
          <>
            <strong>{nextLead.name || "Unnamed lead"}</strong>
            <div style={{ margin: "6px 0 16px", color: "#667085" }}>{nextLead.phone}</div>
            <a href={`tel:${nextLead.phone}`} style={{ display: "inline-block", padding: "9px 14px", background: "#2563eb", color: "#fff", borderRadius: 8, textDecoration: "none", marginRight: 8 }}>
              Manual phone fallback
            </a>
            <button onClick={() => complete("answered")} disabled={loading} style={{ padding: "9px 14px", marginRight: 6 }}>Answered</button>
            <button onClick={() => complete("no_answer")} disabled={loading} style={{ padding: "9px 14px", marginRight: 6 }}>No answer</button>
            <button onClick={() => complete("busy")} disabled={loading} style={{ padding: "9px 14px" }}>Busy</button>
          </>
        )}
      </section>

      <section>
        <h3>Recent calls</h3>
        {logs.length === 0 ? (
          <p style={{ color: "#667085" }}>No calls recorded yet.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ display: "flex", justifyContent: "space-between", padding: 12, borderBottom: "1px solid #eaecf0" }}>
              <span>{log.phone}</span>
              <span>{log.status} · {new Date(log.called_at).toLocaleTimeString()}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
