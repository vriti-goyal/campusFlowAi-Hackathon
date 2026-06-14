// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/contexts/ToastContext';
import ToastContainer from '@/components/Toast';
import Spinner from '@/components/Spinner';

// Layout
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import LoginPage from './pages/Login';
import ProfileSetupPage from './pages/ProfileSetup';
import DashboardPage from './pages/Dashboard';
import CommunityPage from './pages/Community';
import AssignmentsPage from './pages/Assignments';
import ExamsPage from './pages/Exams';
import PlacementsPage from './pages/Placements';
import CalendarPage from './pages/Calendar';
import TimetablePage from './pages/Timetable';
import AssistantPage from './pages/Assistant';
import UploadPage from './pages/Upload';
import BatchPage from './pages/Batch';
import ProfilePage from './pages/Profile';
import PlacementNoticesPage from './pages/PlacementNotices';

/** Redirect unauthenticated users to /login.
 *  Redirect users with incomplete profiles to /setup. */
function PrivateRoute({ children }) {
  const { user, dbUser, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  // If dbUser is loaded and profile is not complete, redirect to setup
  // Use !dbUser?.profileComplete to handle both false and undefined, but skip if dbUser hasn't loaded yet
  if (dbUser !== null && dbUser.profileComplete === false) return <Navigate to="/setup" replace />;
  return children;
}

/** Prevent already-complete users from re-visiting /setup */
function SetupRoute() {
  const { user, dbUser, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (dbUser?.profileComplete) return <Navigate to="/dashboard" replace />;
  return <ProfileSetupPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <ToastContainer />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupRoute />} />

            {/* All authenticated routes share the sidebar layout */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <DashboardLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"          element={<DashboardPage />} />
              <Route path="community"          element={<CommunityPage />} />
              <Route path="assignments"        element={<AssignmentsPage />} />
              <Route path="exams"              element={<ExamsPage />} />
              <Route path="placements"         element={<PlacementsPage />} />
              <Route path="placement-notices"  element={<PlacementNoticesPage />} />
              <Route path="calendar"           element={<CalendarPage />} />
              <Route path="timetable"          element={<TimetablePage />} />
              <Route path="assistant"          element={<AssistantPage />} />
              <Route path="upload"             element={<UploadPage />} />
              <Route path="batch"              element={<BatchPage />} />
              <Route path="profile"            element={<ProfilePage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
