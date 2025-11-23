/**
 * Delivery Tracking Model
 * 
 * Real-time tracking for aid deliveries
 * Similar to Flipkart/Amazon order tracking
 */

const mongoose = require('mongoose');

const DeliveryTrackingSchema = new mongoose.Schema({
  // ========================================
  // TRACKING IDENTIFICATION
  // ========================================
  
  trackingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // ========================================
  // RELATED ENTITIES
  // ========================================
  
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiary',
    required: true
  },
  
  aidLog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AidLog'
  },
  
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  vehicle: {
    type: String, // Vehicle registration number
    vehicleType: {
      type: String,
      enum: ['truck', 'van', 'bike', 'car'],
      default: 'van'
    }
  },
  
  // ========================================
  // STATUS TRACKING
  // ========================================
  
  status: {
    type: String,
    enum: ['PACKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED'],
    default: 'PACKED',
    required: true
  },
  
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number]
    },
    notes: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // ========================================
  // LOCATION TRACKING
  // ========================================
  
  // Starting point (warehouse/distribution center)
  origin: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true
    },
    address: String
  },
  
  // Destination (beneficiary location)
  destination: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true
    },
    address: String
  },
  
  // Current location of driver/vehicle (updated in real-time)
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  
  // Planned route (polyline from routing API)
  plannedRoute: {
    type: {
      type: String,
      enum: ['LineString'],
      default: 'LineString'
    },
    coordinates: [[Number]] // Array of [lng, lat] pairs
  },
  
  // Actual route taken (breadcrumb trail)
  actualRoute: [{
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number]
    },
    timestamp: Date,
    speed: Number, // km/h
    accuracy: Number // meters
  }],
  
  // ========================================
  // DISTANCE & TIME
  // ========================================
  
  totalDistance: {
    type: Number, // in kilometers
    default: 0
  },
  
  distanceRemaining: {
    type: Number, // in kilometers
    default: 0
  },
  
  estimatedDuration: {
    type: Number, // in minutes
    default: 0
  },
  
  eta: {
    type: Date
  },
  
  // ========================================
  // DELIVERY DETAILS
  // ========================================
  
  items: [{
    itemType: String,
    itemName: String,
    quantity: Number,
    unit: String
  }],
  
  // Proof of delivery
  deliveryProof: {
    photo: String, // Photo of delivered items
    signature: String, // Beneficiary signature (base64)
    receivedBy: String, // Name of person who received
    relationship: String, // Relationship to beneficiary
    timestamp: Date,
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number]
    }
  },
  
  // ========================================
  // TIMING
  // ========================================
  
  scheduledPickup: Date,
  actualPickup: Date,
  scheduledDelivery: Date,
  actualDelivery: Date,
  
  // ========================================
  // NOTIFICATIONS
  // ========================================
  
  notifications: [{
    type: {
      type: String,
      enum: ['SMS', 'EMAIL', 'PUSH'],
      required: true
    },
    recipient: String, // Phone or email
    message: String,
    sentAt: Date,
    status: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'FAILED']
    }
  }],
  
  // ========================================
  // FAILURE HANDLING
  // ========================================
  
  failureReason: String,
  failureNotes: String,
  rescheduledDate: Date,
  
  // ========================================
  // METADATA
  // ========================================
  
  priority: {
    type: String,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  
  notes: String,
  
  // Real-time tracking metadata
  lastLocationUpdate: Date,
  trackingActive: {
    type: Boolean,
    default: true
  }
  
}, {
  timestamps: true
});

// ========================================
// INDEXES
// ========================================

DeliveryTrackingSchema.index({ trackingId: 1 }, { unique: true });
DeliveryTrackingSchema.index({ beneficiary: 1 });
DeliveryTrackingSchema.index({ driver: 1, status: 1 });
DeliveryTrackingSchema.index({ status: 1, scheduledDelivery: 1 });
DeliveryTrackingSchema.index({ currentLocation: '2dsphere' });
DeliveryTrackingSchema.index({ origin: '2dsphere' });
DeliveryTrackingSchema.index({ destination: '2dsphere' });

// ========================================
// METHODS
// ========================================

