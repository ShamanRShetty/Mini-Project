/**
 * Donor Controller
 * 
 * Provides transparency features for donors.
 */

const Resource = require('../models/Resource');
const AidLog = require('../models/AidLog');
const Ledger = require('../models/Ledger');
const Beneficiary = require('../models/Beneficiary');

/**
 * @route   GET /api/donor/stats
 * @desc    Get donor's contribution statistics
 * @access  Private (Donor)
 */
exports.getDonorStats = async (req, res) => {
  try {
    const donorId = req.user.id;

    const resources = await Resource.find({ donor: donorId });
    
    const totalValue = resources.reduce((sum, r) => sum + r.totalValue, 0);
    const totalQuantity = resources.reduce((sum, r) => sum + r.quantity, 0);
    const distributedQuantity = resources.reduce((sum, r) => sum + r.distributedQuantity, 0);

    const byType = await Resource.aggregate([
      { $match: { donor: donorId } },
      {
        $group: {
          _id: '$type',
          totalQuantity: { $sum: '$quantity' },
          distributedQuantity: { $sum: '$distributedQuantity' },
          totalValue: { $sum: '$totalValue' }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    const aidLogs = await AidLog.find({ donor: donorId })
      .populate('beneficiary', 'name address')
      .sort({ distributionDate: -1 })
      .limit(50);

    const uniqueBeneficiaries = await AidLog.distinct('beneficiary', { donor: donorId });

    const recentDonations = await Resource.find({ donor: donorId })
      .sort({ donationDate: -1 })
      .limit(10);

    res.json({
      success: true,
      stats: {
        totalValue,
        totalQuantity,
        distributedQuantity,
        distributionRate: totalQuantity > 0 ? (distributedQuantity / totalQuantity * 100).toFixed(2) + '%' : '0%',
        beneficiariesHelped: uniqueBeneficiaries.length,
        resourcesProvided: resources.length,
        byType
      },
      recentAidDistributions: aidLogs,
      recentDonations
    });

  } catch (error) {
    console.error('Get donor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching donor statistics',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/donor/track/:resourceId
 * @desc    Track where a specific resource donation went
 * @access  Private (Donor)
 */
exports.trackDonation = async (req, res) => {
  try {
    const { resourceId } = req.params;

    const resource = await Resource.findById(resourceId);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }

    if (resource.donor?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this resource'
      });
    }

    const aidLogs = await AidLog.find({
      'items.resourceId': resourceId
    })
    .populate('beneficiary', 'name age address location')
    .populate('distributedBy', 'name organization')
    .populate('ledgerEntry')
    .sort({ distributionDate: -1 });

    let totalDistributed = 0;
    const distributions = [];

    aidLogs.forEach(log => {
      log.items.forEach(item => {
        if (item.resourceId?.toString() === resourceId) {
          totalDistributed += item.quantity;
          distributions.push({
            beneficiary: log.beneficiary,
            quantity: item.quantity,
            date: log.distributionDate,
            distributor: log.distributedBy,
            verified: log.verificationMethod !== 'none',
            blockchainHash: log.transactionHash
          });
        }
      });
    });

    res.json({
      success: true,
      resource: {
        id: resource._id,
        name: resource.name,
        type: resource.type,
        totalQuantity: resource.quantity,
        distributedQuantity: totalDistributed,
        remainingQuantity: resource.availableQuantity
      },
      distributions,
      beneficiariesReached: distributions.length,
      blockchainVerifiable: distributions.every(d => d.blockchainHash)
    });

  } catch (error) {
    console.error('Track donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking donation',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/donor/impact
 * @desc    Get impact report for donor
 * @access  Private (Donor)
 */
exports.getImpact = async (req, res) => {
  try {
    const donorId = req.user.id;
    const { startDate, endDate } = req.query;

    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);

    const aidQuery = { donor: donorId };
    if (Object.keys(dateQuery).length > 0) {
      aidQuery.distributionDate = dateQuery;
    }

    const aidLogs = await AidLog.find(aidQuery)
      .populate('beneficiary');

    const uniqueBeneficiaries = new Set();
    const districtsReached = new Set();
    let totalFamiliesHelped = 0;
    let totalValue = 0;
    
    const itemTypeDistribution = {};

    aidLogs.forEach(log => {
      uniqueBeneficiaries.add(log.beneficiary?._id?.toString());
      
      if (log.beneficiary?.address?.district) {
        districtsReached.add(log.beneficiary.address.district);
      }

      totalFamiliesHelped += log.beneficiary?.familySize || 1;
      totalValue += log.totalValue || 0;

      log.items.forEach(item => {
        if (!itemTypeDistribution[item.itemType]) {
          itemTypeDistribution[item.itemType] = {
            count: 0,
            totalQuantity: 0
          };
        }
        itemTypeDistribution[item.itemType].count++;
        itemTypeDistribution[item.itemType].totalQuantity += item.quantity;
      });
    });

    const geographicData = await AidLog.aggregate([
      { $match: aidQuery },
      {
        $lookup: {
          from: 'beneficiaries',
          localField: 'beneficiary',
          foreignField: '_id',
          as: 'beneficiaryData'
        }
      },
      { $unwind: '$beneficiaryData' },
      {
        $group: {
          _id: '$beneficiaryData.address.district',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalValue' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const timeline = await AidLog.aggregate([
      { $match: aidQuery },
      {
        $group: {
          _id: {
            year: { $year: '$distributionDate' },
            month: { $month: '$distributionDate' }
          },
          count: { $sum: 1 },
          totalValue: { $sum: '$totalValue' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      impact: {
        beneficiariesReached: uniqueBeneficiaries.size,
        familyMembersHelped: totalFamiliesHelped,
        districtsReached: districtsReached.size,
        totalValueDistributed: totalValue,
        totalDistributions: aidLogs.length,
        itemTypeDistribution,
        geographicDistribution: geographicData,
        timeline
      },
      dateRange: {
        start: startDate || 'Beginning',
        end: endDate || 'Present'
      }
    });

  } catch (error) {
    console.error('Get impact error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching impact report',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/donor/verify/:transactionHash
 * @desc    Verify specific aid transaction on blockchain
 * @access  Public
 */
exports.verifyTransaction = async (req, res) => {
  try {
    const { transactionHash } = req.params;

    const aidLog = await AidLog.findOne({ transactionHash })
      .populate('beneficiary', 'name address')
      .populate('distributedBy', 'name organization')
      .populate('ledgerEntry');

    if (!aidLog) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const ledgerEntry = aidLog.ledgerEntry;
    let blockchainVerification = null;

    if (ledgerEntry) {
      blockchainVerification = await ledgerEntry.verify();
    }

    res.json({
      success: true,
      transaction: {
        hash: transactionHash,
        beneficiary: aidLog.beneficiarySnapshot?.name || aidLog.beneficiary?.name,
        items: aidLog.items,
        totalValue: aidLog.totalValue,
        date: aidLog.distributionDate,
        distributor: aidLog.distributedBy?.name,
        organization: aidLog.distributedBy?.organization,
        verificationMethod: aidLog.verificationMethod,
        status: aidLog.status
      },
      blockchain: {
        blockNumber: ledgerEntry?.blockNumber,
        hash: ledgerEntry?.hash,
        previousHash: ledgerEntry?.previousHash,
        timestamp: ledgerEntry?.timestamp,
        verification: blockchainVerification
      },
      verified: blockchainVerification?.valid && aidLog.status === 'completed'
    });

  } catch (error) {
    console.error('Verify transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying transaction',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/donor/supply-chain
 * @desc    View complete supply chain for donor's contributions
 * @access  Private (Donor)
 */
exports.getSupplyChain = async (req, res) => {
  try {
    const donorId = req.user.id;

    const resources = await Resource.find({ donor: donorId })
      .sort({ donationDate: -1 });

    const supplyChain = [];

    for (const resource of resources) {
      const distributions = await AidLog.find({
        'items.resourceId': resource._id
      })
      .populate('beneficiary', 'name address')
      .populate('distributedBy', 'name')
      .select('distributionDate items beneficiary distributedBy distributionSite');

      supplyChain.push({
        resource: {
          id: resource._id,
          name: resource.name,
          type: resource.type,
          quantity: resource.quantity,
          donationDate: resource.donationDate,
          storageLocation: resource.storageLocation
        },
        journey: [
          {
            stage: 'Donation Received',
            date: resource.receivedDate,
            location: resource.storageLocation?.warehouseName || 'Central Warehouse'
          },
          ...distributions.map(dist => ({
            stage: 'Distributed',
            date: dist.distributionDate,
            location: dist.distributionSite || dist.beneficiary?.address?.district,
            beneficiary: dist.beneficiary?.name,
            distributor: dist.distributedBy?.name,
            quantity: dist.items.find(i => i.resourceId?.toString() === resource._id.toString())?.quantity
          }))
        ],
        status: resource.status,
        remainingQuantity: resource.availableQuantity
      });
    }

    res.json({
      success: true,
      count: supplyChain.length,
      supplyChain
    });

  } catch (error) {
    console.error('Get supply chain error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching supply chain',
      error: error.message
    });
  }
};