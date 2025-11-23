/**
 * Beneficiary Model - UPDATED WITH VULNERABILITY SCORING
 * 
 * New fields:
 * - vulnerabilityScore (0-100)
 * - priorityLevel (CRITICAL, HIGH, MEDIUM, LOW)
 * - estimatedDelivery (Date)
 * - priorityColor (for UI)
 * - lastScoreUpdate (Date)
 */

const mongoose = require('mongoose');

const BeneficiarySchema = new mongoose.Schema({
  // ========================================
  // EXISTING FIELDS (keeping all original fields)
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
    sparse: true
  },
  
  phone: {
    type: String,
    trim: true
  },
  
  familySize: {
    type: Number,
    default: 1,
    min: [1, 'Family size must be at least 1']
  },
  
  dependents: {
    type: Number,
    default: 0,
    min: [0, 'Dependents cannot be negative']
  },
  
  address: {
    street: String,
    village: String,
    district: String,
    region: String,
    postalCode: String
  },
  
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
      required: false
    }
  },
  
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
  
  losses: [{
    type: {
      type: String,
      enum: ['death', 'missing_person', 'home_destroyed', 'home_damaged', 'livelihood_lost', 'property_damage'],
      required: true
    },
    description: String,
    estimatedValue: Number,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  
  biometric: {
    faceImagePath: String,
    faceEmbedding: [Number], // ← Face recognition embedding (128 floats)
    capturedAt: Date,
    capturedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  aidReceived: {
    type: Boolean,
    default: false
  },
  
  lastAidDate: Date,
  
  aidCount: {
    type: Number,
    default: 0
  },
  
  registeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  registrationDate: {
    type: Date,
    default: Date.now
  },
  
  verified: {
    type: Boolean,
    default: false
  },
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  verifiedAt: Date,
  
  offlineId: {
    type: String,
    sparse: true
  },
  
  lastSyncedAt: Date,
  
  notes: String,
  
  status: {
    type: String,
    enum: ['active', 'relocated', 'deceased', 'duplicate', 'invalid'],
    default: 'active'
  },
  
  // ========================================
  // NEW FIELDS: VULNERABILITY SCORING
  // ========================================
  
  vulnerabilityScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true // ← Index for fast sorting
  },
  
  priorityLevel: {
    type: String,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM',
    index: true // ← Index for filtering
  },
  
  priorityColor: {
    type: String,
    enum: ['red', 'orange', 'yellow', 'green'],
    default: 'yellow'
  },
  
  estimatedDelivery: {
    type: Date,
    default: function() {
      // Default: 48 hours from now
      return new Date(Date.now() + 48 * 60 * 60 * 1000);
    }
  },
  
  lastScoreUpdate: {
    type: Date,
    default: Date.now
  },
  
  // Score breakdown (for transparency/debugging)
  scoreBreakdown: {
    medical: { type: Number, default: 0 },
    family: { type: Number, default: 0 },
    damage: { type: Number, default: 0 },
    geographic: { type: Number, default: 0 },
    timeSinceAid: { type: Number, default: 0 },
    criticalNeeds: { type: Number, default: 0 }
  },
  
  // NEW: Medical conditions tracking
  medicalConditions: [{
    condition: {
      type: String,
      enum: [
        'chronic_illness',
        'disability',
        'pregnant',
        'elderly_care',
        'infant',
        'mental_health',
        'injury',
        'other'
      ]
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium'
    },
    description: String,
    diagnosedDate: Date
  }],
  
  // NEW: Geographic isolation indicators
  geographicFactors: {
    isRemote: {
      type: Boolean,
      default: false
    },
    distanceToNearestRoad: Number, // in km
    distanceToNearestHealthcare: Number, // in km
    accessibilityScore: {
      type: Number,
      min: 0,
      max: 10,
      default: 5 // 10 = very accessible, 0 = extremely remote
    }
  }
  
}, {
  timestamps: true
});

// ========================================
// INDEXES FOR PRIORITY QUERIES
// ========================================

BeneficiarySchema.index({ location: '2dsphere' });
BeneficiarySchema.index({ registrationDate: -1 });
BeneficiarySchema.index({ status: 1 });
BeneficiarySchema.index({ name: 'text', 'address.district': 'text' });

