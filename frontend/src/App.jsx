/**
 * Main App Component
 * 
 * Adds:
 * - Home page as default route
 * - Register page
 * 
 * Keeps:
 * - AuthContext
 * - ProtectedRoute with role logic
 * - Navbar + OfflineBanner
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Pages
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FieldWorker from './pages/FieldWorker';
import AidDistribution from './pages/AidDistribution';
import Logistics from './pages/Logistics';
import DonorPortal from './pages/DonorPortal';
import LedgerExplorer from './pages/LedgerExplorer';

// Components
import Navbar from './components/Navbar';
import OfflineBanner from './components/OfflineBanner';

// Utils
import { getStoredAuth, clearAuth } from './utils/auth';

// ========================================
// AUTH CONTEXT
// ========================================
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// ========================================
// PROTECTED ROUTE
// ========================================
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// ========================================
// MAIN APP
// ========================================
function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Load stored auth
  useEffect(() => {
    const stored = getStoredAuth();
    if (stored?.token && stored?.user) {
      setToken(stored.token);
      setUser(stored.user);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // Online/offline tracking
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    localStorage.setItem('auth', JSON.stringify({ user: userData, token: authToken }));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    clearAuth();
  };

  const authValue = {
    user,
    token,
    isAuthenticated,
    isOnline,
    login,
    logout,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading ResilienceHub...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authValue}>
      <div className="min-h-screen bg-gray-50">
        
        {!isOnline && <OfflineBanner />}
        {isAuthenticated && <Navbar />}
        
        <main className={isAuthenticated ? 'pt-16' : ''}>
          <Routes>

            {/* ========= PUBLIC PAGES ========= */}

            <Route path="/" element={<Home />} />

            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
            />

            <Route path="/register" element={<Register />} />

            {/* ========= PROTECTED PAGES ========= */}

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/field-worker"
              element={
                <ProtectedRoute allowedRoles={['field_worker', 'ngo', 'admin']}>
                  <FieldWorker />
                </ProtectedRoute>
              }
            />

            <Route
              path="/aid-distribution"
              element={
                <ProtectedRoute allowedRoles={['field_worker', 'ngo', 'admin']}>
                  <AidDistribution />
                </ProtectedRoute>
              }
            />

            <Route
              path="/logistics"
              element={
                <ProtectedRoute allowedRoles={['ngo', 'admin']}>
                  <Logistics />
                </ProtectedRoute>
              }
            />

            <Route
              path="/donor-portal"
              element={
                <ProtectedRoute allowedRoles={['donor', 'admin']}>
                  <DonorPortal />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ledger"
              element={
                <ProtectedRoute>
                  <LedgerExplorer />
                </ProtectedRoute>
              }
            />

            {/* ========= 404 ========= */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </main>
      </div>
    </AuthContext.Provider>
  );
}

export default App;
