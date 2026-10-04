import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import StaffDashboard from './StaffDashboard';
import AdminDashboard from './AdminDashboard';

function App() {
  const brokerToken = localStorage.getItem('broker_token');
  const brokerUser = JSON.parse(localStorage.getItem('broker_user') || 'null');
  const staffToken = localStorage.getItem('staff_token');
  const staffUser = JSON.parse(localStorage.getItem('staff_user') || 'null');

  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={brokerToken && brokerUser?.role === 'broker' ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/staff"
          element={staffToken && staffUser?.role === 'staff' ? <StaffDashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/"
          element={
            <Navigate
              to={
                staffToken && staffUser?.role === 'staff'
                  ? '/staff'
                  : brokerToken && brokerUser?.role === 'broker'
                    ? '/dashboard'
                    : '/login'
              }
            />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