// NEW COMPOUND INDEXES
BeneficiarySchema.index({ vulnerabilityScore: -1, priorityLevel: 1 }); // Sort by score
BeneficiarySchema.index({ priorityLevel: 1, estimatedDelivery: 1 }); // Filter by priority + ETA
BeneficiarySchema.index({ status: 1, vulnerabilityScore: -1 }); // Active + sorted

// ========================================
// EXISTING METHODS (keep all)
// ========================================

BeneficiarySchema.methods.isEligibleForAid = function() {
  if (this.status !== 'active') return false;
  if (!this.aidReceived) return true;
  const daysSinceLastAid = (Date.now() - this.lastAidDate) / (1000 * 60 * 60 * 24);
  return daysSinceLastAid >= 7;
};

BeneficiarySchema.methods.recordAidReceived = function() {
  this.aidReceived = true;
  this.lastAidDate = new Date();
  this.aidCount += 1;
};

BeneficiarySchema.methods.getPriorityLevel = function() {
  const hasCritical = this.needs.some(need => need.priority === 'critical');
  if (hasCritical) return 'critical';
  
  const hasHigh = this.needs.some(need => need.priority === 'high');
  if (hasHigh) return 'high';
  
  const hasSevereLoss = this.losses.some(loss => 
    loss.type === 'death' || loss.type === 'home_destroyed'
  );
  if (hasSevereLoss) return 'critical';
  
  return 'medium';
};

// ========================================
// NEW METHODS: VULNERABILITY SCORING
// ========================================

/**
 * Calculate vulnerability score based on multiple factors
 * Returns object with score (0-100) and breakdown
 */
BeneficiarySchema.methods.calculateVulnerabilityScore = function() {
  let score = 0;
  const breakdown = {
    medical: 0,
    family: 0,
    damage: 0,
    geographic: 0,
    timeSinceAid: 0,
    criticalNeeds: 0
  };
  
  // ==================== MEDICAL CONDITIONS (0-50) ====================
  if (this.medicalConditions && this.medicalConditions.length > 0) {
    this.medicalConditions.forEach(condition => {
      if (condition.severity === 'critical') breakdown.medical += 20;
      else if (condition.severity === 'high') breakdown.medical += 10;
      else if (condition.severity === 'medium') breakdown.medical += 5;
      else breakdown.medical += 2;
    });
    breakdown.medical = Math.min(breakdown.medical, 50); // Cap at 50
  }
  
  // ==================== FAMILY COMPOSITION (0-25) ====================
  // Large families, elderly, children
  if (this.familySize >= 8) breakdown.family += 15;
  else if (this.familySize >= 5) breakdown.family += 10;
  else if (this.familySize >= 3) breakdown.family += 5;
  
  if (this.age >= 65) breakdown.family += 5; // Elderly
  if (this.age <= 5) breakdown.family += 5; // Young child
  
  if (this.dependents >= 4) breakdown.family += 5;
  else if (this.dependents >= 2) breakdown.family += 3;
  
  breakdown.family = Math.min(breakdown.family, 25);
  
  // ==================== DAMAGE SEVERITY (0-40) ====================
  if (this.losses && this.losses.length > 0) {
    this.losses.forEach(loss => {
      if (loss.type === 'death') breakdown.damage += 20;
      else if (loss.type === 'home_destroyed') breakdown.damage += 15;
      else if (loss.type === 'missing_person') breakdown.damage += 15;
      else if (loss.type === 'home_damaged') breakdown.damage += 10;
      else if (loss.type === 'livelihood_lost') breakdown.damage += 8;
      else breakdown.damage += 5;
    });
    breakdown.damage = Math.min(breakdown.damage, 40);
  }
  
  // ==================== GEOGRAPHIC ISOLATION (0-25) ====================
  if (this.geographicFactors) {
    if (this.geographicFactors.isRemote) breakdown.geographic += 10;
    
    if (this.geographicFactors.accessibilityScore !== undefined) {
      // Lower accessibility = higher score
      const accessScore = 10 - this.geographicFactors.accessibilityScore;
      breakdown.geographic += Math.min(accessScore * 1.5, 15);
    }
  }
  breakdown.geographic = Math.min(breakdown.geographic, 25);
  
  // ==================== TIME SINCE LAST AID (0-30) ====================
  if (this.lastAidDate) {
    const daysSince = (Date.now() - this.lastAidDate) / (1000 * 60 * 60 * 24);
    if (daysSince >= 30) breakdown.timeSinceAid = 30;
    else if (daysSince >= 21) breakdown.timeSinceAid = 25;
    else if (daysSince >= 14) breakdown.timeSinceAid = 20;
    else if (daysSince >= 7) breakdown.timeSinceAid = 10;
  } else {
    // Never received aid
    breakdown.timeSinceAid = 25;
  }
  
  // ==================== CRITICAL NEEDS BOOST (0-90) ====================
  if (this.needs && this.needs.length > 0) {
    const criticalCount = this.needs.filter(n => n.priority === 'critical').length;
    const highCount = this.needs.filter(n => n.priority === 'high').length;
    
    breakdown.criticalNeeds += criticalCount * 30; // +30 per critical need
    breakdown.criticalNeeds += highCount * 15; // +15 per high need
    breakdown.criticalNeeds = Math.min(breakdown.criticalNeeds, 90);
  }
  
  // ==================== TOTAL SCORE (CAP AT 100) ====================
  score = breakdown.medical + breakdown.family + breakdown.damage + 
          breakdown.geographic + breakdown.timeSinceAid + breakdown.criticalNeeds;
  score = Math.min(score, 100);
  
  return {
    score: Math.round(score),
    breakdown
  };
};

