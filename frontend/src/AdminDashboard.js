import React, { useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
const plans = [
  ["none", "No Plan"],
  ["message_shooter", "Message Shooter — ₹2,000/month"],
  ["lead_distributor", "Lead Distributor — ₹5,000/month"],
  ["all_in_one", "All-in-One — ₹12,000/month"],
];
const statuses = ["pending", "active", "paused", "suspended", "expired"];

export default function AdminDashboard() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("admin_token")));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const adminApi = axios.create({ baseURL: API_URL });
  adminApi.interceptors.request.use(config => {
    const token = localStorage.getItem("admin_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  const loadCustomers = async () => {
    try {
      const { data } = await adminApi.get("/api/admin/customers");
      setCustomers(data);
    } catch (err) {
      if ([401,403].includes(err.response?.status)) {
        localStorage.removeItem("admin_token");
        setLoggedIn(false);
      }
      setError(err.response?.data?.detail || "Unable to load customers.");
    }
  };

  useEffect(() => { if (loggedIn) loadCustomers(); }, [loggedIn]);

  const login = async e => {
    e.preventDefault(); setError("");
    try {
      const { data } = await axios.post(`${API_URL}/api/admin/login`, { email, password });
      localStorage.setItem("admin_token", data.access_token);
      setLoggedIn(true); setPassword("");
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to sign in.");
    }
  };

  const updateLocal = (id, field, value) =>
    setCustomers(items => items.map(c => c.id === id ? { ...c, [field]: value } : c));

  const save = async c => {
    setError(""); setMessage("");
    try {
      await adminApi.patch(`/api/admin/customers/${c.id}/subscription`, {
        plan: c.plan, status: c.status,
        expires_at: c.expires_at ? new Date(c.expires_at).toISOString() : null,
      });
      setMessage(`Updated ${c.email}.`); await loadCustomers();
    } catch (err) { setError(err.response?.data?.detail || "Unable to update subscription."); }
  };

  const remove = async c => {
    if (!window.confirm(`Delete ${c.email} permanently?`)) return;
    try {
      await adminApi.delete(`/api/admin/customers/${c.id}`);
      setMessage(`Deleted ${c.email}.`); await loadCustomers();
    } catch (err) { setError(err.response?.data?.detail || "Unable to delete customer."); }
  };

  const logout = () => { localStorage.removeItem("admin_token"); setLoggedIn(false); setCustomers([]); };

  if (!loggedIn) return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f6f8fb",padding:24}}>
      <section style={{width:"100%",maxWidth:430,background:"#fff",padding:32,borderRadius:16,boxShadow:"0 12px 40px rgba(0,0,0,.08)"}}>
        <div style={{color:"#7c3aed",fontSize:13,fontWeight:800}}>AUTOMATION DASHBOARD</div>
        <h1>Admin Panel</h1><p style={{color:"#667085"}}>Manage customer plans, status and expiry.</p>
        <form onSubmit={login}>
          <input type="email" required placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:"100%",boxSizing:"border-box",padding:12,marginBottom:12,border:"1px solid #d0d5dd",borderRadius:8}} />
          <input type="password" required placeholder="Admin password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:"100%",boxSizing:"border-box",padding:12,marginBottom:12,border:"1px solid #d0d5dd",borderRadius:8}} />
          {error && <div style={{background:"#fef2f2",color:"#b91c1c",padding:10,borderRadius:8,marginBottom:12}}>{error}</div>}
          <button style={{width:"100%",padding:12,border:0,borderRadius:8,background:"#7c3aed",color:"#fff",fontWeight:700}}>Admin Sign in</button>
        </form>
      </section>
    </main>
  );

  return (
    <main style={{minHeight:"100vh",background:"#f6f8fb",padding:24}}>
      <div style={{maxWidth:1250,margin:"0 auto"}}>
        <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div><h1 style={{margin:0}}>Admin Panel</h1><p style={{color:"#667085"}}>Customer & subscription management</p></div>
          <button onClick={logout} style={{padding:"10px 16px",border:0,borderRadius:8,background:"#dc2626",color:"#fff",fontWeight:700}}>Logout</button>
        </header>
        {error && <div style={{background:"#fef2f2",color:"#b91c1c",padding:12,borderRadius:8,marginBottom:12}}>{error}</div>}
        {message && <div style={{background:"#ecfdf3",color:"#027a48",padding:12,borderRadius:8,marginBottom:12}}>{message}</div>}
        <div style={{background:"#fff",borderRadius:12,overflowX:"auto",boxShadow:"0 4px 18px rgba(0,0,0,.05)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:950}}>
            <thead><tr style={{background:"#f9fafb"}}>
              <th style={{textAlign:"left",padding:14}}>Customer</th><th style={{textAlign:"left",padding:14}}>Plan</th><th style={{textAlign:"left",padding:14}}>Status</th><th style={{textAlign:"left",padding:14}}>Expiry</th><th style={{textAlign:"left",padding:14}}>Actions</th>
            </tr></thead>
            <tbody>
              {customers.map(c=><tr key={c.id} style={{borderTop:"1px solid #eaecf0"}}>
                <td style={{padding:14}}><strong>{c.email}</strong><div style={{fontSize:12,color:"#667085"}}>ID: {c.id}</div></td>
                <td style={{padding:14}}><select value={c.plan} onChange={e=>updateLocal(c.id,"plan",e.target.value)} style={{padding:8,minWidth:220}}>
                  {plans.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td>
                <td style={{padding:14}}><select value={c.status} onChange={e=>updateLocal(c.id,"status",e.target.value)} style={{padding:8}}>
                  {statuses.map(s=><option key={s} value={s}>{s}</option>)}</select></td>
                <td style={{padding:14}}><input type="date" value={c.expires_at ? new Date(c.expires_at).toISOString().slice(0,10) : ""} onChange={e=>updateLocal(c.id,"expires_at",e.target.value ? `${e.target.value}T23:59:59` : null)} /></td>
                <td style={{padding:14,whiteSpace:"nowrap"}}>
                  <button onClick={()=>save(c)} style={{padding:"8px 12px",background:"#2563eb",color:"#fff",border:0,borderRadius:7,fontWeight:700,marginRight:8}}>Save</button>
                  <button onClick={()=>remove(c)} style={{padding:"8px 12px",background:"#dc2626",color:"#fff",border:0,borderRadius:7,fontWeight:700}}>Delete</button>
                </td>
              </tr>)}
              {!customers.length && <tr><td colSpan="5" style={{padding:30,textAlign:"center",color:"#667085"}}>No customers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
