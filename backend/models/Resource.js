/**
 * Resource Model
 * 
 * Tracks available supplies for disaster relief.
 * Includes inventory management and allocation tracking.
 */

const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
  // ========================================
  // BASIC INFORMATION
  // ========================================
  
  name: {
    type: String,
    required: [true, 'Resource name is required'],
    trim: true
  },
  
  type: {
    type: String,
    enum: ['food', 'water', 'shelter', 'medicine', 'clothing', 'hygiene', 'equipment', 'cash', 'other'],
    required: [true, 'Resource type is required']
  },
  
  subType: String, // e.g., "Dry Food", "Bottled Water", "Antibiotics"
  
  description: String,
  
  // ========================================
  // INVENTORY TRACKING
  // ========================================
  
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },
  
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    default: 'pieces'
    // Examples: kg, liters, pieces, boxes, cartons
  },
  
  // Quantity reserved for planned distributions
  reservedQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Reserved quantity cannot be negative']
  },
  
  // Quantity already distributed
  distributedQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Distributed quantity cannot be negative']
  },
  
  // Available = Total - Reserved - Distributed
  // We'll calculate this dynamically
  
  // Minimum stock level (alert when below this)
  minimumStock: {
    type: Number,
    default: 0
  },
  
  // ========================================
  // VALUATION
  // ========================================
  
  unitValue: {
    type: Number,
    default: 0,
    min: [0, 'Unit value cannot be negative']
  },
  
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Total value = quantity * unitValue
  totalValue: {
    type: Number,
    default: 0
  },
  
  // ========================================
  // STORAGE & LOCATION
  // ========================================
  
  storageLocation: {
    warehouseId: String,
    warehouseName: String,
    section: String,
    shelf: String
  },
  
  // GPS coordinates of storage location
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number] // [longitude, latitude]
  },
  
  // ========================================
  // DONOR & SOURCE
  // ========================================
  
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  donorName: String, // If donor not in system
  
  donationBatch: String, // Batch/shipment identifier
  
  donationDate: {
    type: Date,
    default: Date.now
  },
  
  // ========================================
  // LIFECYCLE TRACKING
  // ========================================
  
  receivedDate: {
    type: Date,
    default: Date.now
  },
  
  expiryDate: Date, // Important for food, medicine
  
  // Condition of resource
  condition: {
    type: String,
    enum: ['new', 'good', 'fair', 'damaged', 'expired'],
    default: 'new'
  },
  
  // ========================================
  // STATUS & ALLOCATION
  // ========================================
  
  status: {
    type: String,
    enum: ['available', 'reserved', 'in_transit', 'distributed', 'depleted', 'damaged'],
    default: 'available'
  },
  
  // Priority level for distribution
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  
  // ========================================
  // TRACKING & METADATA
  // ========================================
  
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  notes: String,
  
  // Images of the resource
  images: [String], // Array of image paths
  
  // Tags for searching
  tags: [String]
  
}, {
  timestamps: true
});

// ========================================
// VIRTUAL FIELDS (calculated properties)
// ========================================

/**
 * Calculate available quantity
 * Available = Total - Reserved - Distributed
 */
ResourceSchema.virtual('availableQuantity').get(function() {
  return Math.max(0, this.quantity - this.reservedQuantity - this.distributedQuantity);
});

/**
 * Check if stock is low
 */
ResourceSchema.virtual('isLowStock').get(function() {
  return this.availableQuantity <= this.minimumStock;
});

/**
 * Check if expired
 */
ResourceSchema.virtual('isExpired').get(function() {
  if (!this.expiryDate) return false;
  return new Date(this.expiryDate) < new Date();
});

// Make sure virtuals are included when converting to JSON
ResourceSchema.set('toJSON', { virtuals: true });
ResourceSchema.set('toObject', { virtuals: true });

// ========================================
// INDEXES
// ========================================

ResourceSchema.index({ type: 1, status: 1 });
ResourceSchema.index({ donor: 1 });
ResourceSchema.index({ expiryDate: 1 });
ResourceSchema.index({ status: 1, priority: -1 });
ResourceSchema.index({ location: '2dsphere' });

