import React, { useState } from 'react';
import axios from 'axios';

export default function CallingSystem() {
  const [staffId, setStaffId] = useState(1);
  const [bufferSeconds, setBufferSeconds] = useState(10);
  const [isCalling, setIsCalling] = useState(false);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('token');

  const headers = { Authorization: `Bearer ${token}` };

  const startCalling = async () => {
    setLoading(true);
    try {
      await axios.post('http://localhost:8000/api/calling/start', {
        staff_id: staffId,
        buffer_seconds: bufferSeconds
      }, { headers });
      setIsCalling(true);
      alert('Calling started!');
    } catch (err) {
      alert('Error starting calls: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopCalling = async () => {
    setLoading(true);
    try {
      await axios.post('http://localhost:8000/api/calling/stop', {}, {
        headers,
        params: { staff_id: staffId }
      });
      setIsCalling(false);
      alert('Calling stopped!');
    } catch (err) {
      alert('Error stopping calls: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStats = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/calling/stats', {
        headers,
        params: { staff_id: staffId }
      });
      setStats(response.data);
    } catch (err) {
      console.log('Error fetching stats (normal if no calls yet)');
    }
  };

  const getLogs = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/calling/logs', {
        headers,
        params: { staff_id: staffId }
      });
      setLogs(response.data);
    } catch (err) {
      console.log('Error fetching logs (normal if no calls yet)');
    }
  };

  const handleGetStats = async () => {
    await getStats();
    await getLogs();
  };

  return (
    <div>
      <h2>Auto-Calling System</h2>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Configuration</h3>
        
        <div style={{ marginBottom: '10px' }}>
          <label>Staff ID:</label>
          <input
            type="number"
            value={staffId}
            onChange={(e) => setStaffId(parseInt(e.target.value))}
            style={{ padding: '10px', marginLeft: '10px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Buffer Time (seconds):</label>
          <input
            type="number"
            value={bufferSeconds}
            onChange={(e) => setBufferSeconds(parseInt(e.target.value))}
            style={{ padding: '10px', marginLeft: '10px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={startCalling}
            disabled={loading || isCalling}
            style={{
              padding: '10px 20px',
              backgroundColor: isCalling ? '#999' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || isCalling ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : isCalling ? 'Calling Active' : 'Start Calling'}
          </button>

          <button
            onClick={stopCalling}
            disabled={loading || !isCalling}
            style={{
              padding: '10px 20px',
              backgroundColor: !isCalling ? '#999' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || !isCalling ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Stop Calling'}
          </button>

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
            Refresh Stats
          </button>
        </div>
      </div>

      {stats && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
          <h3>Today's Statistics</h3>
          <p>📞 Total Calls: <strong>{stats.total_calls_today}</strong></p>
          <p>✅ Answered: <strong>{stats.answered_calls}</strong></p>
          <p>❌ Missed: <strong>{stats.missed_calls}</strong></p>
          <p>⚠️ Failed: <strong>{stats.failed_calls}</strong></p>
          <p>🔄 Status: <strong>{stats.is_calling ? '🟢 CALLING' : '🔴 STOPPED'}</strong></p>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h3>Recent Call Logs ({logs.length})</h3>
        {logs.length === 0 ? (
          <p>No calls yet</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Phone</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Duration</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{log.phone}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{log.status}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{log.duration}s</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{new Date(log.called_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}