/**
 * Map score to priority level and color
 */
BeneficiarySchema.methods.getPriorityFromScore = function(score) {
  if (score >= 80) return { level: 'CRITICAL', color: 'red', eta: 6 }; // 6 hours
  if (score >= 60) return { level: 'HIGH', color: 'orange', eta: 24 }; // 24 hours
  if (score >= 30) return { level: 'MEDIUM', color: 'yellow', eta: 48 }; // 48 hours
  return { level: 'LOW', color: 'green', eta: 72 }; // 72 hours
};

/**
 * Update vulnerability score and related fields
 */
BeneficiarySchema.methods.updateVulnerabilityScore = async function() {
  const { score, breakdown } = this.calculateVulnerabilityScore();
  const priority = this.getPriorityFromScore(score);
  
  const previousPriority = this.priorityLevel;
  
  this.vulnerabilityScore = score;
  this.priorityLevel = priority.level;
  this.priorityColor = priority.color;
  this.scoreBreakdown = breakdown;
  this.lastScoreUpdate = new Date();
  
  // Calculate ETA based on priority
  this.estimatedDelivery = new Date(Date.now() + priority.eta * 60 * 60 * 1000);
  
  await this.save();
  
  // Return escalation flag
  const escalated = previousPriority !== priority.level && 
                   ['LOW', 'MEDIUM'].includes(previousPriority) &&
                   ['HIGH', 'CRITICAL'].includes(priority.level);
  
  return {
    score,
    previousPriority,
    newPriority: priority.level,
    escalated
  };
};

// ========================================
// STATIC METHODS FOR BULK OPERATIONS
// ========================================

/**
 * Update scores for all active beneficiaries (for cron job)
 */
BeneficiarySchema.statics.updateAllVulnerabilityScores = async function() {
  const beneficiaries = await this.find({ status: 'active' });
  
  const results = {
    updated: 0,
    escalated: [],
    errors: []
  };
  
  for (const ben of beneficiaries) {
    try {
      const result = await ben.updateVulnerabilityScore();
      results.updated++;
      
      if (result.escalated) {
        results.escalated.push({
          id: ben._id,
          name: ben.name,
          from: result.previousPriority,
          to: result.newPriority,
          score: result.score
        });
      }
    } catch (err) {
      results.errors.push({
        id: ben._id,
        error: err.message
      });
    }
  }
  
  return results;
};

/**
 * Get priority statistics
 */
BeneficiarySchema.statics.getPriorityStats = async function() {
  const stats = await this.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$priorityLevel',
        count: { $sum: 1 },
        avgScore: { $avg: '$vulnerabilityScore' }
      }
    }
  ]);
  
  return stats;
};

module.exports = mongoose.model('Beneficiary', BeneficiarySchema);