/**
 * Generate unique tracking ID
 */
DeliveryTrackingSchema.statics.generateTrackingId = function() {
  const prefix = 'TRK';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Update delivery status
 */
DeliveryTrackingSchema.methods.updateStatus = async function(status, location, notes, updatedBy) {
  this.status = status;
  
  this.statusHistory.push({
    status,
    timestamp: new Date(),
    location: location ? {
      type: 'Point',
      coordinates: location
    } : undefined,
    notes,
    updatedBy
  });
  
  // Update timestamps based on status
  if (status === 'IN_TRANSIT' && !this.actualPickup) {
    this.actualPickup = new Date();
  }
  
  if (status === 'DELIVERED' && !this.actualDelivery) {
    this.actualDelivery = new Date();
    this.trackingActive = false;
  }
  
  await this.save();
  return this;
};

/**
 * Update current location (called frequently from driver app)
 */
DeliveryTrackingSchema.methods.updateLocation = async function(coordinates, speed, accuracy) {
  this.currentLocation = {
    type: 'Point',
    coordinates
  };
  
  this.lastLocationUpdate = new Date();
  
  // Add to breadcrumb trail
  this.actualRoute.push({
    location: {
      type: 'Point',
      coordinates
    },
    timestamp: new Date(),
    speed,
    accuracy
  });
  
  // Calculate distance remaining (using Haversine formula)
  if (this.destination?.coordinates) {
    this.distanceRemaining = this.calculateDistance(
      coordinates,
      this.destination.coordinates
    );
  }
  
  // Recalculate ETA based on current location and average speed
  if (speed && speed > 0) {
    const estimatedMinutes = (this.distanceRemaining / speed) * 60;
    this.eta = new Date(Date.now() + estimatedMinutes * 60 * 1000);
  }
  
  await this.save();
  return this;
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
DeliveryTrackingSchema.methods.calculateDistance = function(coord1, coord2) {
  const R = 6371; // Earth's radius in km
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  
  const toRad = (deg) => deg * (Math.PI / 180);
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

/**
 * Record delivery completion
 */
DeliveryTrackingSchema.methods.completeDelivery = async function(proofData, updatedBy) {
  this.deliveryProof = {
    ...proofData,
    timestamp: new Date()
  };
  
  await this.updateStatus('DELIVERED', proofData.location?.coordinates, 'Delivery completed', updatedBy);
  
  return this;
};

/**
 * Mark delivery as failed
 */
DeliveryTrackingSchema.methods.markFailed = async function(reason, notes, rescheduledDate, updatedBy) {
  this.failureReason = reason;
  this.failureNotes = notes;
  this.rescheduledDate = rescheduledDate;
  
  await this.updateStatus('FAILED', null, `Failed: ${reason}`, updatedBy);
  
  return this;
};

/**
 * Get public tracking info (for beneficiary/donor view)
 */
DeliveryTrackingSchema.methods.getPublicTrackingInfo = function() {
  return {
    trackingId: this.trackingId,
    status: this.status,
    currentLocation: this.currentLocation,
    destination: this.destination,
    eta: this.eta,
    distanceRemaining: this.distanceRemaining,
    items: this.items,
    statusHistory: this.statusHistory.map(h => ({
      status: h.status,
      timestamp: h.timestamp,
      notes: h.notes
    })),
    deliveryProof: this.deliveryProof,
    lastUpdate: this.lastLocationUpdate
  };
};

// ========================================
// STATICS
// ========================================

/**
 * Get active deliveries for a driver
 */
DeliveryTrackingSchema.statics.getActiveDeliveriesForDriver = async function(driverId) {
  return await this.find({
    driver: driverId,
    status: { $in: ['PACKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] }
  })
  .populate('beneficiary', 'name phone address location')
  .sort({ scheduledDelivery: 1 });
};

/**
 * Get deliveries by status
 */
DeliveryTrackingSchema.statics.getByStatus = async function(status, limit = 50) {
  return await this.find({ status })
    .populate('beneficiary', 'name phone address')
    .populate('driver', 'name phone')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('DeliveryTracking', DeliveryTrackingSchema);