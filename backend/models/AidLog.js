/**
 * AidLog Model
 * 
 * Records every aid distribution transaction.
 * Creates an audit trail for transparency and accountability.
 * Each log entry is linked to the blockchain ledger.
 */

const mongoose = require('mongoose');

const AidLogSchema = new mongoose.Schema({
  // ========================================
  // WHO RECEIVED AID
  // ========================================
  
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiary',
    required: [true, 'Beneficiary is required']
  },
  
  // Snapshot of beneficiary info at time of distribution
  beneficiarySnapshot: {
    name: String,
    nationalId: String,
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number]
    }
  },
  
  // ========================================
  // WHAT WAS GIVEN
  // ========================================
  
  items: [{
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource'
    },
    itemType: {
      type: String,
      enum: ['food', 'water', 'shelter', 'medicine', 'clothing', 'hygiene', 'cash', 'other'],
      required: true
    },
    itemName: String, // e.g., "Rice", "Water Bottles", "Blanket"
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative']
    },
    unit: String, // e.g., "kg", "liters", "pieces"
    estimatedValue: Number // Value in local currency
  }],
  
  // Total value of aid given
  totalValue: {
    type: Number,
    default: 0
  },
  
  // ========================================
  // WHO GAVE AID & WHEN
  // ========================================
  
  distributedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Distributor is required']
  },
  
  distributionDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // Where aid was distributed
  distributionLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number] // [longitude, latitude]
  },
  
  distributionSite: String, // e.g., "Central Relief Camp", "Village Hall"
  
  // ========================================
  // VERIFICATION & BIOMETRIC
  // ========================================
  
  verificationMethod: {
    type: String,
    enum: ['biometric', 'national_id', 'manual', 'none'],
    default: 'manual'
  },
  
  // Biometric verification result
  biometricMatch: {
    verified: Boolean,
    confidence: Number, // 0-1 score
    timestamp: Date
  },
  
  // Photo proof (optional - capture at distribution)
  distributionPhoto: String, // Path to image file
  
  // ========================================
  // DONOR TRACEABILITY
  // ========================================
  
  // Which donor funded this aid
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  donorBatch: String, // Batch/shipment ID from donor
  
  // ========================================
  // BLOCKCHAIN LINKAGE
  // ========================================
  
  // Link to blockchain ledger entry
  ledgerEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ledger'
  },
  
  // Transaction hash (unique identifier)
  transactionHash: {
    type: String,
  },
  
  // ========================================
  // STATUS & METADATA
  // ========================================
  
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled', 'disputed'],
    default: 'completed'
  },
  
  // Reason if cancelled/disputed
  statusReason: String,
  
  // Additional notes
  notes: String,
  
  // Recipient signature (base64 or path)
  recipientSignature: String,
  
  // GPS accuracy at time of distribution
  gpsAccuracy: Number, // meters
  
  // ========================================
  // OFFLINE SYNC METADATA
  // ========================================
  
  offlineId: {
    type: String,
    sparse: true
  },
  
  syncedAt: Date,
  
  createdOffline: {
    type: Boolean,
    default: false
  }
  
}, {
  timestamps: true
});

// ========================================
// INDEXES
// ========================================

// Index for beneficiary queries
AidLogSchema.index({ beneficiary: 1, distributionDate: -1 });

// Index for distributor queries
AidLogSchema.index({ distributedBy: 1, distributionDate: -1 });

// Index for donor traceability
AidLogSchema.index({ donor: 1 });

// Index for date range queries
AidLogSchema.index({ distributionDate: -1 });

// Geospatial index
AidLogSchema.index({ distributionLocation: '2dsphere' });

// Transaction hash index (for blockchain verification)
AidLogSchema.index({ transactionHash: 1 },{ unique : true, sparse: true });

// ========================================
// MIDDLEWARE
// ========================================

/**
 * Calculate total value before saving
 */
AidLogSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.totalValue = this.items.reduce((sum, item) => {
      return sum + (item.estimatedValue || 0) * (item.quantity || 0);
    }, 0);
  }
  next();
});

// ========================================
// METHODS
// ========================================

/**
 * Get summary for display
 */
AidLogSchema.methods.getSummary = function() {
  return {
    id: this._id,
    beneficiary: this.beneficiarySnapshot?.name || 'Unknown',
    items: this.items.map(item => `${item.quantity} ${item.unit || ''} ${item.itemName}`).join(', '),
    totalValue: this.totalValue,
    date: this.distributionDate,
    distributor: this.distributedBy,
    verified: this.verificationMethod !== 'none',
    blockchainHash: this.transactionHash
  };
};

/**
 * Check if this log is verified on blockchain
 */
AidLogSchema.methods.isBlockchainVerified = function() {
  return !!this.transactionHash && !!this.ledgerEntry;
};

// ========================================
// STATICS (Model-level methods)
// ========================================

/**
 * Get aid distribution statistics
 */
AidLogSchema.statics.getStatistics = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.distributionDate = {};
    if (startDate) match.distributionDate.$gte = new Date(startDate);
    if (endDate) match.distributionDate.$lte = new Date(endDate);
  }
  
  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalDistributions: { $sum: 1 },
        totalValue: { $sum: '$totalValue' },
        uniqueBeneficiaries: { $addToSet: '$beneficiary' },
        totalItems: { $sum: { $size: '$items' } }
      }
    },
    {
      $project: {
        _id: 0,
        totalDistributions: 1,
        totalValue: 1,
        uniqueBeneficiaries: { $size: '$uniqueBeneficiaries' },
        totalItems: 1
      }
    }
  ]);
};

/**
 * Get aid distribution by type
 */
AidLogSchema.statics.getDistributionByType = async function() {
  return await this.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.itemType',
        totalQuantity: { $sum: '$items.quantity' },
        totalValue: { $sum: { $multiply: ['$items.quantity', '$items.estimatedValue'] } },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalValue: -1 } }
  ]);
};

module.exports = mongoose.model('AidLog', AidLogSchema);