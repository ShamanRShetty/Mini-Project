/**
 * Beneficiary Controller
 * 
 * Handles beneficiary registration, search, updates, and verification.
 * 
 * Functions:
 * - register: Create new beneficiary
 * - getAll: Get all beneficiaries with filters
 * - getById: Get single beneficiary details
 * - update: Update beneficiary information
 * - verify: Verify beneficiary identity
 * - getStats: Get beneficiary statistics
 * - searchNearby: Find beneficiaries near a location
 */

const Beneficiary = require('../models/Beneficiary');
const Ledger = require('../models/Ledger');
const { deduplicateBeneficiary } = require('../utils/dedupe');

/**
 * @route   POST /api/beneficiaries
 * @desc    Register new beneficiary
 * @access  Private (Field Worker, NGO, Admin)
 */
exports.register = async (req, res) => {
  try {
    const beneficiaryData = {
      ...req.body,
      registeredBy: req.user.id, // From auth middleware
      registrationDate: new Date()
    };

    // Handle location coordinates if provided
    if (req.body.latitude && req.body.longitude) {
      beneficiaryData.location = {
        type: 'Point',
        coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
      };
    }

    // Check for duplicates (by name, nationalId, or biometric)
    const possibleDuplicate = await deduplicateBeneficiary(beneficiaryData);
    
    if (possibleDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'Possible duplicate beneficiary found',
        duplicateId: possibleDuplicate._id,
        duplicate: possibleDuplicate
      });
    }

    // Create beneficiary
    const beneficiary = await Beneficiary.create(beneficiaryData);

    // Add to blockchain ledger
    await Ledger.addBlock(
      'beneficiary_registration',
      {
        beneficiaryId: beneficiary._id,
        name: beneficiary.name,
        registeredBy: req.user.id,
        timestamp: new Date()
      },
      req.user.id,
      `Beneficiary registered: ${beneficiary.name}`
    );

    res.status(201).json({
      success: true,
      message: 'Beneficiary registered successfully',
      beneficiary
    });

  } catch (error) {
    console.error('Register beneficiary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering beneficiary',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/beneficiaries
 * @desc    Get all beneficiaries with filters
 * @access  Private
 */
exports.getAll = async (req, res) => {
  try {
    const {
      status,
      verified,
      district,
      priority,
      search,
      page = 1,
      limit = 50
    } = req.query;

    // Build query
    const query = {};
    
    if (status) query.status = status;
    if (verified !== undefined) query.verified = verified === 'true';
    if (district) query['address.district'] = district;
    
    // Search by name or nationalId
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { nationalId: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const beneficiaries = await Beneficiary.find(query)
      .populate('registeredBy', 'name email')
      .sort({ registrationDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Beneficiary.countDocuments(query);

    res.json({
      success: true,
      count: beneficiaries.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      beneficiaries
    });

  } catch (error) {
    console.error('Get beneficiaries error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching beneficiaries',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/beneficiaries/:id
 * @desc    Get single beneficiary by ID
 * @access  Private
 */
exports.getById = async (req, res) => {
  try {
    const beneficiary = await Beneficiary.findById(req.params.id)
      .populate('registeredBy', 'name email organization')
      .populate('verifiedBy', 'name email');

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found'
      });
    }

    res.json({
      success: true,
      beneficiary
    });

  } catch (error) {
    console.error('Get beneficiary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching beneficiary',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/beneficiaries/:id
 * @desc    Update beneficiary information
 * @access  Private (Field Worker, NGO, Admin)
 */
exports.update = async (req, res) => {
  try {
    // Fields that can be updated
    const allowedUpdates = [
      'name', 'age', 'gender', 'phone', 'familySize', 'dependents',
      'address', 'needs', 'notes', 'status'
    ];

    // Filter request body to only allowed fields
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Handle location update
    if (req.body.latitude && req.body.longitude) {
      updates.location = {
        type: 'Point',
        coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
      };
    }

    const beneficiary = await Beneficiary.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found'
      });
    }

    res.json({
      success: true,
      message: 'Beneficiary updated successfully',
      beneficiary
    });

  } catch (error) {
    console.error('Update beneficiary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating beneficiary',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/beneficiaries/:id/verify
 * @desc    Verify beneficiary identity
 * @access  Private (NGO, Admin)
 */
exports.verify = async (req, res) => {
  try {
    const beneficiary = await Beneficiary.findById(req.params.id);

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found'
      });
    }

    beneficiary.verified = true;
    beneficiary.verifiedBy = req.user.id;
    beneficiary.verifiedAt = new Date();
    
    await beneficiary.save();

    res.json({
      success: true,
      message: 'Beneficiary verified successfully',
      beneficiary
    });

  } catch (error) {
    console.error('Verify beneficiary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying beneficiary',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/beneficiaries/:id
 * @desc    Delete beneficiary (soft delete - mark as invalid)
 * @access  Private (Admin only)
 */
exports.deleteBeneficiary = async (req, res) => {
  try {
    const beneficiary = await Beneficiary.findByIdAndUpdate(
      req.params.id,
      { status: 'invalid' },
      { new: true }
    );

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found'
      });
    }

    res.json({
      success: true,
      message: 'Beneficiary deleted successfully'
    });

  } catch (error) {
    console.error('Delete beneficiary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting beneficiary',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/beneficiaries/stats/overview
 * @desc    Get beneficiary statistics
 * @access  Private
 */
exports.getStats = async (req, res) => {
  try {
    // Total counts by status
    const statusCounts = await Beneficiary.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Verification stats
    const verificationStats = await Beneficiary.aggregate([
      {
        $group: {
          _id: '$verified',
          count: { $sum: 1 }
        }
      }
    ]);

    // Aid received stats
    const aidStats = await Beneficiary.aggregate([
      {
        $group: {
          _id: '$aidReceived',
          count: { $sum: 1 },
          totalAidCount: { $sum: '$aidCount' }
        }
      }
    ]);

    // By district
    const districtCounts = await Beneficiary.aggregate([
      {
        $group: {
          _id: '$address.district',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Priority distribution
    const priorityCounts = await Beneficiary.aggregate([
      {
        $project: {
          priority: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$needs', []] } }, 0] },
              { $arrayElemAt: ['$needs.priority', 0] },
              'none'
            ]
          }
        }
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        byStatus: statusCounts,
        byVerification: verificationStats,
        byAidReceived: aidStats,
        byDistrict: districtCounts,
        byPriority: priorityCounts,
        total: await Beneficiary.countDocuments()
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/beneficiaries/nearby/:lat/:lng
 * @desc    Find beneficiaries near a location
 * @access  Private
 */
exports.searchNearby = async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const { maxDistance = 5000, limit = 50 } = req.query; // maxDistance in meters

    const beneficiaries = await Beneficiary.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      },
      status: 'active'
    })
    .limit(parseInt(limit))
    .populate('registeredBy', 'name');

    res.json({
      success: true,
      count: beneficiaries.length,
      center: { lat: parseFloat(lat), lng: parseFloat(lng) },
      maxDistance: parseInt(maxDistance),
      beneficiaries
    });

  } catch (error) {
    console.error('Search nearby error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching nearby beneficiaries',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/beneficiaries/eligible/aid
 * @desc    Get beneficiaries eligible for aid
 * @access  Private
 */
exports.getEligibleForAid = async (req, res) => {
  try {
    const beneficiaries = await Beneficiary.find({
      status: 'active',
      $or: [
        { aidReceived: false },
        {
          $expr: {
            $gte: [
              { $subtract: [new Date(), '$lastAidDate'] },
              7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
            ]
          }
        }
      ]
    })
    .sort({ 'needs.priority': -1 })
    .limit(100)
    .populate('registeredBy', 'name');

    res.json({
      success: true,
      count: beneficiaries.length,
      beneficiaries
    });

  } catch (error) {
    console.error('Get eligible error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching eligible beneficiaries',
      error: error.message
    });
  }
};