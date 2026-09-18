import React, { useState } from 'react';
import MessageShooter from './MessageShooter';
import LeadDistributor from './LeadDistributor';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('message-shooter');
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>🤖 Automation Dashboard</h1>
        <div>
          <span style={{ marginRight: '20px' }}>Welcome, {user.email}</span>
          <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('message-shooter')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'message-shooter' ? '#007bff' : '#ddd',
            color: activeTab === 'message-shooter' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Message Shooter
        </button>
        <button
          onClick={() => setActiveTab('lead-distributor')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'lead-distributor' ? '#007bff' : '#ddd',
            color: activeTab === 'lead-distributor' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Lead Distributor
        </button>
      </div>

      <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        {activeTab === 'message-shooter' && <MessageShooter />}
        {activeTab === 'lead-distributor' && <LeadDistributor />}
      </div>
    </div>
  );
}