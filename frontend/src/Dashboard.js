import React, { useEffect, useState } from 'react';
import MessageShooter from './MessageShooter';
import LeadDistributor from './LeadDistributor';
import CallingSystem from './CallingSystem';
import api from './api';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('message-shooter');
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [planActionLoading, setPlanActionLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const response = await api.get('/api/auth/subscription');
      setSubscription(response.data);
    } catch (err) {
      setPlanError(err.response?.data?.detail || 'Unable to load plan status.');
    }
  };

  const handlePlanToggle = async () => {
    setPlanError('');
    const isPaused = subscription?.status === 'paused';
    const confirmed = window.confirm(
      isPaused
        ? 'Resume your plan and restore staff access?'
        : 'Pause your plan? Staff access will be disabled until you resume it.'
    );

    if (!confirmed) return;

    setPlanActionLoading(true);
    try {
      const endpoint = isPaused
        ? '/api/auth/subscription/resume'
        : '/api/auth/subscription/pause';

      const response = await api.post(endpoint);
      setSubscription((current) => ({
        ...(current || {}),
        status: response.data.status,
      }));
    } catch (err) {
      setPlanError(err.response?.data?.detail || 'Unable to update your plan.');
    } finally {
      setPlanActionLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');

    if (!deletePassword) {
      setDeleteError('Enter your password to delete the account.');
      return;
    }

    const confirmed = window.confirm(
      'Delete your account permanently? This will remove your staff, leads, campaigns, call logs, and other account data. This cannot be undone.'
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      await api.delete('/api/auth/account', {
        data: { password: deletePassword },
      });

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } catch (err) {
      setDeleteError(
        err.response?.data?.detail || 'Unable to delete the account.'
      );
    } finally {
      setDeleting(false);
    }
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
        <button
          onClick={() => setActiveTab('calling')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'calling' ? '#007bff' : '#ddd',
            color: activeTab === 'calling' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Auto Calling
        </button>
      </div>

      <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        {activeTab === 'message-shooter' && <MessageShooter />}
        {activeTab === 'lead-distributor' && <LeadDistributor />}
        {activeTab === 'calling' && <CallingSystem />}
      </div>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        background: '#f9fafb',
      }}>
        <h3 style={{ marginTop: 0 }}>Plan & Subscription</h3>
        <p style={{ margin: '6px 0', color: '#4b5563' }}>
          Plan: <strong>{subscription?.plan === 'all_in_one' ? 'All-in-One' : subscription?.plan || 'Loading...'}</strong>
        </p>
        <p style={{ margin: '6px 0 14px', color: '#4b5563' }}>
          Status:{' '}
          <strong style={{ color: subscription?.status === 'paused' ? '#b45309' : '#15803d' }}>
            {subscription?.status === 'paused' ? 'Paused' : subscription?.status === 'active' ? 'Active' : 'Loading...'}
          </strong>
        </p>

        {planError && (
          <div style={{
            marginBottom: '10px',
            padding: '10px',
            background: '#fef2f2',
            color: '#b91c1c',
            borderRadius: '7px',
          }}>
            {planError}
          </div>
        )}

        {subscription && (
          <button
            onClick={handlePlanToggle}
            disabled={planActionLoading}
            style={{
              padding: '10px 16px',
              backgroundColor: subscription.status === 'paused' ? '#16a34a' : '#d97706',
              color: '#fff',
              border: 'none',
              borderRadius: '7px',
              cursor: planActionLoading ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
          >
            {planActionLoading
              ? 'Updating...'
              : subscription.status === 'paused'
                ? 'Resume Plan'
                : 'Pause Plan'}
          </button>
        )}
      </div>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        background: '#fff7f7',
      }}>
        <h3 style={{ marginTop: 0, color: '#b91c1c' }}>Danger Zone</h3>
        <p style={{ color: '#6b7280', marginBottom: '14px' }}>
          Permanently delete this broker account and all of its associated data.
        </p>

        {!showDeleteAccount ? (
          <button
            onClick={() => {
              setShowDeleteAccount(true);
              setDeleteError('');
            }}
            style={{
              padding: '10px 16px',
              backgroundColor: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Delete Account
          </button>
        ) : (
          <div style={{ maxWidth: '420px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              Enter your password to continue
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                setDeleteError('');
              }}
              placeholder="Current password"
              autoComplete="current-password"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '7px',
                marginBottom: '10px',
              }}
            />

            {deleteError && (
              <div style={{
                marginBottom: '10px',
                padding: '10px',
                background: '#fef2f2',
                color: '#b91c1c',
                borderRadius: '7px',
              }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '7px',
                  cursor: deleting ? 'wait' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {deleting ? 'Deleting...' : 'Permanently Delete Account'}
              </button>

              <button
                onClick={() => {
                  setShowDeleteAccount(false);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                disabled={deleting}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '7px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}