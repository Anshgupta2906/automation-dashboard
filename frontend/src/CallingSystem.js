import React, { useEffect, useState } from "react";
import api from "./api";

const cardStyle = {
  padding: 20, border: "1px solid #eaecf0", borderRadius: 12, background: "#fff", marginBottom: 20,
};
const inputStyle = { width: "100%", boxSizing: "border-box", padding: 11, border: "1px solid #d0d5dd", borderRadius: 8 };
const statusMeta = {
  running: { label: "Calling", background: "#ecfdf3", color: "#067647" },
  paused: { label: "Paused", background: "#fffaeb", color: "#b54708" },
  stopped: { label: "Stopped", background: "#f2f4f7", color: "#475467" },
};

export default function CallingSystem() {
  const [staff, setStaff] = useState([]);
  const [bufferSeconds, setBufferSeconds] = useState({});
  const [nextLeads, setNextLeads] = useState({});
  const [staffLoading, setStaffLoading] = useState(false);
  const [actionStaffId, setActionStaffId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadTeam = async (showLoader = false) => {
    if (showLoader) setStaffLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/calling/team-status");
      const members = Array.isArray(data) ? data : [];
      setStaff(members);
      const nextResults = await Promise.all(members.map(async (member) => {
        try {
          const response = await api.get("/api/calling/next", { params: { staff_id: member.staff_id } });
          return [member.staff_id, response.data.status === "ready" ? response.data.contact : null];
        } catch {
          return [member.staff_id, null];
        }
      }));
      setNextLeads(Object.fromEntries(nextResults));
      setBufferSeconds((current) => {
        const next = { ...current };
        members.forEach((member) => {
          if (!next[member.staff_id]) next[member.staff_id] = member.buffer_seconds || 7;
        });
        return next;
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load calling team.");
    } finally {
      if (showLoader) setStaffLoading(false);
    }
  };

  useEffect(() => {
    loadTeam(true);
    const interval = window.setInterval(() => loadTeam(false), 3000);
    return () => window.clearInterval(interval);
  }, []);

  const addStaff = async (event) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return setError("Staff name and email are required.");
    setLoading(true); setError(""); setNotice("");
    try {
      const { data } = await api.post("/api/lead-distributor/staff", { name: name.trim(), email: email.trim().toLowerCase() });
      setName(""); setEmail("");
      setNotice(data.name + " was added to your team.");
      await loadTeam(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to add staff member.");
    } finally { setLoading(false); }
  };

  const runAction = async (member, action) => {
    const id = member.staff_id;
    setActionStaffId(id); setError(""); setNotice("");
    try {
      if (action === "start" || action === "resume") {
        await api.post("/api/calling/" + action, { staff_id: id, buffer_seconds: Number(bufferSeconds[id] || member.buffer_seconds || 7) });
      } else if (action === "pause") {
        await api.post("/api/calling/pause", { staff_id: id });
      } else {
        await api.post("/api/calling/stop", null, { params: { staff_id: id } });
      }
      const messages = { start: "Calling queue started.", pause: "Calling queue paused.", resume: "Calling queue resumed.", stop: "Calling queue stopped." };
      setNotice(member.name + ": " + messages[action]);
      await loadTeam(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to " + action + " the calling queue.");
    } finally { setActionStaffId(null); }
  };

  const removeStaff = async (member) => {
    if (!window.confirm("Remove " + member.name + " from the active team? Existing call and assignment history will remain stored.")) return;
    setActionStaffId(member.staff_id); setError("");
    try {
      await api.delete("/api/lead-distributor/staff/" + member.staff_id);
      setNotice(member.name + " was removed from the active team.");
      await loadTeam(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to remove staff member.");
    } finally { setActionStaffId(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div><h2 style={{ marginTop: 0, marginBottom: 6 }}>Calling Queue</h2><p style={{ color: "#667085", marginTop: 0 }}>Every staff member has an independent persistent calling session.</p></div>
        <button onClick={() => loadTeam(true)} disabled={staffLoading || loading || actionStaffId !== null} style={{ padding: "9px 14px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff" }}>{staffLoading ? "Refreshing..." : "Refresh Team"}</button>
      </div>
      {lastUpdated && <div style={{ color: "#98a2b3", fontSize: 12, marginBottom: 14 }}>Updated {lastUpdated.toLocaleTimeString()}</div>}
      {notice && <div style={{ padding: 12, background: "#ecfdf3", color: "#067647", borderRadius: 8, marginBottom: 16 }}>{notice}</div>}
      {error && <div style={{ padding: 12, background: "#fef3f2", color: "#b42318", borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Team</h3>
        <p style={{ color: "#667085", marginTop: 0 }}>Each caller has their own queue, status and call count. There is no global "selected" caller.</p>
        <form onSubmit={addStaff} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) minmax(220px,1fr) auto", gap: 10, marginBottom: 18 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Staff full name" autoComplete="name" required style={inputStyle} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Staff email" autoComplete="email" required style={inputStyle} />
          <button type="submit" disabled={loading || actionStaffId !== null} style={{ padding: "11px 16px", border: 0, borderRadius: 8, background: "#111827", color: "#fff", fontWeight: 700 }}>{loading ? "Saving..." : "Add staff"}</button>
        </form>

        {staffLoading && staff.length === 0 ? <p style={{ color: "#667085" }}>Loading staff...</p> : staff.length === 0 ? <p style={{ color: "#667085", marginBottom: 0 }}>No active staff members yet.</p> : (
          <div style={{ display: "grid", gap: 10 }}>
            {staff.map((member) => {
              const meta = statusMeta[member.status] || statusMeta.stopped;
              const busy = actionStaffId === member.staff_id;
              const nextLead = nextLeads[member.staff_id];
              return (
                <div key={member.staff_id} style={{ padding: 16, background: "#f8fafc", borderRadius: 10, border: "1px solid #eaecf0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div><strong style={{ fontSize: 16 }}>{member.name}</strong><div style={{ color: "#667085", fontSize: 13, marginTop: 3 }}>{member.email}</div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ padding: "4px 9px", borderRadius: 999, background: meta.background, color: meta.color, fontSize: 13, fontWeight: 700 }}>{meta.label}</span>
                      <strong>{member.calls_today} calls today</strong>
                      <span style={{ color: "#667085", fontSize: 13 }}>{member.remaining} remaining</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                    <label style={{ color: "#475467", fontSize: 13 }}>Buffer</label>
                    <select value={bufferSeconds[member.staff_id] || member.buffer_seconds || 7} onChange={(e) => setBufferSeconds((current) => ({ ...current, [member.staff_id]: Number(e.target.value) }))} disabled={busy || loading} style={{ padding: 8, border: "1px solid #d0d5dd", borderRadius: 7 }}>
                      <option value={5}>5 sec</option><option value={7}>7 sec</option><option value={10}>10 sec</option>
                    </select>
                    {member.status === "running" ? <button onClick={() => runAction(member, "pause")} disabled={busy} style={{ padding: "8px 12px", border: 0, borderRadius: 7, background: "#d97706", color: "#fff" }}>{busy ? "Working..." : "Pause"}</button> : member.status === "paused" ? <button onClick={() => runAction(member, "resume")} disabled={busy} style={{ padding: "8px 12px", border: 0, borderRadius: 7, background: "#2563eb", color: "#fff" }}>{busy ? "Working..." : "Resume"}</button> : <button onClick={() => runAction(member, "start")} disabled={busy} style={{ padding: "8px 12px", border: 0, borderRadius: 7, background: "#16a34a", color: "#fff" }}>{busy ? "Working..." : "Start Calling"}</button>}
                    <button onClick={() => runAction(member, "stop")} disabled={busy || member.status === "stopped"} style={{ padding: "8px 12px", border: 0, borderRadius: 7, background: "#dc2626", color: "#fff" }}>Stop</button>
                    <button onClick={() => removeStaff(member)} disabled={busy || loading} style={{ padding: "8px 12px", border: "1px solid #d0d5dd", borderRadius: 7, background: "#fff", color: "#475467" }}>Remove</button>
                  </div>
                  <div style={{ marginTop: 12, color: "#667085", fontSize: 13 }}><strong style={{ color: "#344054" }}>Next lead:</strong> {nextLead ? (nextLead.name || "Unnamed lead") + " · " + nextLead.phone : "No uncalled lead currently available."}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section style={{ ...cardStyle, background: "#f9fafb" }}><h3 style={{ marginTop: 0 }}>Calling control</h3><p style={{ color: "#667085", marginBottom: 0 }}>The broker can control each queue independently. Staff members can also operate their own private queue from the Staff portal.</p></section>
    </div>
  );
}
