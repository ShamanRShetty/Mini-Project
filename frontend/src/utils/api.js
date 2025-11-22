/**
 * API Utility
 * 
 * Centralized API calls using Axios.
 * Handles authentication headers, error handling, and offline detection.
 */

import axios from 'axios';
import { getStoredAuth, clearAuth } from './auth';

// API base URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create Axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// ========================================
// REQUEST INTERCEPTOR
// Adds auth token to every request
// ========================================
api.interceptors.request.use(
  (config) => {
    const auth = getStoredAuth();
    
    if (auth?.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ========================================
// RESPONSE INTERCEPTOR
// Handles errors globally
// ========================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle specific error codes
    if (error.response) {
      const { status } = error.response;
      
      // Unauthorized - token expired or invalid
      if (status === 401) {
        console.log('[API] Unauthorized - clearing auth');
        clearAuth();
        window.location.href = '/login';
      }
      
      // Forbidden
      if (status === 403) {
        console.log('[API] Forbidden - insufficient permissions');
      }
    }
    
    // Network error (offline)
    if (!error.response && error.message === 'Network Error') {
      console.log('[API] Network error - likely offline');
      error.offline = true;
    }
    
    return Promise.reject(error);
  }
);

// ========================================
// AUTH API CALLS
// ========================================

export const authAPI = {
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
  
  signup: (userData) => 
    api.post('/auth/signup', userData),
  
  getMe: () => 
    api.get('/auth/me'),
  
  updateProfile: (data) => 
    api.put('/auth/profile', data),
  
  changePassword: (currentPassword, newPassword) => 
    api.put('/auth/change-password', { currentPassword, newPassword })
};

// ========================================
// BENEFICIARY API CALLS
// ========================================

export const beneficiaryAPI = {
  getAll: (params = {}) => 
    api.get('/beneficiaries', { params }),
  
  getById: (id) => 
    api.get(`/beneficiaries/${id}`),
  
  register: (data) => 
    api.post('/beneficiaries', data),
  
  update: (id, data) => 
    api.put(`/beneficiaries/${id}`, data),
  
  verify: (id) => 
    api.put(`/beneficiaries/${id}/verify`),
  
  delete: (id) => 
    api.delete(`/beneficiaries/${id}`),
  
  getStats: () => 
    api.get('/beneficiaries/stats/overview'),
  
  getEligible: () => 
    api.get('/beneficiaries/eligible/aid'),
  
  searchNearby: (lat, lng, maxDistance = 5000) => 
    api.get(`/beneficiaries/nearby/${lat}/${lng}`, { params: { maxDistance } })
};

// ========================================
// AID DISTRIBUTION API CALLS
// ========================================

export const aidAPI = {
  distribute: (data) => 
    api.post('/aid/distribute', data),
  
  verifyBiometric: (beneficiaryId, faceImageData) => 
    api.post('/aid/verify-biometric', { beneficiaryId, faceImageData }),
  
  getHistory: (params = {}) => 
    api.get('/aid/history', { params }),
  
  getStats: (params = {}) => 
    api.get('/aid/stats', { params }),
  
  getLogById: (id) => 
    api.get(`/aid/log/${id}`),
  
  cancelDistribution: (id, reason) => 
    api.put(`/aid/log/${id}/cancel`, { reason })
};

// ========================================
// SYNC API CALLS
// ========================================

export const syncAPI = {
  upload: (records, deviceId, deviceInfo) => 
    api.post('/sync/upload', { records, deviceId, deviceInfo }),
  
  getStatus: (batchId) => 
    api.get('/sync/status', { params: { batchId } }),
  
  process: (limit = 10) => 
    api.post('/sync/process', { limit }),
  
  getPending: () => 
    api.get('/sync/pending'),
  
  retryFailed: (itemIds) => 
    api.post('/sync/retry-failed', { itemIds })
};

// ========================================
// LOGISTICS API CALLS
// ========================================

export const logisticsAPI = {
  match: (params = {}) => 
    api.get('/logistics/match', { params }),
  
  generateRoute: (beneficiaryIds, startLocation) => 
    api.post('/logistics/route', { beneficiaryIds, startLocation }),
  
  getInventory: () => 
    api.get('/logistics/inventory'),
  
  allocate: (resourceId, beneficiaryIds, quantityPerBeneficiary) => 
    api.post('/logistics/allocate', { resourceId, beneficiaryIds, quantityPerBeneficiary }),
  
  // Resource CRUD
  getResources: (params = {}) => 
    api.get('/logistics/resources', { params }),
  
  getResourceById: (id) => 
    api.get(`/logistics/resources/${id}`),
  
  addResource: (data) => 
    api.post('/logistics/resources', data),
  
  updateResource: (id, data) => 
    api.put(`/logistics/resources/${id}`, data),
  
  addStock: (id, quantity, unitValue) => 
    api.post(`/logistics/resources/${id}/add-stock`, { quantity, unitValue })
};

// ========================================
// LEDGER API CALLS
// ========================================

export const ledgerAPI = {
  getAll: (params = {}) => 
    api.get('/ledger', { params }),
  
  getById: (id) => 
    api.get(`/ledger/${id}`),
  
  verifyChain: () => 
    api.get('/ledger/verify/chain'),
  
  verifyBlock: (blockNumber) => 
    api.get(`/ledger/verify/block/${blockNumber}`),
  
  search: (query, limit = 50) => 
    api.get('/ledger/search', { params: { query, limit } }),
  
  getByType: (type, limit = 50) => 
    api.get(`/ledger/types/${type}`, { params: { limit } }),
  
  getStats: () => 
    api.get('/ledger/stats/overview'),
  
  initialize: () => 
    api.post('/ledger/init')
};

// ========================================
// DONOR API CALLS
// ========================================

export const donorAPI = {
  getStats: () => 
    api.get('/donor/stats'),
  
  trackDonation: (resourceId) => 
    api.get(`/donor/track/${resourceId}`),
  
  getImpact: (params = {}) => 
    api.get('/donor/impact', { params }),
  
  verifyTransaction: (transactionHash) => 
    api.get(`/donor/verify/${transactionHash}`),
  
  getSupplyChain: () => 
    api.get('/donor/supply-chain')
};

// Export the api instance for custom calls
export default api;