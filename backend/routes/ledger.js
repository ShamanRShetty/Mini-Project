/**
 * Ledger Routes
 * 
 * Defines API endpoints for blockchain-style ledger.
 * 
 * Endpoints:
 * GET    /api/ledger                   - Get all ledger entries
 * GET    /api/ledger/verify/chain      - Verify entire chain
 * GET    /api/ledger/verify/block/:num - Verify single block
 * GET    /api/ledger/search            - Search ledger
 * GET    /api/ledger/stats/overview    - Get ledger stats
 * GET    /api/ledger/types/:type       - Get by transaction type
 * POST   /api/ledger/init              - Initialize ledger (admin)
 * GET    /api/ledger/:id               - Get single entry
 */

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  getAll,
  getById,
  verifyChain,
  verifyBlock,
  search,
  getByType,
  getStats,
  initializeLedger
} = require('../controllers/ledgerController');

// Import middleware
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// ========================================
// PUBLIC ROUTES (verification can be public)
// ========================================

// Verify entire blockchain
// GET /api/ledger/verify/chain
router.get('/verify/chain', verifyChain);

// Verify single block
// GET /api/ledger/verify/block/:blockNumber
router.get('/verify/block/:blockNumber', verifyBlock);

// ========================================
// PROTECTED ROUTES
// ========================================

// All remaining routes require authentication
router.use(protect);

// Get all ledger entries
// GET /api/ledger
router.get('/', getAll);

// Search ledger
// GET /api/ledger/search
router.get('/search', search);

// Get ledger statistics
// GET /api/ledger/stats/overview
router.get('/stats/overview', getStats);

// Get entries by transaction type
// GET /api/ledger/types/:type
router.get('/types/:type', getByType);

// ========================================
// ADMIN ROUTES
// ========================================

// Initialize ledger (create genesis block)
// POST /api/ledger/init
router.post(
  '/init',
  authorize('admin'),
  initializeLedger
);

// ========================================
// MUST BE LAST (catches :id parameter)
// ========================================

// Get single ledger entry
// GET /api/ledger/:id
router.get('/:id', getById);

module.exports = router;