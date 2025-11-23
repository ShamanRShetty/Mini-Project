/**
 * Priority Management Routes
 * 
 * API endpoints for vulnerability scoring and priority management
 */

const express = require('express');
const router = express.Router();
const VulnerabilityService = require('../services/vulnerabilityService');
const Beneficiary = require('../models/Beneficiary');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/priority/dashboard
 * @desc    Get priority dashboard data
 * @access  Private
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Get priority distribution
    const distribution = await VulnerabilityService.getPriorityDistribution();
    
    // Get urgent cases
    const urgent = await VulnerabilityService.getUrgentCases();
    
    // Get recent escalations (beneficiaries updated in last 24h with HIGH/CRITICAL)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEscalations = await Beneficiary.find({
      status: 'active',
      priorityLevel: { $in: ['CRITICAL', 'HIGH'] },
      lastScoreUpdate: { $gte: yesterday }
    })
    .sort({ lastScoreUpdate: -1 })
    .limit(20)
    .select('name vulnerabilityScore priorityLevel priorityColor estimatedDelivery lastScoreUpdate location');
    
    // Get overdue deliveries
    const now = new Date();
    const overdue = await Beneficiary.countDocuments({
      status: 'active',
      estimatedDelivery: { $lt: now },
      aidReceived: false
    });
    
    res.json({
      success: true,
      distribution,
      urgent: urgent.slice(0, 10), // Top 10 urgent
      recentEscalations,
      overdue,
      lastUpdate: new Date()
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({
      success: false,
      message: 'Error loading dashboard',
      error: err.message
    });
  }
});

/**
 * @route   GET /api/priority/by-level/:level
 * @desc    Get beneficiaries by priority level
 * @access  Private
 */
router.get('/by-level/:level', async (req, res) => {
  try {
    const { level } = req.params;
    const { limit = 100, page = 1 } = req.query;
    
    const validLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority level'
      });
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const beneficiaries = await Beneficiary.find({
      status: 'active',
      priorityLevel: level
    })
    .sort({ vulnerabilityScore: -1, estimatedDelivery: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('registeredBy', 'name email')
    .select('-biometric.faceEmbedding');
    
    const total = await Beneficiary.countDocuments({
      status: 'active',
      priorityLevel: level
    });
    
    res.json({
      success: true,
      level,
      count: beneficiaries.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      beneficiaries
    });
  } catch (err) {
    console.error('Get by level error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching beneficiaries',
      error: err.message
    });
  }
});

/**
 * @route   POST /api/priority/update/:id
 * @desc    Manually recalculate score for one beneficiary
 * @access  Private (field_worker, ngo, admin)
 */
router.post('/update/:id', authorize('field_worker', 'ngo', 'admin'), async (req, res) => {
  try {
    const result = await VulnerabilityService.updateBeneficiaryScore(req.params.id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: 'Score updated successfully',
      ...result
    });
  } catch (err) {
    console.error('Update score error:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating score',
      error: err.message
    });
  }
});

/**
 * @route   POST /api/priority/update-all
 * @desc    Manually trigger bulk score update (admin only)
 * @access  Private (admin)
 */
router.post('/update-all', authorize('admin'), async (req, res) => {
  try {
    // Run async - don't wait for completion
    VulnerabilityService.updateAllScores()
      .then(results => {
        console.log('[API] Bulk update completed:', results);
      })
      .catch(err => {
        console.error('[API] Bulk update failed:', err);
      });
    
    res.json({
      success: true,
      message: 'Bulk update started in background'
    });
  } catch (err) {
    console.error('Bulk update error:', err);
    res.status(500).json({
      success: false,
      message: 'Error starting bulk update',
      error: err.message
    });
  }
});

/**
 * @route   GET /api/priority/map-data
 * @desc    Get beneficiaries for map visualization
 * @access  Private
 */
router.get('/map-data', async (req, res) => {
  try {
    const { priorityLevel, bounds } = req.query;
    
    const query = {
      status: 'active',
      'location.coordinates': { $exists: true, $ne: [0, 0] }
    };
    
    if (priorityLevel) {
      query.priorityLevel = priorityLevel;
    }
    
    // If bounds provided, filter by geographic area
    if (bounds) {
      const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(parseFloat);
      query.location = {
        $geoWithin: {
          $box: [
            [minLng, minLat],
            [maxLng, maxLat]
          ]
        }
      };
    }
    
    const beneficiaries = await Beneficiary.find(query)
      .select('name location priorityLevel priorityColor vulnerabilityScore estimatedDelivery address')
      .limit(1000); // Limit for performance
    
    res.json({
      success: true,
      count: beneficiaries.length,
      beneficiaries
    });
  } catch (err) {
    console.error('Map data error:', err);
    res.status(500).json({
      success: false,
      message: 'Error loading map data',
      error: err.message
    });
  }
});

/**
 * @route   GET /api/priority/stats
 * @desc    Get detailed priority statistics
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    const distribution = await VulnerabilityService.getPriorityDistribution();
    
    // Score distribution histogram
    const scoreHistogram = await Beneficiary.aggregate([
      { $match: { status: 'active' } },
      {
        $bucket: {
          groupBy: '$vulnerabilityScore',
          boundaries: [0, 20, 40, 60, 80, 100],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            avgScore: { $avg: '$vulnerabilityScore' }
          }
        }
      }
    ]);
    
    // Timeline: deliveries due in next 7 days
    const timeline = [];
    for (let i = 0; i < 7; i++) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      startOfDay.setDate(startOfDay.getDate() + i);
      
      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);
      
      const count = await Beneficiary.countDocuments({
        status: 'active',
        estimatedDelivery: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      timeline.push({
        date: startOfDay.toISOString().split('T')[0],
        count
      });
    }
    
    res.json({
      success: true,
      distribution,
      scoreHistogram,
      timeline
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Error loading statistics',
      error: err.message
    });
  }
});

module.exports = router;