// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/contexts/ToastContext';
import ToastContainer from '@/components/Toast';
import Spinner from '@/components/Spinner';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import CommunityPage from './pages/Community';
import AssignmentsPage from './pages/Assignments';
import ExamsPage from './pages/Exams';
import PlacementsPage from './pages/Placements';
import CalendarPage from './pages/Calendar';
import AssistantPage from './pages/Assistant';
import UploadPage from './pages/Upload';
import BatchPage from './pages/Batch';
import ProfilePage from './pages/Profile';

/** Redirect unauthenticated users to /login */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <ToastContainer />
          <Routes>
            <Route path="/login" element={<LoginPage />} />

      {/* All authenticated routes share the sidebar layout */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"   element={<DashboardPage />} />
        <Route path="community"   element={<CommunityPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="exams"       element={<ExamsPage />} />
        <Route path="placements"  element={<PlacementsPage />} />
        <Route path="calendar"    element={<CalendarPage />} />
        <Route path="assistant"   element={<AssistantPage />} />
        <Route path="upload"      element={<UploadPage />} />
        <Route path="batch"       element={<BatchPage />} />
        <Route path="profile"     element={<ProfilePage />} />
      </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
