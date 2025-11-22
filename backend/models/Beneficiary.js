/**
 * Beneficiary Model
 * 
 * Represents a person/family receiving disaster relief aid.
 * Includes personal info, location, needs, and biometric data.
 */

const mongoose = require('mongoose');

const BeneficiarySchema = new mongoose.Schema({
  // ========================================
  // PERSONAL INFORMATION
  // ========================================
  
  name: {
    type: String,
    required: [true, 'Beneficiary name is required'],
    trim: true
  },
  
  age: {
    type: Number,
    min: [0, 'Age cannot be negative'],
    max: [150, 'Age seems invalid']
  },
  
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    default: 'prefer_not_to_say'
  },
  
  nationalId: {
    type: String,
    trim: true,
    sparse: true // Allow null but enforce unique if provided
  },
  
  phone: {
    type: String,
    trim: true
  },
  
  // ========================================
  // FAMILY INFORMATION
  // ========================================
  
  familySize: {
    type: Number,
    default: 1,
    min: [1, 'Family size must be at least 1']
  },
  
  // Number of children in family
  dependents: {
    type: Number,
    default: 0,
    min: [0, 'Dependents cannot be negative']
  },
  
  // ========================================
  // LOCATION DATA
  // ========================================
  
  address: {
    street: String,
    village: String,
    district: String,
    region: String,
    postalCode: String
  },
  
  // GPS coordinates - for mapping
  location: {
    type: {
      type: String,
      enum: ['Point'], // GeoJSON type
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0], // [longitude, latitude]
      required: false
    }
  },
  
  // ========================================
  // NEEDS ASSESSMENT
  // ========================================
  
  needs: [{
    type: {
      type: String,
      enum: ['food', 'water', 'shelter', 'medicine', 'clothing', 'hygiene', 'other'],
      required: true
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium'
    },
    quantity: Number,
    description: String
  }],
  
  // ========================================
  // LOSSES REPORTED
  // ========================================
  
  losses: [{
    type: {
      type: String,
      enum: ['death', 'missing_person', 'home_destroyed', 'home_damaged', 'livelihood_lost', 'property_damage'],
      required: true
    },
    description: String,
    estimatedValue: Number, // For property losses
    date: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ========================================
  // BIOMETRIC DATA (for verification)
  // ========================================
  
  biometric: {
    // Path to stored face image
    faceImagePath: String,
    
    // Face embedding (feature vector for matching)
    // This would come from a face recognition library
    faceEmbedding: [Number],
    
    // When biometric was captured
    capturedAt: Date,
    
    // Who captured it
    capturedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // ========================================
  // AID DISTRIBUTION TRACKING
  // ========================================
  
  // Has this beneficiary received aid?
  aidReceived: {
    type: Boolean,
    default: false
  },
  
  // When they last received aid
  lastAidDate: Date,
  
  // Total number of times they received aid
  aidCount: {
    type: Number,
    default: 0
  },
  
  // ========================================
  // REGISTRATION INFO
  // ========================================
  
  // Who registered this beneficiary
  registeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // When registered
  registrationDate: {
    type: Date,
    default: Date.now
  },
  
  // Verification status
  verified: {
    type: Boolean,
    default: false
  },
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  verifiedAt: Date,
  
  // ========================================
  // SYNC METADATA (for offline support)
  // ========================================
  
  // Unique ID from offline device (helps prevent duplicates)
  offlineId: {
    type: String,
    sparse: true
  },
  
  // Last time synced from offline device
  lastSyncedAt: Date,
  
  // Additional notes
  notes: String,
  
  // Account status
  status: {
    type: String,
    enum: ['active', 'relocated', 'deceased', 'duplicate', 'invalid'],
    default: 'active'
  }
  
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// ========================================
// INDEXES (for faster queries)
// ========================================

// Geospatial index for location-based queries (find nearby beneficiaries)
BeneficiarySchema.index({ location: '2dsphere' });

// Index on registration date (for time-based queries)
BeneficiarySchema.index({ registrationDate: -1 });

// Index on status (filter by active/inactive)
BeneficiarySchema.index({ status: 1 });

// Compound index for searching
BeneficiarySchema.index({ name: 'text', 'address.district': 'text' });

// ========================================
// METHODS
// ========================================

/**
 * Check if beneficiary is eligible for aid
 * (Not served recently, is active, etc.)
 */
BeneficiarySchema.methods.isEligibleForAid = function() {
  // Must be active
  if (this.status !== 'active') return false;
  
  // If never received aid, eligible
  if (!this.aidReceived) return true;
  
  // If last aid was more than 7 days ago, eligible
  const daysSinceLastAid = (Date.now() - this.lastAidDate) / (1000 * 60 * 60 * 24);
  return daysSinceLastAid >= 7;
};

/**
 * Update aid tracking after distribution
 */
BeneficiarySchema.methods.recordAidReceived = function() {
  this.aidReceived = true;
  this.lastAidDate = new Date();
  this.aidCount += 1;
};

/**
 * Get priority level based on needs
 */
BeneficiarySchema.methods.getPriorityLevel = function() {
  // Check if any critical needs
  const hasCritical = this.needs.some(need => need.priority === 'critical');
  if (hasCritical) return 'critical';
  
  // Check if high needs
  const hasHigh = this.needs.some(need => need.priority === 'high');
  if (hasHigh) return 'high';
  
  // Check if severe losses
  const hasSevereLoss = this.losses.some(loss => 
    loss.type === 'death' || loss.type === 'home_destroyed'
  );
  if (hasSevereLoss) return 'critical';
  
  return 'medium';
};

// Export model
module.exports = mongoose.model('Beneficiary', BeneficiarySchema);