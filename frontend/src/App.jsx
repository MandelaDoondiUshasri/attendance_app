import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppStateProvider } from './context/AppStateContext';
import GlobalStateOverlay from './components/common/GlobalStateOverlay';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ProfilePage from './pages/profile/ProfilePage';
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
import ShiftTrackerPage from './pages/tasks/ShiftTrackerPage';
import CompanyCalendar from './pages/calendar/CompanyCalendar';
import CeoMap from './pages/ceo/CeoMap';

import PermissionDenied from './components/common/states/PermissionDenied';
import ErrorBoundary from './components/common/ErrorBoundary';

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
    return <PermissionDenied />;
  }

  return children;
};

// Root Role-Based Landing Redirector
const DefaultRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'CEO':
    case 'SYSTEM_ADMIN': return <Navigate to="/ceo/dashboard" replace />;
    case 'HR': return <Navigate to="/hr/dashboard" replace />;
    case 'EMPLOYEE': default: return <Navigate to="/employee/dashboard" replace />;
  }
};

export function App() {
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <AuthProvider>
          <BrowserRouter>
            <GlobalStateOverlay />
            <Routes>
              <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
              <Route path="/forgot-password" element={<ErrorBoundary><ForgotPasswordPage /></ErrorBoundary>} />
              <Route path="/reset-password" element={<ErrorBoundary><ResetPasswordPage /></ErrorBoundary>} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <MainLayout />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              >
                <Route index element={<DefaultRedirect />} />
                <Route path="ceo/dashboard" element={<ProtectedRoute allowedRoles={['CEO', 'SYSTEM_ADMIN']}><ErrorBoundary><CEODashboard /></ErrorBoundary></ProtectedRoute>} />
                <Route path="ceo/livemap" element={<ProtectedRoute allowedRoles={['CEO', 'SYSTEM_ADMIN']}><ErrorBoundary><CeoMap /></ErrorBoundary></ProtectedRoute>} />
                <Route path="hr/dashboard" element={<ProtectedRoute allowedRoles={['CEO', 'SYSTEM_ADMIN', 'HR']}><ErrorBoundary><HRDashboard /></ErrorBoundary></ProtectedRoute>} />
                <Route path="employee/dashboard" element={<ProtectedRoute><ErrorBoundary><EmployeeDashboard /></ErrorBoundary></ProtectedRoute>} />

                <Route path="employees" element={<ProtectedRoute allowedRoles={['CEO', 'SYSTEM_ADMIN', 'HR']}><ErrorBoundary><EmployeesPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="attendance" element={<ProtectedRoute><ErrorBoundary><AttendancePage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="calendar" element={<ProtectedRoute><ErrorBoundary><CompanyCalendar /></ErrorBoundary></ProtectedRoute>} />
                <Route path="tasks" element={<ProtectedRoute><ErrorBoundary><ShiftTrackerPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="leaves" element={<ProtectedRoute><ErrorBoundary><LeavePage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="wfh" element={<ProtectedRoute><ErrorBoundary><WFHPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="salaries" element={<ProtectedRoute allowedRoles={['CEO', 'SYSTEM_ADMIN']}><ErrorBoundary><SalaryManagementPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute allowedRoles={['CEO', 'SYSTEM_ADMIN', 'HR']}><ErrorBoundary><ReportsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="audit" element={<ProtectedRoute allowedRoles={['CEO', 'SYSTEM_ADMIN']}><ErrorBoundary><AuditLogPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="settings" element={<ProtectedRoute allowedRoles={['CEO', 'SYSTEM_ADMIN']}><ErrorBoundary><SettingsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="profile" element={<ProtectedRoute><ErrorBoundary><ProfilePage /></ErrorBoundary></ProtectedRoute>} />
              </Route>

              <Route path="*" element={<DefaultRedirect />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AppStateProvider>
    </ErrorBoundary>
  );
}

export default App;
