import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import CEODashboard from './pages/ceo/CEODashboard';
import HRDashboard from './pages/hr/HRDashboard';
import OperatorDashboard from './pages/operator/OperatorDashboard';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeesPage from './pages/employees/EmployeesPage';
import AttendancePage from './pages/attendance/AttendancePage';
import LeavePage from './pages/leaves/LeavePage';
import WFHPage from './pages/wfh/WFHPage';
import SalaryManagementPage from './pages/salaries/SalaryManagementPage';
import ReportsPage from './pages/reports/ReportsPage';
import AuditLogPage from './pages/audit/AuditLogPage';
import SettingsPage from './pages/settings/SettingsPage';

// Protected Route Guard Wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect unauthorized attempts to role landing dashboard
    switch (user.role) {
      case 'CEO': return <Navigate to="/ceo/dashboard" replace />;
      case 'HR': return <Navigate to="/hr/dashboard" replace />;
      case 'EMPLOYEE': default: return <Navigate to="/employee/dashboard" replace />;
    }
  }

  return children;
};

// Root Role-Based Landing Redirector
const DefaultRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'CEO': return <Navigate to="/ceo/dashboard" replace />;
    case 'HR': return <Navigate to="/hr/dashboard" replace />;
    case 'EMPLOYEE': default: return <Navigate to="/employee/dashboard" replace />;
  }
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DefaultRedirect />} />
            <Route path="ceo/dashboard" element={<ProtectedRoute allowedRoles={['CEO']}><CEODashboard /></ProtectedRoute>} />
            <Route path="hr/dashboard" element={<ProtectedRoute allowedRoles={['CEO', 'HR']}><HRDashboard /></ProtectedRoute>} />
            <Route path="employee/dashboard" element={<ProtectedRoute><EmployeeDashboard /></ProtectedRoute>} />

            <Route path="employees" element={<ProtectedRoute allowedRoles={['CEO', 'HR']}><EmployeesPage /></ProtectedRoute>} />
            <Route path="attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
            <Route path="leaves" element={<ProtectedRoute><LeavePage /></ProtectedRoute>} />
            <Route path="wfh" element={<ProtectedRoute><WFHPage /></ProtectedRoute>} />
            <Route path="salaries" element={<ProtectedRoute allowedRoles={['CEO']}><SalaryManagementPage /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute allowedRoles={['CEO', 'HR']}><ReportsPage /></ProtectedRoute>} />
            <Route path="audit" element={<ProtectedRoute allowedRoles={['CEO']}><AuditLogPage /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute allowedRoles={['CEO']}><SettingsPage /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
