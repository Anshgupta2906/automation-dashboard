import React, { useState } from 'react';
import axios from 'axios';

export default function LeadDistributor() {
  const [file, setFile] = useState(null);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [contactsPerDay, setContactsPerDay] = useState(300);
  const [selectedDays, setSelectedDays] = useState(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
  const [sendTime, setSendTime] = useState('08:00');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState(null);
  const [staffId, setStaffId] = useState(1);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const handleDayToggle = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleFileUpload = async (e) => {
    const uploadFile = e.target.files[0];
    if (!uploadFile) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const response = await axios.post('http://localhost:8000/api/lead-distributor/upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      setSuccess(`✅ ${response.data.contacts_added} contacts uploaded!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert('❌ Error uploading file: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    // VALIDATION
    if (!staffName.trim()) {
      alert('❌ Please enter staff name');
      return;
    }
    if (!staffEmail.trim()) {
      alert('❌ Please enter staff email');
      return;
    }
    if (!staffEmail.includes('@')) {
      alert('❌ Please enter valid email');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:8000/api/lead-distributor/staff', {
        name: staffName,
        email: staffEmail
      }, { headers });
      setSuccess('✅ Staff member added!');
      setStaffName('');
      setStaffEmail('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert('❌ Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleConfigure = async () => {
    if (selectedDays.length === 0) {
      alert('❌ Please select at least one day');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:8000/api/lead-distributor/configure', {
        contacts_per_person: contactsPerDay,
        selected_days: selectedDays,
        send_time: sendTime,
        enabled: true,
        exclusion_window: 0
      }, { headers });
      setSuccess('✅ Configuration saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert('❌ Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGetStats = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/lead-distributor/stats', {
        headers,
        params: { staff_id: staffId }
      });
      setStats(response.data);
    } catch (err) {
      alert('❌ Error fetching stats: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSendEmails = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        'http://localhost:8000/api/lead-distributor/send-emails',
        {},
        {
          headers,
          params: { staff_id: staffId }
        }
      );
      alert('✅ ' + response.data.message);
    } catch (err) {
      alert('❌ Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>📊 Lead Distributor</h2>

      {/* UPLOAD CONTACTS */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Step 1: Upload Contacts</h3>
        <p style={{ fontSize: '12px', color: '#666' }}>Upload CSV or Excel file with phone numbers</p>
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileUpload}
          disabled={loading}
          style={{ marginBottom: '10px' }}
        />
        {success && <p style={{ color: 'green', fontWeight: 'bold' }}>{success}</p>}
      </div>

      {/* ADD STAFF */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Step 2: Add Staff Members</h3>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Staff name"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="email"
            placeholder="Staff email"
            value={staffEmail}
            onChange={(e) => setStaffEmail(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          />
        </div>
        <button
          onClick={handleAddStaff}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Adding...' : 'Add Staff'}
        </button>
      </div>

      {/* CONFIGURATION */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Step 3: Configuration</h3>
        
        <div style={{ marginBottom: '10px' }}>
          <label>Contacts per person per day:</label>
          <input
            type="number"
            value={contactsPerDay}
            onChange={(e) => setContactsPerDay(parseInt(e.target.value))}
            style={{ padding: '10px', marginLeft: '10px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Send Time (for distribution):</label>
          <input
            type="time"
            value={sendTime}
            onChange={(e) => setSendTime(e.target.value)}
            style={{ padding: '10px', marginLeft: '10px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Select Days:</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
            {days.map(day => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={selectedDays.includes(day)}
                  onChange={() => handleDayToggle(day)}
                />
                {' ' + day.charAt(0).toUpperCase() + day.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleConfigure}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>

        <button
          onClick={handleSendEmails}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Sending...' : '📧 Send Emails Now'}
        </button>
      </div>

      {/* STATS */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label>Staff ID:</label>
          <input
            type="number"
            value={staffId}
            onChange={(e) => setStaffId(parseInt(e.target.value))}
            style={{ padding: '10px', marginLeft: '10px' }}
          />
        </div>

        <button
          onClick={handleGetStats}
          style={{
            padding: '10px 20px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Get Statistics
        </button>

        {stats && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
            <p>📞 Total Contacts: <strong>{stats.total_contacts}</strong></p>
            <p>👥 Staff Count: <strong>{stats.staff_count}</strong></p>
            <p>📤 Distributed Today: <strong>{stats.distributed_today}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}