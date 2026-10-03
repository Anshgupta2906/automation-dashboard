import React, { useEffect, useState } from "react";
import api from "./api";

const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function MessageShooter() {
  const [message, setMessage] = useState("");
  const [sendTime, setSendTime] = useState("09:00");
  const [selectedDays, setSelectedDays] = useState(days);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);

  const load = async () => {
    try {
      const [campaignsResponse, statsResponse] = await Promise.all([
        api.get("/api/message-shooter/campaigns"),
        api.get("/api/message-shooter/stats"),
      ]);
      setCampaigns(campaignsResponse.data);
      setStats(statsResponse.data);
    } catch (err) {
      setNotice(err.response?.data?.detail || "Unable to load message data.");
    }
  };

  useEffect(() => { load(); }, []);

  const toggleDay = (day) => {
    setSelectedDays((current) => current.includes(day) ? current.filter((d) => d !== day) : [...current, day]);
  };

  const uploadContacts = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setNotice("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/api/message-shooter/upload", formData);
      setNotice(`Imported ${data.contacts_added} contacts. ${data.duplicates_skipped} duplicates skipped.`);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.detail || "Contact import failed.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  const schedule = async () => {
    if (!message.trim()) return setNotice("Enter a message first.");
    if (!selectedDays.length) return setNotice("Select at least one day.");

    setLoading(true);
    setNotice("");
    try {
      await api.post("/api/message-shooter/schedule", {
        message,
        send_time: sendTime,
        enabled: true,
        selected_days: selectedDays,
      });
      setMessage("");
      setNotice("Campaign saved. At the scheduled time, messages will enter the provider queue.");
      await load();
    } catch (err) {
      setNotice(err.response?.data?.detail || "Unable to schedule campaign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Message Shooter</h2>
      <p style={{ color: "#667085" }}>Build campaigns now; connect SMS/WhatsApp delivery later.</p>

      {notice && <div style={{ padding: 12, background: "#eef4ff", borderRadius: 8, marginBottom: 16 }}>{notice}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          ["Contacts", stats?.contacts ?? "—"],
          ["Campaigns", stats?.campaigns ?? "—"],
          ["Queued", stats?.queued_messages ?? "—"],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: 18, background: "#fff", border: "1px solid #eaecf0", borderRadius: 12 }}>
            <div style={{ color: "#667085", fontSize: 13 }}>{label}</div>
            <strong style={{ fontSize: 25 }}>{value}</strong>
          </div>
        ))}
      </div>

      <section style={{ padding: 20, border: "1px solid #eaecf0", borderRadius: 12, marginBottom: 20 }}>
        <h3>1. Import contacts</h3>
        <input type="file" accept=".csv,.xlsx" onChange={uploadContacts} disabled={loading} />
      </section>

      <section style={{ padding: 20, border: "1px solid #eaecf0", borderRadius: 12 }}>
        <h3>2. Create campaign</h3>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your campaign message..." rows={5}
          style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #d0d5dd", borderRadius: 8, resize: "vertical" }} />

        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
          <label>Time <input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} /></label>
          {days.map((day) => (
            <label key={day} style={{ fontSize: 13 }}>
              <input type="checkbox" checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} /> {day.slice(0, 3)}
            </label>
          ))}
        </div>

        <button onClick={schedule} disabled={loading} style={{ marginTop: 18, padding: "11px 18px", border: 0, borderRadius: 8, background: "#2563eb", color: "#fff", fontWeight: 700 }}>
          {loading ? "Saving..." : "Schedule campaign"}
        </button>
      </section>

      <section style={{ marginTop: 20 }}>
        <h3>Campaigns</h3>
        {campaigns.length === 0 ? <p style={{ color: "#667085" }}>No campaigns yet.</p> : campaigns.map((campaign) => (
          <div key={campaign.id} style={{ padding: 16, border: "1px solid #eaecf0", borderRadius: 10, marginBottom: 8, background: "#fff" }}>
            <strong>{campaign.send_time}</strong> · {campaign.selected_days.join(", ")}
            <div style={{ marginTop: 6 }}>{campaign.message}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
