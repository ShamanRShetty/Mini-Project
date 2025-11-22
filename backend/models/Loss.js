/**
 * Loss Model
 * 
 * Records disaster-related losses:
 * - Human casualties (deaths, missing persons)
 * - Property damage (homes, livelihoods)
 * - Infrastructure damage
 * 
 * Helps with damage assessment and recovery planning.
 */

const mongoose = require('mongoose');

const LossSchema = new mongoose.Schema({
  // ========================================
  // LOSS CLASSIFICATION
  // ========================================
  
  type: {
    type: String,
    enum: [
      'death',              // Confirmed death
      'missing_person',     // Missing person
      'injury',            // Physical injury
      'home_destroyed',    // Complete home destruction
      'home_damaged',      // Partial home damage
      'livelihood_lost',   // Lost job/business
      'property_damage',   // Other property damage
      'infrastructure',    // Roads, bridges, etc.
      'livestock_loss',    // Animals lost
      'crop_damage'        // Agricultural damage
    ],
    required: [true, 'Loss type is required']
  },
  
  severity: {
    type: String,
    enum: ['critical', 'severe', 'moderate', 'minor'],
    default: 'moderate'
  },
  
  // ========================================
  // AFFECTED PERSON/FAMILY
  // ========================================
  
  // Link to beneficiary if they're in system
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiary'
  },
  
  // If not in system, store details directly
  affectedPerson: {
    name: String,
    age: Number,
    gender: String,
    nationalId: String,
    relationship: String // e.g., "self", "spouse", "child", "parent"
  },
  
  // Family affected
  familySize: Number,
  
  // ========================================
  // HUMAN CASUALTIES (for death/missing)
  // ========================================
  
  // For death records
  deceased: {
    name: String,
    age: Number,
    gender: String,
    causeOfDeath: String,
    dateOfDeath: Date,
    deathCertificateNumber: String
  },
  
  // For missing persons
  missingPerson: {
    name: String,
    age: Number,
    gender: String,
    lastSeenDate: Date,
    lastSeenLocation: String,
    physicalDescription: String,
    contactForInfo: String
  },
  
  // ========================================
  // PROPERTY/ASSET LOSS
  // ========================================
  
  propertyDetails: {
    propertyType: {
      type: String,
      enum: ['residential', 'commercial', 'agricultural', 'vehicle', 'livestock', 'other']
    },
    description: String,
    estimatedValue: Number, // In local currency
    replacementCost: Number,
    salvageValue: Number,
    insured: Boolean,
    insuranceClaim: String // Claim number if applicable
  },
  
  // ========================================
  // LOCATION
  // ========================================
  
  address: {
    street: String,
    village: String,
    district: String,
    region: String
  },
  
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number] // [longitude, latitude]
  },
  
  // ========================================
  // DOCUMENTATION
  // ========================================
  
  description: {
    type: String,
    required: [true, 'Loss description is required']
  },
  
  // Photos/videos as evidence
  evidence: [{
    type: String, // File path
    description: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Official documents
  documents: [{
    type: {
      type: String,
      enum: ['police_report', 'death_certificate', 'medical_report', 'insurance', 'property_deed', 'other']
    },
    documentNumber: String,
    filePath: String,
    issuedBy: String,
    issuedDate: Date
  }],
  
  // ========================================
  // VERIFICATION
  // ========================================
  
  verified: {
    type: Boolean,
    default: false
  },
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  verifiedAt: Date,
  
  verificationNotes: String,
  
  // ========================================
  // REPORTING
  // ========================================
  
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  reportedDate: {
    type: Date,
    default: Date.now
  },
  
  // When the loss actually occurred
  incidentDate: {
    type: Date,
    required: [true, 'Incident date is required']
  },
  
  // ========================================
  // RECOVERY & ASSISTANCE
  // ========================================
  
  // Has compensation been provided?
  compensated: {
    type: Boolean,
    default: false
  },
  
  compensationDetails: {
    amount: Number,
    type: String, // cash, materials, services
    date: Date,
    provider: String
  },
  
  // Recovery needs
  recoveryNeeds: [{
    type: String,
    enum: ['housing', 'livelihood', 'medical', 'psychological', 'financial', 'legal', 'education'],
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low']
    }
  }],
  
  // Recovery status
  recoveryStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'partially_recovered', 'fully_recovered'],
    default: 'not_started'
  },
  
  // ========================================
  // STATUS & METADATA
  // ========================================
  
  status: {
    type: String,
    enum: ['reported', 'under_review', 'verified', 'disputed', 'closed'],
    default: 'reported'
  },
  
  notes: String,
  
  // ========================================
  // OFFLINE SYNC
  // ========================================
  
  offlineId: {
    type: String,
    sparse: true
  },
  
  syncedAt: Date
  
}, {
  timestamps: true
});

// ========================================
// INDEXES
// ========================================

LossSchema.index({ type: 1, severity: 1 });
LossSchema.index({ beneficiary: 1 });
LossSchema.index({ incidentDate: -1 });
LossSchema.index({ status: 1 });
LossSchema.index({ location: '2dsphere' });
LossSchema.index({ verified: 1 });

// ========================================
// METHODS
// ========================================

/**
 * Get human-readable summary
 */
LossSchema.methods.getSummary = function() {
  let summary = `${this.type.replace('_', ' ')} - ${this.severity}`;
  
  if (this.deceased?.name) {
    summary += ` - ${this.deceased.name}`;
  } else if (this.missingPerson?.name) {
    summary += ` - ${this.missingPerson.name}`;
  } else if (this.affectedPerson?.name) {
    summary += ` - ${this.affectedPerson.name}`;
  }
  
  return summary;
};

/**
 * Calculate total estimated loss value
 */
LossSchema.methods.getTotalValue = function() {
  return this.propertyDetails?.estimatedValue || 0;
};

/**
 * Check if requires urgent attention
 */
LossSchema.methods.isUrgent = function() {
  // Death, missing person, or critical severity
  if (['death', 'missing_person'].includes(this.type)) return true;
  if (this.severity === 'critical') return true;
  
  // Unverified human casualties
  if (['death', 'missing_person', 'injury'].includes(this.type) && !this.verified) {
    return true;
  }
  
  return false;
};

// ========================================
// STATICS
// ========================================

/**
 * Get loss statistics
 */
LossSchema.statics.getStatistics = async function(filters = {}) {
  const match = { ...filters };
  
  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        verified: { $sum: { $cond: ['$verified', 1, 0] } },
        totalValue: { $sum: '$propertyDetails.estimatedValue' },
        criticalCases: {
          $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

/**
 * Find all losses for a specific beneficiary
 */
LossSchema.statics.findByBeneficiary = async function(beneficiaryId) {
  return await this.find({ beneficiary: beneficiaryId })
    .sort({ incidentDate: -1 });
};

/**
 * Get unverified critical losses
 */
LossSchema.statics.getUnverifiedCritical = async function() {
  return await this.find({
    verified: false,
    $or: [
      { type: { $in: ['death', 'missing_person'] } },
      { severity: 'critical' }
    ]
  })
  .populate('reportedBy', 'name email')
  .sort({ incidentDate: -1 });
};

/**
 * Get recovery needs summary
 */
LossSchema.statics.getRecoveryNeedsSummary = async function() {
  return await this.aggregate([
    { $unwind: '$recoveryNeeds' },
    {
      $group: {
        _id: {
          need: '$recoveryNeeds.type',
          priority: '$recoveryNeeds.priority'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.priority': 1, count: -1 } }
  ]);
};

module.exports = mongoose.model('Loss', LossSchema);