// Text search index
ResourceSchema.index({ name: 'text', description: 'text', tags: 'text' });

// ========================================
// MIDDLEWARE
// ========================================

/**
 * Update total value before saving
 */
ResourceSchema.pre('save', function(next) {
  this.totalValue = this.quantity * this.unitValue;
  
  // Update status based on quantity
  if (this.availableQuantity === 0) {
    this.status = 'depleted';
  } else if (this.status === 'depleted' && this.availableQuantity > 0) {
    this.status = 'available';
  }
  
  // Check expiry
  if (this.isExpired && this.condition !== 'expired') {
    this.condition = 'expired';
    this.status = 'damaged';
  }
  
  next();
});

// ========================================
// METHODS
// ========================================

/**
 * Reserve quantity for distribution
 */
ResourceSchema.methods.reserve = async function(quantity) {
  if (quantity > this.availableQuantity) {
    throw new Error('Insufficient available quantity');
  }
  
  this.reservedQuantity += quantity;
  this.status = 'reserved';
  return await this.save();
};

/**
 * Release reserved quantity
 */
ResourceSchema.methods.releaseReservation = async function(quantity) {
  this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
  
  if (this.reservedQuantity === 0 && this.availableQuantity > 0) {
    this.status = 'available';
  }
  
  return await this.save();
};

/**
 * Record distribution
 */
ResourceSchema.methods.recordDistribution = async function(quantity) {
  if (quantity > this.availableQuantity + this.reservedQuantity) {
    throw new Error('Insufficient quantity for distribution');
  }
  
  // Deduct from reserved first, then from available
  if (this.reservedQuantity >= quantity) {
    this.reservedQuantity -= quantity;
  } else {
    const remaining = quantity - this.reservedQuantity;
    this.reservedQuantity = 0;
    this.quantity -= remaining;
  }
  
  this.distributedQuantity += quantity;
  this.status = this.availableQuantity === 0 ? 'depleted' : 'distributed';
  
  return await this.save();
};

/**
 * Add stock (receiving new supplies)
 */
ResourceSchema.methods.addStock = async function(quantity, unitValue) {
  this.quantity += quantity;
  
  if (unitValue !== undefined) {
    // Weighted average unit value
    const totalValue = (this.quantity - quantity) * this.unitValue + quantity * unitValue;
    this.unitValue = totalValue / this.quantity;
  }
  
  this.status = 'available';
  return await this.save();
};

// ========================================
// STATICS
// ========================================

/**
 * Get inventory summary by type
 */
ResourceSchema.statics.getInventorySummary = async function() {
  return await this.aggregate([
    {
      $match: { status: { $ne: 'depleted' } }
    },
    {
      $group: {
        _id: '$type',
        totalQuantity: { $sum: '$quantity' },
        availableQuantity: { 
          $sum: { 
            $subtract: [
              '$quantity',
              { $add: ['$reservedQuantity', '$distributedQuantity'] }
            ]
          }
        },
        totalValue: { $sum: '$totalValue' },
        itemCount: { $sum: 1 },
        lowStockItems: {
          $sum: {
            $cond: [
              { $lte: [
                { $subtract: ['$quantity', { $add: ['$reservedQuantity', '$distributedQuantity'] }] },
                '$minimumStock'
              ]},
              1,
              0
            ]
          }
        }
      }
    },
    { $sort: { totalValue: -1 } }
  ]);
};

/**
 * Find resources matching needs
 */
ResourceSchema.statics.findMatchingResources = async function(needType, quantity) {
  return await this.find({
    type: needType,
    status: { $in: ['available', 'reserved'] },
    $expr: {
      $gte: [
        { $subtract: ['$quantity', { $add: ['$reservedQuantity', '$distributedQuantity'] }] },
        quantity
      ]
    }
  }).sort({ priority: -1, expiryDate: 1 });
};

module.exports = mongoose.model('Resource', ResourceSchema);