import React, { useState } from 'react';
import axios from 'axios';

export default function MessageShooter() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [sendTime, setSendTime] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const handleDayToggle = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSchedule = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:8000/api/message-shooter/schedule', {
        message,
        send_time: sendTime,
        enabled: true,
        selected_days: selectedDays
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Message scheduled successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert('Error scheduling message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Message Shooter</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label>Message:</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message here..."
          style={{ width: '100%', height: '100px', padding: '10px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>Send Time:</label>
        <input
          type="time"
          value={sendTime}
          onChange={(e) => setSendTime(e.target.value)}
          style={{ padding: '10px', marginLeft: '10px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
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

      {success && <p style={{ color: 'green' }}>{success}</p>}

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
  );
}
