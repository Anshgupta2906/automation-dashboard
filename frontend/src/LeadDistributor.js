import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function LeadDistributor() {
  const [file, setFile] = useState(null);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffMembers, setStaffMembers] = useState([]);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const [contactsPerDay, setContactsPerDay] = useState(300);
  const [selectedDays, setSelectedDays] = useState([
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ]);
  const [sendTime, setSendTime] = useState('08:00');

  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  const days = [
    'monday', 'tuesday', 'wednesday', 'thursday',
    'friday', 'saturday', 'sunday'
  ];

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const showSuccess = (message) => {
    setSuccess(message);
    setError('');
    window.setTimeout(() => setSuccess(''), 4000);
  };

  const showError = (message) => {
    setError(message);
    setSuccess('');
  };

  const loadStaffMembers = async () => {
    setStaffLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/lead-distributor/staff`,
        { headers }
      );
      setStaffMembers(response.data || []);
    } catch (err) {
      showError('Unable to load staff members: ' + (err.response?.data?.detail || err.message));
    } finally {
      setStaffLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/lead-distributor/stats`,
        { headers }
      );
      setStats(response.data);
    } catch (err) {
      // Stats should not block the rest of the dashboard.
    }
  };

  useEffect(() => {
    loadStaffMembers();
    loadStats();
  }, []);

  const handleDayToggle = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };

  const handleFileUpload = async (e) => {
    const uploadFile = e.target.files?.[0];
    if (!uploadFile) return;

    setFile(uploadFile);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await axios.post(
        `${API_URL}/api/lead-distributor/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      showSuccess(
        `Uploaded ${response.data.contacts_added} contacts. ${response.data.duplicates_skipped} duplicates skipped.`
      );
      await loadStats();
    } catch (err) {
      showError(
        'Error uploading file: ' +
        (err.response?.data?.detail || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!staffName.trim()) return showError('Please enter staff name.');
    if (!staffEmail.trim()) return showError('Please enter staff email.');

    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/lead-distributor/staff`,
        {
          name: staffName.trim(),
          email: staffEmail.trim(),
        },
        { headers }
      );

      setStaffName('');
      setStaffEmail('');
      await loadStaffMembers();
      await loadStats();
      showSuccess('Staff member added.');
    } catch (err) {
      showError('Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (staff) => {
    setEditingStaffId(staff.id);
    setEditName(staff.name);
    setEditEmail(staff.email);
    setError('');
    setSuccess('');
  };

  const cancelEditing = () => {
    setEditingStaffId(null);
    setEditName('');
    setEditEmail('');
  };

  const handleUpdateStaff = async (staffId) => {
    if (!editName.trim()) return showError('Please enter staff name.');
    if (!editEmail.trim()) return showError('Please enter staff email.');

    setLoading(true);
    try {
      await axios.put(
        `${API_URL}/api/lead-distributor/staff/${staffId}`,
        {
          name: editName.trim(),
          email: editEmail.trim(),
        },
        { headers }
      );

      cancelEditing();
      await loadStaffMembers();
      showSuccess('Staff member updated.');
    } catch (err) {
      showError('Error updating staff: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (staff) => {
    const confirmed = window.confirm(
      `Delete ${staff.name} from the active staff list? Their previous distribution history will be preserved.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await axios.delete(
        `${API_URL}/api/lead-distributor/staff/${staff.id}`,
        { headers }
      );

      if (editingStaffId === staff.id) cancelEditing();
      await loadStaffMembers();
      await loadStats();
      showSuccess(`${staff.name} removed from active staff.`);
    } catch (err) {
      showError('Error deleting staff: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleConfigure = async () => {
    if (!staffMembers.length) {
      return showError('Add at least one staff member first.');
    }
    if (!selectedDays.length) {
      return showError('Select at least one day.');
    }
    if (!Number.isInteger(contactsPerDay) || contactsPerDay < 1 || contactsPerDay > 5000) {
      return showError('Contacts per person must be between 1 and 5000.');
    }

    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/lead-distributor/configure`,
        {
          contacts_per_person: contactsPerDay,
          selected_days: selectedDays,
          send_time: sendTime,
          enabled: true,
          exclusion_window: 0,
        },
        { headers }
      );

      showSuccess(
        `Configuration saved: ${contactsPerDay} contacts per staff member per day.`
      );
    } catch (err) {
      showError('Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDistributeNow = async () => {
    if (!staffMembers.length) {
      return showError('Add at least one staff member first.');
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/lead-distributor/distribute-now`,
        {},
        { headers }
      );

      const staffSummary = (response.data.staff_results || [])
        .map((item) => `${item.staff_name}: ${item.contacts_assigned}`)
        .join(' • ');

      showSuccess(
        `Distributed ${response.data.total_distributed} contacts. ${staffSummary}`
      );
      await loadStats();
    } catch (err) {
      showError('Distribution failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmails = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/lead-distributor/send-emails`,
        {},
        { headers }
      );

      showSuccess(response.data.message);
    } catch (err) {
      showError(
        'Error sending emails: ' +
        (err.response?.data?.detail || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const totalDailyCapacity = (stats?.staff_count || staffMembers.length) * contactsPerDay;

  const cardStyle = {
    marginBottom: '20px',
    padding: '20px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  };

  const buttonStyle = (background, disabled = false) => ({
    padding: '10px 16px',
    background,
    color: '#fff',
    border: 'none',
    borderRadius: '7px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    fontWeight: 600,
  });

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ marginBottom: '6px' }}>Lead Distributor</h2>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Upload the lead pool, add your team, and the system automatically distributes
          each staff member's daily quota.
        </p>
      </div>

      {success && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 14px',
          background: '#ecfdf5',
          color: '#047857',
          border: '1px solid #a7f3d0',
          borderRadius: '8px',
        }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 14px',
          background: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
          borderRadius: '8px',
        }}>
          {error}
        </div>
      )}

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>1. Upload Contacts</h3>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Supports CSV/XLSX, phone-only files, and name + phone files with or without headers.
          Large files up to 200 MB are accepted.
        </p>

        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileUpload}
          disabled={loading}
        />

        {file && (
          <p style={{ fontSize: '13px', color: '#4b5563', marginBottom: 0 }}>
            Selected: <strong>{file.name}</strong>
          </p>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>2. Staff Members</h3>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Every active staff member automatically receives their own daily quota.
          There is no Select/Unselect step.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: '10px',
          marginBottom: '18px',
        }}>
          <input
            type="text"
            placeholder="Staff name"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '7px' }}
          />
          <input
            type="email"
            placeholder="Staff email"
            value={staffEmail}
            onChange={(e) => setStaffEmail(e.target.value)}
            style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '7px' }}
          />
          <button
            onClick={handleAddStaff}
            disabled={loading}
            style={buttonStyle('#2563eb', loading)}
          >
            + Add Staff
          </button>
        </div>

        {staffLoading ? (
          <p style={{ color: '#6b7280' }}>Loading staff...</p>
        ) : staffMembers.length === 0 ? (
          <div style={{
            padding: '16px',
            background: '#f9fafb',
            borderRadius: '8px',
            color: '#6b7280',
          }}>
            No staff members added yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {staffMembers.map((staff) => (
              <div
                key={staff.id}
                style={{
                  padding: '14px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  background: '#fafafa',
                }}
              >
                {editingStaffId === staff.id ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto auto',
                    gap: '8px',
                    alignItems: 'center',
                  }}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ padding: '9px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      style={{ padding: '9px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                    <button
                      onClick={() => handleUpdateStaff(staff.id)}
                      disabled={loading}
                      style={buttonStyle('#16a34a', loading)}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      disabled={loading}
                      style={buttonStyle('#6b7280', loading)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '15px',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{staff.name}</div>
                      <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '3px' }}>
                        {staff.email}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => startEditing(staff)}
                        disabled={loading}
                        style={buttonStyle('#f59e0b', loading)}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(staff)}
                        disabled={loading}
                        style={buttonStyle('#dc2626', loading)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>3. Distribution Settings</h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '16px',
        }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '14px' }}>
            Contacts per staff member per day
            <input
              type="number"
              min="1"
              max="5000"
              value={contactsPerDay}
              onChange={(e) => setContactsPerDay(Number(e.target.value))}
              style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '7px' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '14px' }}>
            Daily distribution / email time
            <input
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '7px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>Run on</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {days.map((day) => (
              <label key={day} style={{ fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={selectedDays.includes(day)}
                  onChange={() => handleDayToggle(day)}
                />
                {' '}{day.charAt(0).toUpperCase() + day.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleConfigure}
            disabled={loading || !staffMembers.length}
            style={buttonStyle('#16a34a', loading || !staffMembers.length)}
          >
            Save Configuration
          </button>

          <button
            onClick={handleDistributeNow}
            disabled={loading || !staffMembers.length}
            style={buttonStyle('#7c3aed', loading || !staffMembers.length)}
          >
            Distribute Now
          </button>

          <button
            onClick={handleSendEmails}
            disabled={loading || !staffMembers.length}
            style={buttonStyle('#0891b2', loading || !staffMembers.length)}
          >
            Send Emails Now
          </button>
        </div>

        <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: 0, marginTop: '12px' }}>
          Example: 5 staff × 500 = 2,500 contacts/day. A contact can go to different staff,
          but the same contact will not be assigned again to the same staff member.
        </p>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>4. Distribution Overview</h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
        }}>
          <div style={{ padding: '14px', background: '#f9fafb', borderRadius: '8px' }}>
            <div style={{ color: '#6b7280', fontSize: '12px' }}>Total Contacts</div>
            <strong style={{ fontSize: '22px' }}>{stats?.total_contacts ?? '—'}</strong>
          </div>

          <div style={{ padding: '14px', background: '#f9fafb', borderRadius: '8px' }}>
            <div style={{ color: '#6b7280', fontSize: '12px' }}>Active Staff</div>
            <strong style={{ fontSize: '22px' }}>{stats?.staff_count ?? staffMembers.length}</strong>
          </div>

          <div style={{ padding: '14px', background: '#f9fafb', borderRadius: '8px' }}>
            <div style={{ color: '#6b7280', fontSize: '12px' }}>Daily Capacity</div>
            <strong style={{ fontSize: '22px' }}>{stats?.daily_capacity ?? totalDailyCapacity}</strong>
          </div>

          <div style={{ padding: '14px', background: '#f9fafb', borderRadius: '8px' }}>
            <div style={{ color: '#6b7280', fontSize: '12px' }}>Distributed Today</div>
            <strong style={{ fontSize: '22px' }}>{stats?.distributed_today ?? '—'}</strong>
          </div>
        </div>

        <button
          onClick={loadStats}
          disabled={loading}
          style={{
            ...buttonStyle('#6b7280', loading),
            marginTop: '14px',
          }}
        >
          Refresh Statistics
        </button>
      </div>
    </div>
  );
}
