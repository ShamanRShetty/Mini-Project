/**
 * Logistics Routes
 * 
 * Defines API endpoints for logistics and supply management.
 * 
 * Endpoints:
 * POST   /api/logistics/match      - Match needs with supplies
 * POST   /api/logistics/route      - Generate delivery route
 * GET    /api/logistics/inventory  - Get inventory summary
 * POST   /api/logistics/allocate   - Allocate resources
 * 
 * Resource management:
 * POST   /api/logistics/resources     - Add new resource
 * GET    /api/logistics/resources     - Get all resources
 * GET    /api/logistics/resources/:id - Get single resource
 * PUT    /api/logistics/resources/:id - Update resource
 */

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  matchSupplies,
  generateRoute,
  getInventory,
  allocateResources
} = require('../controllers/logisticsController');

// Import Resource model for CRUD operations
const Resource = require('../models/Resource');

// Import middleware
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// All routes require authentication
router.use(protect);

// ========================================
// LOGISTICS OPERATIONS
// ========================================

// Match beneficiary needs with available supplies
// POST /api/logistics/match
router.post('/match', matchSupplies);

// Also allow GET for convenience
router.get('/match', matchSupplies);

// Generate optimized delivery route
// POST /api/logistics/route
router.post('/route', generateRoute);

// Get inventory summary
// GET /api/logistics/inventory
router.get('/inventory', getInventory);

// Allocate resources to beneficiaries
// POST /api/logistics/allocate
// Allowed: ngo, admin
router.post(
  '/allocate',
  authorize('ngo', 'admin'),
  allocateResources
);

// ========================================
// RESOURCE CRUD OPERATIONS
// ========================================

// Add new resource
// POST /api/logistics/resources
router.post(
  '/resources',
  authorize('ngo', 'admin', 'donor'),
  async (req, res) => {
    try {
      const resourceData = {
        ...req.body,
        addedBy: req.user.id
      };

      // Handle location
      if (req.body.latitude && req.body.longitude) {
        resourceData.location = {
          type: 'Point',
          coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
        };
      }

      const resource = await Resource.create(resourceData);

      res.status(201).json({
        success: true,
        message: 'Resource added successfully',
        resource
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error adding resource',
        error: error.message
      });
    }
  }
);

// Get all resources
// GET /api/logistics/resources
router.get('/resources', async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const resources = await Resource.find(query)
      .populate('donor', 'name organization')
      .populate('addedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Resource.countDocuments(query);

    res.json({
      success: true,
      count: resources.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      resources
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching resources',
      error: error.message
    });
  }
});

// Get single resource
// GET /api/logistics/resources/:id
router.get('/resources/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate('donor', 'name email organization')
      .populate('addedBy', 'name email');

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }

    res.json({
      success: true,
      resource
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching resource',
      error: error.message
    });
  }
});

// Update resource
// PUT /api/logistics/resources/:id
router.put(
  '/resources/:id',
  authorize('ngo', 'admin'),
  async (req, res) => {
    try {
      const updates = {
        ...req.body,
        lastUpdatedBy: req.user.id
      };

      // Handle location update
      if (req.body.latitude && req.body.longitude) {
        updates.location = {
          type: 'Point',
          coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
        };
      }

      const resource = await Resource.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      );

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      res.json({
        success: true,
        message: 'Resource updated successfully',
        resource
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating resource',
        error: error.message
      });
    }
  }
);

// Add stock to existing resource
// POST /api/logistics/resources/:id/add-stock
router.post(
  '/resources/:id/add-stock',
  authorize('ngo', 'admin', 'donor'),
  async (req, res) => {
    try {
      const { quantity, unitValue } = req.body;

      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid quantity is required'
        });
      }

      const resource = await Resource.findById(req.params.id);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      await resource.addStock(quantity, unitValue);

      res.json({
        success: true,
        message: `Added ${quantity} ${resource.unit} to ${resource.name}`,
        resource
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error adding stock',
        error: error.message
      });
    }
  }
);

module.exports = router;