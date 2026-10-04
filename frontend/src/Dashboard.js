import React, { useEffect, useState } from 'react';
import MessageShooter from './MessageShooter';
import LeadDistributor from './LeadDistributor';
import CallingSystem from './CallingSystem';
import api from './api';

const PLAN_LABELS = {
  none: 'No plan assigned',
  message_shooter: 'Message Shooter',
  lead_distributor: 'Lead Distributor',
  all_in_one: 'All-in-One',
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [planError, setPlanError] = useState('');
  const user = JSON.parse(localStorage.getItem('broker_user') || '{}');

  const loadSubscription = async () => {
    try {
      const response = await api.get('/api/auth/subscription');
      setSubscription(response.data);
    } catch (err) {
      setPlanError(err.response?.data?.detail || 'Unable to load plan status.');
    }
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  const isActive = subscription?.status === 'active' && (
    !subscription?.expires_at || new Date(subscription.expires_at) > new Date()
  );

  const canMessage = isActive && ['message_shooter', 'all_in_one'].includes(subscription?.plan);
  const canLead = isActive && ['lead_distributor', 'all_in_one'].includes(subscription?.plan);
  const canCalling = isActive && subscription?.plan === 'all_in_one';

  useEffect(() => {
    if (activeTab === 'message-shooter' && !canMessage) setActiveTab(null);
    if (activeTab === 'lead-distributor' && !canLead) setActiveTab(null);
    if (activeTab === 'calling' && !canCalling) setActiveTab(null);
  }, [activeTab, canMessage, canLead, canCalling]);

  const handleLogout = () => {
    localStorage.removeItem('broker_token');
    localStorage.removeItem('broker_user');
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

      localStorage.removeItem('broker_token');
      localStorage.removeItem('broker_user');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Unable to delete the account.');
    } finally {
      setDeleting(false);
    }
  };

  const tabs = [
    { id: 'message-shooter', label: 'Message Shooter', enabled: canMessage },
    { id: 'lead-distributor', label: 'Lead Distributor', enabled: canLead },
    { id: 'calling', label: 'Auto Calling', enabled: canCalling },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: 16 }}>
        <h1 style={{ margin: 0 }}>🤖 Automation Dashboard</h1>
        <div>
          <span style={{ marginRight: '20px' }}>Welcome, {user.email}</span>
          <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </div>

      {planError && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>
          {planError}
        </div>
      )}

      <div style={{ marginBottom: 16, padding: 16, border: '1px solid #d1d5db', borderRadius: 10, background: '#f9fafb' }}>
        <strong>{PLAN_LABELS[subscription?.plan] || 'Loading plan...'}</strong>
        <span style={{ marginLeft: 12, color: '#667085' }}>
          Status: {subscription?.status || 'Loading...'}
        </span>
        {subscription?.expires_at && (
          <span style={{ marginLeft: 12, color: '#667085' }}>
            Expires: {new Date(subscription.expires_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {subscription && !isActive && (
        <div style={{ marginBottom: 16, padding: 14, background: '#fff7ed', color: '#9a3412', borderRadius: 8 }}>
          Your account does not currently have an active subscription. Contact the administrator to activate or renew your plan.
        </div>
      )}

      {subscription && isActive && !canMessage && !canLead && !canCalling && (
        <div style={{ marginBottom: 16, padding: 14, background: '#f9fafb', color: '#475467', borderRadius: 8 }}>
          No features are currently assigned to this account.
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.enabled && setActiveTab(tab.id)}
            disabled={!tab.enabled}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === tab.id ? '#007bff' : tab.enabled ? '#ddd' : '#f2f4f7',
              color: activeTab === tab.id ? 'white' : tab.enabled ? 'black' : '#98a2b3',
              border: 'none',
              borderRadius: '4px',
              cursor: tab.enabled ? 'pointer' : 'not-allowed',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', minHeight: 180 }}>
        {activeTab === 'message-shooter' && canMessage && <MessageShooter />}
        {activeTab === 'lead-distributor' && canLead && <LeadDistributor />}
        {activeTab === 'calling' && canCalling && <CallingSystem />}
        {!activeTab && (
          <div style={{ color: '#667085', padding: '20px 0' }}>
            {isActive
              ? 'Select an enabled feature above.'
              : 'Your feature access is currently inactive.'}
          </div>
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
              <div style={{ marginBottom: '10px', padding: '10px', background: '#fef2f2', color: '#b91c1c', borderRadius: '7px' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{ padding: '10px 16px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '7px', cursor: deleting ? 'wait' : 'pointer', fontWeight: 600 }}
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
                style={{ padding: '10px 16px', backgroundColor: '#6b7280', color: '#fff', border: 'none', borderRadius: '7px', cursor: deleting ? 'not-allowed' : 'pointer' }}
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
