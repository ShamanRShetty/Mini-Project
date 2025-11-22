/**
 * SyncQueue Model
 * 
 * Temporary storage for data synced from offline devices.
 * Acts as a staging area before processing into main collections.
 * 
 * How sync works:
 * 1. Field worker creates data offline (stored in browser)
 * 2. When online, data is sent to /api/sync endpoint
 * 3. Server stores it in SyncQueue (this model)
 * 4. Background job processes queue and creates real records
 * 5. Prevents duplicates using offlineId and device fingerprints
 */

const mongoose = require('mongoose');

const SyncQueueSchema = new mongoose.Schema({
  // ========================================
  // IDENTIFICATION
  // ========================================
  
  // Unique ID from offline device (prevents duplicates)
  offlineId: {
    type: String,
    required: true,
  },
  
  // What type of record is this?
  recordType: {
    type: String,
    enum: ['beneficiary', 'aid_log', 'loss', 'resource', 'other'],
    required: true,
  },
  
  // The actual data to be synced (stored as JSON)
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // ========================================
  // DEVICE & USER INFO
  // ========================================
  
  // Who sent this data
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,    
  },
  
  // Device identifier (browser fingerprint, device ID, etc.)
  deviceId: {
    type: String,
  },
  
  // Device info
  deviceInfo: {
    userAgent: String,
    platform: String,
    appVersion: String
  },
  
  // ========================================
  // SYNC METADATA
  // ========================================
  
  // When was this record created offline?
  createdOfflineAt: {
    type: Date,
    required: true
  },
  
  // When did we receive it on server?
  receivedAt: {
    type: Date,
    default: Date.now,    
  },
  
  // Processing status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'duplicate'],
    default: 'pending',    
  },
  
  // Priority (higher = process first)
  priority: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  
  // Number of processing attempts
  attempts: {
    type: Number,
    default: 0
  },
  
  // Maximum attempts before marking as failed
  maxAttempts: {
    type: Number,
    default: 3
  },
  
  // ========================================
  // PROCESSING RESULTS
  // ========================================
  
  // When processing started
  processedAt: Date,
  
  // How long processing took (milliseconds)
  processingTime: Number,
  
  // ID of created record (after successful processing)
  createdRecordId: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Result message
  resultMessage: String,
  
  // Error details if failed
  error: {
    message: String,
    stack: String,
    code: String
  },
  
  // ========================================
  // DEDUPLICATION
  // ========================================
  
  // Hash of payload (for detecting exact duplicates)
  payloadHash: {
    type: String,    
  },
  
  // If duplicate, reference to original
  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SyncQueue'
  },
  
  // ========================================
  // CONFLICT RESOLUTION
  // ========================================
  
  // If conflict detected with existing data
  hasConflict: {
    type: Boolean,
    default: false
  },
  
  conflictDetails: {
    conflictType: String, // 'data_mismatch', 'already_exists', etc.
    existingRecordId: mongoose.Schema.Types.ObjectId,
    resolution: String, // 'manual', 'auto_merge', 'skip', etc.
    resolvedBy: mongoose.Schema.Types.ObjectId,
    resolvedAt: Date
  },
  
  // ========================================
  // BATCH PROCESSING
  // ========================================
  
  // Batch ID (for processing multiple items together)
  batchId: {
    type: String,  
  },
  
  batchSize: Number,
  batchPosition: Number,
  
  // ========================================
  // RETRY & EXPIRY
  // ========================================
  
  // Next retry time (for failed items)
  nextRetryAt: Date,
  
  // Expiry time (delete old completed/failed items)
  expiresAt: {
    type: Date,
  }
  
}, {
  timestamps: true
});

// ========================================
// INDEXES
// ========================================

// Compound indexes for common queries
SyncQueueSchema.index({ userId: 1, status: 1 });
SyncQueueSchema.index({ status: 1, priority: -1, receivedAt: 1 });
SyncQueueSchema.index({ offlineId: 1, recordType: 1 }, { unique: true }); // Prevent duplicate offlineId + type
SyncQueueSchema.index({ batchId: 1, batchPosition: 1 });

