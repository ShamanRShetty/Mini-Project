/**
 * Donor Routes
 * 
 * Defines API endpoints for donor transparency portal.
 * 
 * Endpoints:
 * GET    /api/donor/stats               - Get donor statistics
 * GET    /api/donor/track/:resourceId   - Track specific donation
 * GET    /api/donor/impact              - Get impact report
 * GET    /api/donor/verify/:hash        - Verify transaction (public)
 * GET    /api/donor/supply-chain        - View supply chain
 */

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  getDonorStats,
  trackDonation,
  getImpact,
  verifyTransaction,
  getSupplyChain
} = require('../controllers/donorController');

// Import middleware
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// ========================================
// PUBLIC ROUTES
// ========================================

// Verify transaction (anyone can verify for transparency)
// GET /api/donor/verify/:transactionHash
router.get('/verify/:transactionHash', verifyTransaction);

// ========================================
// PROTECTED ROUTES (Donor only)
// ========================================

// Apply authentication to remaining routes
router.use(protect);

// Get donor statistics
// GET /api/donor/stats
// Allowed: donor, admin
router.get(
  '/stats',
  authorize('donor', 'admin'),
  getDonorStats
);

// Track specific donation
// GET /api/donor/track/:resourceId
// Allowed: donor, admin
router.get(
  '/track/:resourceId',
  authorize('donor', 'admin'),
  trackDonation
);

// Get impact report
// GET /api/donor/impact
// Allowed: donor, admin
router.get(
  '/impact',
  authorize('donor', 'admin'),
  getImpact
);

// Get supply chain view
// GET /api/donor/supply-chain
// Allowed: donor, admin
router.get(
  '/supply-chain',
  authorize('donor', 'admin'),
  getSupplyChain
);

module.exports = router;