import React, { useState } from 'react';
import axios from 'axios';

export default function MessageShooter() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [sendTime, setSendTime] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
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
      
      await axios.post('http://localhost:8000/api/message-shooter/upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      setSuccess('Contacts uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert('Error uploading file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:8000/api/message-shooter/schedule', {
        message,
        send_time: sendTime,
        enabled: true,
        selected_days: selectedDays
      }, { headers });
      
      setSuccess('Message scheduled successfully!');
      setMessage('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert('Error scheduling message: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>📱 Message Shooter</h2>

      {/* UPLOAD CONTACTS SECTION */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Step 1: Upload Contacts</h3>
        <p style={{ fontSize: '12px', color: '#666' }}>Upload CSV file with phone numbers</p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={loading}
          style={{ marginBottom: '10px' }}
        />
        {success && <p style={{ color: 'green' }}>{success}</p>}
      </div>

      {/* MESSAGE SECTION */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Step 2: Compose Message</h3>
        <div style={{ marginBottom: '10px' }}>
          <label>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your message here..."
            style={{ width: '100%', height: '100px', padding: '10px', marginTop: '5px' }}
          />
        </div>
      </div>

      {/* SCHEDULE SECTION */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Step 3: Schedule</h3>
        
        <div style={{ marginBottom: '10px' }}>
          <label>Send Time:</label>
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
          onClick={handleSchedule}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Scheduling...' : 'Schedule Message'}
        </button>
      </div>
    </div>
  );
}