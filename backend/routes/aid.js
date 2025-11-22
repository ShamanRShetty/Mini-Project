/**
 * Aid Distribution Routes
 * 
 * Defines API endpoints for aid distribution.
 * 
 * Endpoints:
 * POST   /api/aid/distribute       - Distribute aid to beneficiary
 * POST   /api/aid/verify-biometric - Verify beneficiary biometric
 * GET    /api/aid/history          - Get distribution history
 * GET    /api/aid/stats            - Get distribution statistics
 * GET    /api/aid/log/:id          - Get single aid log
 * PUT    /api/aid/log/:id/cancel   - Cancel distribution (admin)
 */

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  distribute,
  verifyBiometric,
  getHistory,
  getStats,
  getLogById,
  cancelDistribution
} = require('../controllers/aidController');

// Import middleware
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// All routes require authentication
router.use(protect);

// ========================================
// AID DISTRIBUTION
// ========================================

// Distribute aid to beneficiary
// POST /api/aid/distribute
// Allowed: field_worker, ngo, admin
router.post(
  '/distribute',
  authorize('field_worker', 'ngo', 'admin'),
  distribute
);

// Verify beneficiary biometric
// POST /api/aid/verify-biometric
router.post('/verify-biometric', verifyBiometric);

// ========================================
// HISTORY & STATISTICS
// ========================================

// Get distribution history
// GET /api/aid/history
router.get('/history', getHistory);

// Get distribution statistics
// GET /api/aid/stats
router.get('/stats', getStats);

// Get single aid log
// GET /api/aid/log/:id
router.get('/log/:id', getLogById);

// ========================================
// ADMIN ACTIONS
// ========================================

// Cancel distribution
// PUT /api/aid/log/:id/cancel
// Admin only
router.put(
  '/log/:id/cancel',
  authorize('admin'),
  cancelDistribution
);

module.exports = router;