/**
 * Authentication Utility
 * 
 * Helper functions for managing authentication state.
 * Stores auth data in localStorage.
 */

const AUTH_KEY = 'auth';

/**
 * Get stored authentication data
 * @returns {object|null} { user, token } or null
 */
export const getStoredAuth = () => {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error('Error reading auth from localStorage:', error);
    return null;
  }
};

/**
 * Store authentication data
 * @param {object} user - User object
 * @param {string} token - JWT token
 */
export const storeAuth = (user, token) => {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ user, token }));
  } catch (error) {
    console.error('Error storing auth in localStorage:', error);
  }
};

/**
 * Clear authentication data (logout)
 */
export const clearAuth = () => {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch (error) {
    console.error('Error clearing auth from localStorage:', error);
  }
};

/**
 * Get stored JWT token
 * @returns {string|null} Token or null
 */
export const getToken = () => {
  const auth = getStoredAuth();
  return auth?.token || null;
};

/**
 * Get stored user
 * @returns {object|null} User object or null
 */
export const getUser = () => {
  const auth = getStoredAuth();
  return auth?.user || null;
};

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  const auth = getStoredAuth();
  return !!(auth?.token && auth?.user);
};

/**
 * Check if user has a specific role
 * @param {string|string[]} roles - Role(s) to check
 * @returns {boolean}
 */
export const hasRole = (roles) => {
  const user = getUser();
  if (!user) return false;
  
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(user.role);
};

/**
 * Get user's display name
 * @returns {string}
 */
export const getDisplayName = () => {
  const user = getUser();
  return user?.name || 'User';
};

/**
 * Get role display name (formatted)
 * @param {string} role - Role key
 * @returns {string} Formatted role name
 */
export const getRoleDisplayName = (role) => {
  const roleNames = {
    field_worker: 'Field Worker',
    ngo: 'NGO Manager',
    admin: 'Administrator',
    donor: 'Donor'
  };
  return roleNames[role] || role;
};

/**
 * Check if token is expired
 * Note: This is a simple check - server validates actual expiry
 * @returns {boolean}
 */
export const isTokenExpired = () => {
  const token = getToken();
  if (!token) return true;
  
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    // Decode payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiry
    if (payload.exp) {
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= expiryTime;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true;
  }
};