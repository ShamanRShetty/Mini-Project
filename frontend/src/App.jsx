/**
 * Main App Component
 * 
 * Sets up:
 * - Authentication context (login state)
 * - React Router (page navigation)
 * - Online/offline detection
 * - Global layout
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Pages
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
// AUTHENTICATION CONTEXT
// Makes auth state available everywhere
// ========================================
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// ========================================
// PROTECTED ROUTE COMPONENT
// Redirects to login if not authenticated
// ========================================
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// ========================================
// MAIN APP COMPONENT
// ========================================
function App() {
  // Authentication state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Online/offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Load stored auth on mount
  useEffect(() => {
    const stored = getStoredAuth();
    if (stored?.token && stored?.user) {
      setToken(stored.token);
      setUser(stored.user);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);
  
  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 Back online');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('📴 Gone offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Listen for service worker messages
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_REQUIRED') {
          console.log('[App] Sync required:', event.data.message);
          // Trigger sync from IndexedDB
        }
      });
    }
  }, []);
  
  // Login function
  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    localStorage.setItem('auth', JSON.stringify({ user: userData, token: authToken }));
  };
  
  // Logout function
  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    clearAuth();
  };
  
  // Auth context value
  const authValue = {
    user,
    token,
    isAuthenticated,
    isOnline,
    login,
    logout
  };
  
  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ResilienceHub...</p>
        </div>
      </div>
    );
  }
  
  return (
    <AuthContext.Provider value={authValue}>
      <div className="min-h-screen bg-gray-50">
        {/* Offline Banner */}
        {!isOnline && <OfflineBanner />}
        
        {/* Navigation (only show when logged in) */}
        {isAuthenticated && <Navbar />}
        
        {/* Main Content */}
        <main className={isAuthenticated ? 'pt-16' : ''}>
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/login" 
              element={
                isAuthenticated 
                  ? <Navigate to="/dashboard" replace /> 
                  : <Login />
              } 
            />
            
            {/* Protected Routes */}
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
            
            {/* Default redirect */}
            <Route 
              path="/" 
              element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
            />
            
            {/* 404 */}
            <Route 
              path="*" 
              element={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
                    <p className="text-gray-600">Page not found</p>
                  </div>
                </div>
              } 
            />
          </Routes>
        </main>
      </div>
    </AuthContext.Provider>
  );
}

export default App;