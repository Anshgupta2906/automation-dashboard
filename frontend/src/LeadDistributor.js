import React, { useEffect, useState } from "react";
import api from "./api";

export default function LeadDistributor() {
  const [staff, setStaff] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const [staffResponse, statsResponse] = await Promise.all([
        api.get("/api/lead-distributor/staff"),
        api.get("/api/lead-distributor/stats"),
      ]);
      setStaff(staffResponse.data);
      setStats(statsResponse.data);
    } catch (err) {
      setNotice(err.response?.data?.detail || "Unable to load lead distributor data.");
    }
  };

  useEffect(() => { load(); }, []);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/api/lead-distributor/upload", formData);
      setNotice(`Imported ${data.contacts_added} contacts. ${data.duplicates_skipped} duplicates skipped.`);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.detail || "Import failed.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  const addStaff = async (event) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return setNotice("Name and email are required.");
    setLoading(true);
    try {
      await api.post("/api/lead-distributor/staff", { name, email });
      setName("");
      setEmail("");
      setNotice("Staff member added.");
      await load();
    } catch (err) {
      setNotice(err.response?.data?.detail || "Unable to add staff member.");
    } finally {
      setLoading(false);
    }
  };

  const distribute = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/api/lead-distributor/distribute-now");
      setNotice(`Distributed ${data.total_distributed} leads across ${data.staff_count} staff members.`);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.detail || "Distribution failed.");
    } finally {
      setLoading(false);
    }
  };

  const sendEmails = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/api/lead-distributor/send-emails");
      setNotice(`${data.emails_sent} emails sent, ${data.emails_failed} failed.`);
    } catch (err) {
      setNotice(err.response?.data?.detail || "Email operation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Lead Distributor</h2>
      <p style={{ color: "#667085" }}>Import leads, manage your team, and distribute up to 300 fresh leads per staff member each day.</p>

      {notice && <div style={{ padding: 12, background: "#eef4ff", borderRadius: 8, marginBottom: 16 }}>{notice}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          ["Total contacts", stats?.total_contacts ?? "—"],
          ["Staff", stats?.staff_count ?? "—"],
          ["Distributed today", stats?.distributed_today ?? "—"],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: 18, background: "#fff", border: "1px solid #eaecf0", borderRadius: 12 }}>
            <div style={{ color: "#667085", fontSize: 13 }}>{label}</div>
            <strong style={{ fontSize: 25 }}>{value}</strong>
          </div>
        ))}
      </div>

      <section style={{ padding: 20, border: "1px solid #eaecf0", borderRadius: 12, marginBottom: 20 }}>
        <h3>Import leads</h3>
        <input type="file" accept=".csv,.xlsx" onChange={upload} disabled={loading} />
        <button onClick={distribute} disabled={loading} style={{ marginLeft: 12, padding: "9px 14px", border: 0, borderRadius: 8, background: "#2563eb", color: "#fff", fontWeight: 700 }}>
          {loading ? "Working..." : "Distribute now"}
        </button>
        <button onClick={sendEmails} disabled={loading} style={{ marginLeft: 8, padding: "9px 14px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", fontWeight: 600 }}>
          Email today's leads
        </button>
      </section>

      <section style={{ padding: 20, border: "1px solid #eaecf0", borderRadius: 12, marginBottom: 20 }}>
        <h3>Add staff member</h3>
        <form onSubmit={addStaff} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required style={{ padding: 11, border: "1px solid #d0d5dd", borderRadius: 8 }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required style={{ padding: 11, border: "1px solid #d0d5dd", borderRadius: 8 }} />
          <button disabled={loading} style={{ padding: "11px 16px", border: 0, borderRadius: 8, background: "#111827", color: "#fff" }}>Add</button>
        </form>
      </section>

      <section>
        <h3>Team</h3>
        {staff.length === 0 ? <p style={{ color: "#667085" }}>No staff members yet.</p> : staff.map((member) => (
          <div key={member.id} style={{ display: "flex", justifyContent: "space-between", padding: 14, borderBottom: "1px solid #eaecf0" }}>
            <strong>{member.name}</strong><span style={{ color: "#667085" }}>{member.email}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
