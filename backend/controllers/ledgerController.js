/**
 * Ledger Controller
 * 
 * Manages blockchain-style ledger operations.
 * 
 * Functions:
 * - getAll: Get all ledger entries
 * - getById: Get specific ledger entry
 * - verifyChain: Verify integrity of entire blockchain
 * - verifyBlock: Verify single block
 * - search: Search ledger entries
 */

const Ledger = require('../models/Ledger');

/**
 * @route   GET /api/ledger
 * @desc    Get all ledger entries with pagination
 * @access  Private
 */
exports.getAll = async (req, res) => {
  try {
    const {
      transactionType,
      page = 1,
      limit = 50,
      startDate,
      endDate
    } = req.query;

    // Build query
    const query = {};
    if (transactionType) query.transactionType = transactionType;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get entries
    const entries = await Ledger.find(query)
      .populate('createdBy', 'name email organization')
      .sort({ blockNumber: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Ledger.countDocuments(query);

    // Get latest block info
    const latestBlock = await Ledger.getLatestBlock();

    res.json({
      success: true,
      count: entries.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      latestBlock: latestBlock?.blockNumber || 0,
      entries: entries.map(e => e.getSummary())
    });

  } catch (error) {
    console.error('Get ledger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ledger entries',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/ledger/:id
 * @desc    Get specific ledger entry
 * @access  Private
 */
exports.getById = async (req, res) => {
  try {
    const entry = await Ledger.findById(req.params.id)
      .populate('createdBy', 'name email organization')
      .populate('verifiedBy', 'name email');

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Ledger entry not found'
      });
    }

    // Verify this specific block
    const verification = await entry.verify();

    res.json({
      success: true,
      entry,
      verification
    });

  } catch (error) {
    console.error('Get ledger entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ledger entry',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/ledger/verify/chain
 * @desc    Verify integrity of entire blockchain
 * @access  Private
 */
exports.verifyChain = async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Verify entire chain
    const result = await Ledger.verifyChain();
    
    const endTime = Date.now();
    const verificationTime = endTime - startTime;

    res.json({
      success: true,
      ...result,
      verificationTime: `${verificationTime}ms`
    });

  } catch (error) {
    console.error('Verify chain error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying blockchain',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/ledger/verify/block/:blockNumber
 * @desc    Verify single block
 * @access  Private
 */
exports.verifyBlock = async (req, res) => {
  try {
    const { blockNumber } = req.params;

    const block = await Ledger.findOne({ blockNumber: parseInt(blockNumber) });

    if (!block) {
      return res.status(404).json({
        success: false,
        message: 'Block not found'
      });
    }

    const verification = await block.verify();

    res.json({
      success: true,
      blockNumber: block.blockNumber,
      hash: block.hash,
      verification
    });

  } catch (error) {
    console.error('Verify block error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying block',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/ledger/search
 * @desc    Search ledger entries
 * @access  Private
 */
exports.search = async (req, res) => {
  try {
    const { query, limit = 50 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const results = await Ledger.search(query, parseInt(limit));

    res.json({
      success: true,
      count: results.length,
      results: results.map(e => e.getSummary())
    });

  } catch (error) {
    console.error('Search ledger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching ledger',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/ledger/types/:type
 * @desc    Get entries by transaction type
 * @access  Private
 */
exports.getByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 50 } = req.query;

    const entries = await Ledger.getByType(type, parseInt(limit));

    res.json({
      success: true,
      transactionType: type,
      count: entries.length,
      entries: entries.map(e => ({
        ...e.toObject(),
        summary: e.getSummary()
      }))
    });

  } catch (error) {
    console.error('Get by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching entries by type',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/ledger/stats/overview
 * @desc    Get ledger statistics
 * @access  Private
 */
exports.getStats = async (req, res) => {
  try {
    // Total blocks
    const totalBlocks = await Ledger.countDocuments();

    // Latest block
    const latestBlock = await Ledger.getLatestBlock();

    // Genesis block
    const genesisBlock = await Ledger.getGenesisBlock();

    // By transaction type
    const byType = await Ledger.aggregate([
      {
        $group: {
          _id: '$transactionType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await Ledger.countDocuments({
      timestamp: { $gte: yesterday }
    });

    // Verification stats
    const verificationStats = await Ledger.aggregate([
      {
        $group: {
          _id: '$verified',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalBlocks,
        latestBlockNumber: latestBlock?.blockNumber || 0,
        genesisTimestamp: genesisBlock?.timestamp,
        recentBlocks24h: recentCount,
        byType,
        verificationStats
      }
    });

  } catch (error) {
    console.error('Get ledger stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ledger statistics',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/ledger/init
 * @desc    Initialize ledger (create genesis block)
 * @access  Private (Admin only)
 */
exports.initializeLedger = async (req, res) => {
  try {
    // Check if genesis block exists
    const existing = await Ledger.getGenesisBlock();
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Ledger already initialized',
        genesisBlock: existing
      });
    }

    // Create genesis block
    const genesisBlock = await Ledger.createGenesisBlock();

    res.json({
      success: true,
      message: 'Ledger initialized successfully',
      genesisBlock
    });

  } catch (error) {
    console.error('Initialize ledger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing ledger',
      error: error.message
    });
  }
};

module.exports = exports;