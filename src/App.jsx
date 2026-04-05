import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import OAuth2Redirect from './pages/OAuth2Redirect';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MovieDetail from './pages/MovieDetail';
import Booking from './pages/Booking';
import Reservations from './pages/Reservations';
import { getUserInfoFromToken } from './utils/jwt';
import './styles/global.css';

// Protected Route Component
function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, loading } = useAuth();

  // Check admin directly from token (synchronous, no state needed)
  const token = localStorage.getItem('token');
  const userInfo = token ? getUserInfoFromToken(token) : null;
  const isAdmin = userInfo?.isAdmin || false;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/movies" replace />;
  }

  return children;
}

// Public Route Component (redirect if already logged in)
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Check admin directly from token (synchronous, no state needed)
  const token = localStorage.getItem('token');
  const userInfo = token ? getUserInfoFromToken(token) : null;
  const isAdmin = userInfo?.isAdmin || false;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    // Redirect based on role
    return <Navigate to={isAdmin ? '/admin' : '/movies'} replace />;
  }

  return children;
}

// Default Redirect with role check
function DefaultRedirect() {
  const { isAuthenticated, loading, loginWithToken } = useAuth();
  const location = useLocation();

  // Check admin directly from token (synchronous, no state needed)
  const token = localStorage.getItem('token');
  const userInfo = token ? getUserInfoFromToken(token) : null;
  const isAdmin = userInfo?.isAdmin || false;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Handle OAuth2 token from URL query parameter
  const urlParams = new URLSearchParams(location.search);
  const oauthToken = urlParams.get('token');
  if (oauthToken) {
    const result = loginWithToken(oauthToken);
    if (result.success) {
      return <Navigate to={result.isAdmin ? '/admin' : '/movies'} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (isAuthenticated && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/movies" replace />;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* OAuth2 Callbacks */}
        <Route path="/token=:token" element={<OAuth2Redirect />} />
        <Route path="/oauth2/redirect" element={<OAuth2Redirect />} />

        <Route path="/movies" element={<UserDashboard />} />

        {/* Protected User Routes */}
        <Route path="/movies/:id" element={<MovieDetail />} />
        <Route
          path="/booking/:showtimeId"
          element={
            <ProtectedRoute>
              <Booking />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reservations"
          element={
            <ProtectedRoute>
              <Reservations />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Default Redirect */}
        <Route path="/" element={<DefaultRedirect />} />
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#1e1e3f',
          color: '#fff',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        },
      }} />
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
