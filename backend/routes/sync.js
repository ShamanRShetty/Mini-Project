/**
 * Sync Routes
 * 
 * Defines API endpoints for offline data synchronization.
 * 
 * Endpoints:
 * POST   /api/sync/upload        - Upload offline data for syncing
 * GET    /api/sync/status        - Get sync status for user
 * POST   /api/sync/process       - Manually trigger processing (admin)
 * GET    /api/sync/pending       - Get pending items (admin)
 * POST   /api/sync/retry-failed  - Retry failed items (admin)
 */

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  upload,
  getStatus,
  processQueue,
  getPending,
  retryFailed
} = require('../controllers/syncController');

// Import middleware
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// All routes require authentication
router.use(protect);

// ========================================
// USER SYNC OPERATIONS
// ========================================

// Upload offline data for syncing
// POST /api/sync/upload
// Any authenticated user can sync their data
router.post('/upload', upload);

// Get sync status for current user
// GET /api/sync/status
router.get('/status', getStatus);

// ========================================
// ADMIN OPERATIONS
// ========================================

// Manually trigger sync queue processing
// POST /api/sync/process
// Admin only
router.post(
  '/process',
  authorize('admin'),
  processQueue
);

// Get all pending sync items
// GET /api/sync/pending
// Admin only
router.get(
  '/pending',
  authorize('admin'),
  getPending
);

// Retry failed sync items
// POST /api/sync/retry-failed
// Admin only
router.post(
  '/retry-failed',
  authorize('admin'),
  retryFailed
);

module.exports = router;