// TTL index - automatically delete old records after 30 days
SyncQueueSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ========================================
// MIDDLEWARE
// ========================================

/**
 * Set expiry date before saving
 */
SyncQueueSchema.pre('save', function(next) {
  // Set expiry based on status
  if (!this.expiresAt) {
    const now = new Date();
    
    if (this.status === 'completed') {
      // Keep completed items for 30 days
      this.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (this.status === 'failed') {
      // Keep failed items for 7 days
      this.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      // Keep pending items for 2 days (should process much faster)
      this.expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    }
  }
  
  next();
});

// ========================================
// METHODS
// ========================================

/**
 * Mark as processing
 */
SyncQueueSchema.methods.startProcessing = async function() {
  this.status = 'processing';
  this.processedAt = new Date();
  this.attempts += 1;
  return await this.save();
};

/**
 * Mark as completed
 */
SyncQueueSchema.methods.markCompleted = async function(createdRecordId, message) {
  const startTime = this.processedAt?.getTime() || Date.now();
  this.status = 'completed';
  this.createdRecordId = createdRecordId;
  this.resultMessage = message || 'Processed successfully';
  this.processingTime = Date.now() - startTime;
  return await this.save();
};

/**
 * Mark as failed
 */
SyncQueueSchema.methods.markFailed = async function(error) {
  const startTime = this.processedAt?.getTime() || Date.now();
  this.status = 'failed';
  this.error = {
    message: error.message,
    stack: error.stack,
    code: error.code
  };
  this.processingTime = Date.now() - startTime;
  
  // Schedule retry if under max attempts
  if (this.attempts < this.maxAttempts) {
    // Exponential backoff: 1min, 5min, 30min
    const backoffMinutes = Math.pow(5, this.attempts);
    this.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
    this.status = 'pending'; // Back to pending for retry
  }
  
  return await this.save();
};

/**
 * Mark as duplicate
 */
SyncQueueSchema.methods.markDuplicate = async function(originalId) {
  this.status = 'duplicate';
  this.duplicateOf = originalId;
  this.resultMessage = 'Duplicate record detected';
  return await this.save();
};

// ========================================
// STATICS
// ========================================

/**
 * Get pending items to process
 */
SyncQueueSchema.statics.getPendingBatch = async function(limit = 100) {
  return await this.find({
    status: 'pending',
    $or: [
      { nextRetryAt: { $exists: false } },
      { nextRetryAt: { $lte: new Date() } }
    ]
  })
  .sort({ priority: -1, receivedAt: 1 })
  .limit(limit);
};

/**
 * Check if offlineId already exists
 */
SyncQueueSchema.statics.isDuplicate = async function(offlineId, recordType) {
  const existing = await this.findOne({
    offlineId,
    recordType,
    status: { $in: ['completed', 'processing'] }
  });
  return !!existing;
};

/**
 * Get sync statistics
 */
SyncQueueSchema.statics.getStatistics = async function(userId = null) {
  const match = userId ? { userId } : {};
  
  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);
};

/**
 * Clean up old records (manual cleanup, also handled by TTL)
 */
SyncQueueSchema.statics.cleanup = async function(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  return await this.deleteMany({
    status: { $in: ['completed', 'failed'] },
    updatedAt: { $lt: cutoffDate }
  });
};

/**
 * Get failed items for manual review
 */
SyncQueueSchema.statics.getFailedItems = async function(limit = 50) {
  return await this.find({
    status: 'failed',
    attempts: { $gte: this.maxAttempts }
  })
  .populate('userId', 'name email')
  .sort({ receivedAt: -1 })
  .limit(limit);
};

/**
 * Retry failed items
 */
SyncQueueSchema.statics.retryFailed = async function(itemIds) {
  return await this.updateMany(
    {
      _id: { $in: itemIds },
      status: 'failed'
    },
    {
      $set: {
        status: 'pending',
        attempts: 0,
        nextRetryAt: new Date(),
        error: null
      }
    }
  );
};

module.exports = mongoose.model('SyncQueue', SyncQueueSchema);