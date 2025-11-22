/**
 * Beneficiary Routes
 * 
 * Defines API endpoints for beneficiary management.
 * 
 * Endpoints:
 * POST   /api/beneficiaries              - Register new beneficiary
 * GET    /api/beneficiaries              - Get all beneficiaries
 * GET    /api/beneficiaries/stats/overview - Get statistics
 * GET    /api/beneficiaries/eligible/aid  - Get eligible for aid
 * GET    /api/beneficiaries/nearby/:lat/:lng - Find nearby
 * GET    /api/beneficiaries/:id          - Get single beneficiary
 * PUT    /api/beneficiaries/:id          - Update beneficiary
 * PUT    /api/beneficiaries/:id/verify   - Verify beneficiary
 * DELETE /api/beneficiaries/:id          - Delete (soft) beneficiary
 */

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  register,
  getAll,
  getById,
  update,
  verify,
  deleteBeneficiary,
  getStats,
  searchNearby,
  getEligibleForAid
} = require('../controllers/beneficiaryController');

// Import middleware
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// All routes require authentication
router.use(protect);

// ========================================
// STATISTICS & SPECIAL QUERIES
// (Must be defined before :id routes)
// ========================================

// Get statistics overview
// GET /api/beneficiaries/stats/overview
router.get('/stats/overview', getStats);

// Get beneficiaries eligible for aid
// GET /api/beneficiaries/eligible/aid
router.get('/eligible/aid', getEligibleForAid);

// Find beneficiaries near a location
// GET /api/beneficiaries/nearby/:lat/:lng
router.get('/nearby/:lat/:lng', searchNearby);

// ========================================
// CRUD OPERATIONS
// ========================================

// Register new beneficiary
// POST /api/beneficiaries
// Allowed: field_worker, ngo, admin
router.post(
  '/',
  authorize('field_worker', 'ngo', 'admin'),
  register
);

// Get all beneficiaries
// GET /api/beneficiaries
router.get('/', getAll);

// Get single beneficiary
// GET /api/beneficiaries/:id
router.get('/:id', getById);

// Update beneficiary
// PUT /api/beneficiaries/:id
// Allowed: field_worker, ngo, admin
router.put(
  '/:id',
  authorize('field_worker', 'ngo', 'admin'),
  update
);

// Verify beneficiary identity
// PUT /api/beneficiaries/:id/verify
// Allowed: ngo, admin only
router.put(
  '/:id/verify',
  authorize('ngo', 'admin'),
  verify
);

// Delete (soft) beneficiary
// DELETE /api/beneficiaries/:id
// Allowed: admin only
router.delete(
  '/:id',
  authorize('admin'),
  deleteBeneficiary
);

module.exports = router;