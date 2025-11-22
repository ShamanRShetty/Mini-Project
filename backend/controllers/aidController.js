/**
 * Aid Distribution Controller
 * 
 * Handles aid distribution, biometric verification, and logging.
 * 
 * Functions:
 * - distribute: Distribute aid to beneficiary
 * - verifyBiometric: Verify beneficiary using face image
 * - getHistory: Get aid distribution history
 * - getStats: Get distribution statistics
 */

const AidLog = require('../models/AidLog');
const Beneficiary = require('../models/Beneficiary');
const Resource = require('../models/Resource');
const Ledger = require('../models/Ledger');
const { compareFaces } = require('../utils/biometric');

/**
 * @route   POST /api/aid/distribute
 * @desc    Distribute aid to beneficiary
 * @access  Private (Field Worker, NGO, Admin)
 */
exports.distribute = async (req, res) => {
  try {
    const {
      beneficiaryId,
      items, // Array of { resourceId, itemType, itemName, quantity, unit, estimatedValue }
      verificationMethod,
      biometricData,
      distributionLocation,
      distributionSite,
      notes
    } = req.body;

    // Validate required fields
    if (!beneficiaryId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary ID and items are required'
      });
    }

    // Find beneficiary
    const beneficiary = await Beneficiary.findById(beneficiaryId);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found'
      });
    }

    // Check if beneficiary is eligible for aid
    if (!beneficiary.isEligibleForAid()) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary is not eligible for aid at this time',
        lastAidDate: beneficiary.lastAidDate,
        reason: 'Must wait 7 days between aid distributions'
      });
    }

    // Biometric verification if provided
    let biometricVerification = null;
    if (verificationMethod === 'biometric' && biometricData) {
      const verificationResult = await compareFaces(
        beneficiary.biometric?.faceImagePath,
        biometricData
      );
      
      biometricVerification = {
        verified: verificationResult.match,
        confidence: verificationResult.confidence,
        timestamp: new Date()
      };

      // Require minimum confidence threshold
      if (!verificationResult.match || verificationResult.confidence < 0.7) {
        return res.status(400).json({
          success: false,
          message: 'Biometric verification failed',
          confidence: verificationResult.confidence
        });
      }
    }

    // Update resource inventory
    for (const item of items) {
      if (item.resourceId) {
        const resource = await Resource.findById(item.resourceId);
        if (resource) {
          await resource.recordDistribution(item.quantity);
        }
      }
    }

    // Create beneficiary snapshot
    const beneficiarySnapshot = {
      name: beneficiary.name,
      nationalId: beneficiary.nationalId,
      location: beneficiary.location
    };

    // Parse distribution location
    let parsedLocation = null;
    if (distributionLocation?.latitude && distributionLocation?.longitude) {
      parsedLocation = {
        type: 'Point',
        coordinates: [
          parseFloat(distributionLocation.longitude),
          parseFloat(distributionLocation.latitude)
        ]
      };
    }

    // Create aid log
    const aidLog = await AidLog.create({
      beneficiary: beneficiaryId,
      beneficiarySnapshot,
      items,
      distributedBy: req.user.id,
      distributionDate: new Date(),
      distributionLocation: parsedLocation,
      distributionSite,
      verificationMethod: verificationMethod || 'manual',
      biometricMatch: biometricVerification,
      notes
    });

    // Update beneficiary aid tracking
    beneficiary.recordAidReceived();
    await beneficiary.save();

    // Add to blockchain ledger
    const ledgerEntry = await Ledger.addBlock(
      'aid_distribution',
      {
        aidLogId: aidLog._id,
        beneficiaryId: beneficiary._id,
        beneficiaryName: beneficiary.name,
        items: items.map(i => ({ type: i.itemType, quantity: i.quantity })),
        totalValue: aidLog.totalValue,
        distributedBy: req.user.id,
        timestamp: new Date()
      },
      req.user.id,
      `Aid distributed to ${beneficiary.name}`
    );

    // Link ledger entry to aid log
    aidLog.ledgerEntry = ledgerEntry._id;
    aidLog.transactionHash = ledgerEntry.hash;
    await aidLog.save();

    res.status(201).json({
      success: true,
      message: 'Aid distributed successfully',
      aidLog,
      ledgerHash: ledgerEntry.hash,
      beneficiary: {
        id: beneficiary._id,
        name: beneficiary.name,
        aidCount: beneficiary.aidCount
      }
    });

  } catch (error) {
    console.error('Distribute aid error:', error);
    res.status(500).json({
      success: false,
      message: 'Error distributing aid',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/aid/verify-biometric
 * @desc    Verify beneficiary using biometric (face image)
 * @access  Private
 */
exports.verifyBiometric = async (req, res) => {
  try {
    const { beneficiaryId, faceImageData } = req.body;

    if (!beneficiaryId || !faceImageData) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary ID and face image data are required'
      });
    }

    // Find beneficiary
    const beneficiary = await Beneficiary.findById(beneficiaryId);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found'
      });
    }

    // Check if beneficiary has biometric data
    if (!beneficiary.biometric?.faceImagePath) {
      return res.status(400).json({
        success: false,
        message: 'No biometric data registered for this beneficiary'
      });
    }

    // Compare faces
    const result = await compareFaces(
      beneficiary.biometric.faceImagePath,
      faceImageData
    );

    res.json({
      success: true,
      verified: result.match,
      confidence: result.confidence,
      beneficiary: {
        id: beneficiary._id,
        name: beneficiary.name,
        eligibleForAid: beneficiary.isEligibleForAid()
      }
    });

  } catch (error) {
    console.error('Verify biometric error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying biometric',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/aid/history
 * @desc    Get aid distribution history
 * @access  Private
 */
exports.getHistory = async (req, res) => {
  try {
    const {
      beneficiaryId,
      distributorId,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 50
    } = req.query;

    // Build query
    const query = {};
    if (beneficiaryId) query.beneficiary = beneficiaryId;
    if (distributorId) query.distributedBy = distributorId;
    if (status) query.status = status;

    // Date range
    if (startDate || endDate) {
      query.distributionDate = {};
      if (startDate) query.distributionDate.$gte = new Date(startDate);
      if (endDate) query.distributionDate.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const logs = await AidLog.find(query)
      .populate('beneficiary', 'name nationalId')
      .populate('distributedBy', 'name email organization')
      .sort({ distributionDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AidLog.countDocuments(query);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      logs
    });

  } catch (error) {
    console.error('Get aid history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching aid history',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/aid/stats
 * @desc    Get aid distribution statistics
 * @access  Private
 */
exports.getStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get overall statistics
    const stats = await AidLog.getStatistics(startDate, endDate);

    // Get distribution by type
    const byType = await AidLog.getDistributionByType();

    // Recent distributions
    const recentDistributions = await AidLog.find()
      .sort({ distributionDate: -1 })
      .limit(10)
      .populate('beneficiary', 'name')
      .populate('distributedBy', 'name');

    // Top distributors
    const topDistributors = await AidLog.aggregate([
      {
        $group: {
          _id: '$distributedBy',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalValue' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Populate distributor details
    await AidLog.populate(topDistributors, {
      path: '_id',
      select: 'name email organization'
    });

    res.json({
      success: true,
      stats: stats[0] || {},
      byType,
      recentDistributions,
      topDistributors
    });

  } catch (error) {
    console.error('Get aid stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching aid statistics',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/aid/log/:id
 * @desc    Get single aid log details
 * @access  Private
 */
exports.getLogById = async (req, res) => {
  try {
    const aidLog = await AidLog.findById(req.params.id)
      .populate('beneficiary')
      .populate('distributedBy', 'name email organization')
      .populate('ledgerEntry');

    if (!aidLog) {
      return res.status(404).json({
        success: false,
        message: 'Aid log not found'
      });
    }

    res.json({
      success: true,
      aidLog
    });

  } catch (error) {
    console.error('Get aid log error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching aid log',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/aid/log/:id/cancel
 * @desc    Cancel/dispute aid distribution
 * @access  Private (Admin)
 */
exports.cancelDistribution = async (req, res) => {
  try {
    const { reason } = req.body;

    const aidLog = await AidLog.findById(req.params.id);
    if (!aidLog) {
      return res.status(404).json({
        success: false,
        message: 'Aid log not found'
      });
    }

    // Update status
    aidLog.status = 'cancelled';
    aidLog.statusReason = reason;
    await aidLog.save();

    // Reverse beneficiary aid count
    const beneficiary = await Beneficiary.findById(aidLog.beneficiary);
    if (beneficiary) {
      beneficiary.aidCount = Math.max(0, beneficiary.aidCount - 1);
      await beneficiary.save();
    }

    // Restore resource inventory
    for (const item of aidLog.items) {
      if (item.resourceId) {
        const resource = await Resource.findById(item.resourceId);
        if (resource) {
          await resource.addStock(item.quantity);
        }
      }
    }

    res.json({
      success: true,
      message: 'Aid distribution cancelled',
      aidLog
    });

  } catch (error) {
    console.error('Cancel distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling distribution',
      error: error.message
    });
  }
};