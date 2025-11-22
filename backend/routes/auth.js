/**
 * Authentication Routes
 * 
 * Defines API endpoints for user authentication.
 * 
 * Endpoints:
 * POST   /api/auth/signup         - Register new user
 * POST   /api/auth/login          - Login and get token
 * GET    /api/auth/me             - Get current user profile
 * PUT    /api/auth/profile        - Update profile
 * PUT    /api/auth/change-password - Change password
 * GET    /api/auth/users          - Get all users (admin)
 * PUT    /api/auth/users/:id/toggle-active - Toggle user status (admin)
 */

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  signup,
  login,
  getMe,
  updateProfile,
  changePassword,
  getAllUsers,
  toggleUserActive
} = require('../controllers/authController');

// Import middleware
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// ========================================
// PUBLIC ROUTES (no authentication needed)
// ========================================

// Register new user
// POST /api/auth/signup
router.post('/signup', signup);

// Login
// POST /api/auth/login
router.post('/login', login);

// ========================================
// PROTECTED ROUTES (authentication required)
// ========================================

// Get current user profile
// GET /api/auth/me
router.get('/me', protect, getMe);

// Update profile
// PUT /api/auth/profile
router.put('/profile', protect, updateProfile);

// Change password
// PUT /api/auth/change-password
router.put('/change-password', protect, changePassword);

// ========================================
// ADMIN ONLY ROUTES
// ========================================

// Get all users
// GET /api/auth/users
router.get('/users', protect, authorize('admin'), getAllUsers);

// Toggle user active status
// PUT /api/auth/users/:id/toggle-active
router.put('/users/:id/toggle-active', protect, authorize('admin'), toggleUserActive);

module.exports = router;