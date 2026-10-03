import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function LeadDistributor() {
  const [file, setFile] = useState(null);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffMembers, setStaffMembers] = useState([]);
  const [contactsPerDay, setContactsPerDay] = useState(300);
  const [selectedDays, setSelectedDays] = useState(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
  const [sendTime, setSendTime] = useState('08:00');
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const showSuccess = (message) => {
    setSuccess(message);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (message) => {
    setError(message);
    setSuccess('');
  };

  const loadStaffMembers = async () => {
    setStaffLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/lead-distributor/staff`, { headers });
      const members = response.data || [];
      setStaffMembers(members);
      setSelectedStaffId((current) => {
        if (current && members.some((staff) => String(staff.id) === String(current))) return current;
        return members.length ? String(members[0].id) : '';
      });
    } catch (err) {
      showError('Unable to load staff members: ' + (err.response?.data?.detail || err.message));
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    loadStaffMembers();
  }, []);

  const handleDayToggle = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleFileUpload = async (e) => {
    const uploadFile = e.target.files[0];
    if (!uploadFile) return;

    setFile(uploadFile);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const response = await axios.post(`${API_URL}/api/lead-distributor/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });
      showSuccess(`✅ ${response.data.contacts_added} contacts uploaded!`);
    } catch (err) {
      showError('❌ Error uploading file: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!staffName.trim()) return showError('❌ Please enter staff name');
    if (!staffEmail.trim()) return showError('❌ Please enter staff email');
    if (!staffEmail.includes('@')) return showError('❌ Please enter a valid email');

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/lead-distributor/staff`, {
        name: staffName.trim(),
        email: staffEmail.trim(),
      }, { headers });

      setStaffName('');
      setStaffEmail('');
      await loadStaffMembers();
      showSuccess('✅ Staff member added!');
    } catch (err) {
      showError('❌ Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleConfigure = async () => {
    if (selectedDays.length === 0) return showError('❌ Please select at least one day');
    if (!staffMembers.length) return showError('❌ Add at least one staff member first');

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/lead-distributor/configure`, {
        contacts_per_person: contactsPerDay,
        selected_days: selectedDays,
        send_time: sendTime,
        enabled: true,
        exclusion_window: 0,
      }, { headers });
      showSuccess('✅ Configuration saved!');
    } catch (err) {
      showError('❌ Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGetStats = async () => {
    if (!selectedStaffId) return showError('❌ Select a staff member first');

    try {
      const response = await axios.get(`${API_URL}/api/lead-distributor/stats`, {
        headers,
        params: { staff_id: Number(selectedStaffId) },
      });
      setStats(response.data);
    } catch (err) {
      showError('❌ Error fetching stats: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSendEmails = async () => {
    if (!selectedStaffId) return showError('❌ Select a staff member first');

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/lead-distributor/send-emails`,
        {},
        { headers, params: { staff_id: Number(selectedStaffId) } }
      );
      showSuccess('📧 ' + response.data.message);
    } catch (err) {
      showError('❌ Error sending emails: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>📊 Lead Distributor</h2>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Step 1: Upload Contacts</h3>
        <p style={{ fontSize: '12px', color: '#666' }}>Upload CSV or Excel file with phone numbers</p>
        <input type="file" accept=".csv,.xlsx" onChange={handleFileUpload} disabled={loading} />
        {file && <p style={{ fontSize: '13px', color: '#555' }}>Selected file: <strong>{file.name}</strong></p>}
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Step 2: Add Staff Members</h3>
        <p style={{ fontSize: '12px', color: '#666' }}>Add staff members who will receive distributed leads.</p>

        <input
          type="text"
          placeholder="Staff name"
          value={staffName}
          onChange={(e) => setStaffName(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }}
        />
        <input
          type="email"
          placeholder="Staff email"
          value={staffEmail}
          onChange={(e) => setStaffEmail(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }}
        />

        <button onClick={handleAddStaff} disabled={loading} style={{
          padding: '10px 20px', backgroundColor: '#007bff', color: 'white',
          border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer'
        }}>
          {loading ? 'Adding...' : '+ Add Staff Member'}
        </button>

        <div style={{ marginTop: '18px' }}>
          <h4>Currently Added Staff Members</h4>

          {staffLoading ? (
            <p style={{ color: '#666' }}>Loading staff members...</p>
          ) : staffMembers.length === 0 ? (
            <p style={{ color: '#777' }}>No staff members added yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {staffMembers.map((staff) => {
                const selected = String(staff.id) === String(selectedStaffId);
                return (
                  <div key={staff.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', backgroundColor: 'white',
                    border: selected ? '2px solid #007bff' : '1px solid #ddd',
                    borderRadius: '6px'
                  }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{staff.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{staff.email}</div>
                    </div>
                    <button type="button" onClick={() => setSelectedStaffId(String(staff.id))} style={{
                      padding: '7px 12px',
                      backgroundColor: selected ? '#e7f3ff' : '#f5f5f5',
                      color: selected ? '#0056b3' : '#333',
                      border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer'
                    }}>
                      {selected ? '✓ Selected' : 'Select'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Step 3: Configuration</h3>

        <div style={{ marginBottom: '10px' }}>
          <label>Contacts per person per day:</label>
          <input
            type="number"
            min="1"
            value={contactsPerDay}
            onChange={(e) => setContactsPerDay(Number(e.target.value))}
            style={{ padding: '10px', marginLeft: '10px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Send Time (for distribution):</label>
          <input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} style={{ padding: '10px', marginLeft: '10px' }} />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Select Days:</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
            {days.map(day => (
              <label key={day}>
                <input type="checkbox" checked={selectedDays.includes(day)} onChange={() => handleDayToggle(day)} />
                {' ' + day.charAt(0).toUpperCase() + day.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <button onClick={handleConfigure} disabled={loading} style={{
          padding: '10px 20px', backgroundColor: '#28a745', color: 'white',
          border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', marginRight: '10px'
        }}>
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>

        <button onClick={handleSendEmails} disabled={loading || !selectedStaffId} style={{
          padding: '10px 20px', backgroundColor: selectedStaffId ? '#17a2b8' : '#aaa',
          color: 'white', border: 'none', borderRadius: '4px',
          cursor: loading || !selectedStaffId ? 'not-allowed' : 'pointer'
        }}>
          {loading ? 'Sending...' : '📧 Send Emails Now'}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Distribution Statistics</h3>
        <div style={{ marginBottom: '10px' }}>
          <label>Selected Staff:</label>
          <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} disabled={!staffMembers.length} style={{ padding: '10px', marginLeft: '10px', minWidth: '240px' }}>
            {!staffMembers.length ? (
              <option value="">No staff members</option>
            ) : (
              staffMembers.map(staff => (
                <option key={staff.id} value={staff.id}>{staff.name} — {staff.email}</option>
              ))
            )}
          </select>
        </div>

        <button onClick={handleGetStats} disabled={!selectedStaffId} style={{
          padding: '10px 20px', backgroundColor: '#6c757d', color: 'white',
          border: 'none', borderRadius: '4px', cursor: selectedStaffId ? 'pointer' : 'not-allowed'
        }}>
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

      {success && <p style={{ color: 'green', fontWeight: 'bold' }}>{success}</p>}
      {error && <p style={{ color: '#b00020', fontWeight: 'bold' }}>{error}</p>}
    </div>
  );
}