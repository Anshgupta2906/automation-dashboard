import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import StaffDashboard from './StaffDashboard';

function App() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={token && user?.role !== "staff" ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/staff"
          element={token && user?.role === "staff" ? <StaffDashboard /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to={token ? (user?.role === "staff" ? "/staff" : "/dashboard") : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
