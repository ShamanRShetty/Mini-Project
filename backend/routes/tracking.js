/**
 * Delivery Tracking Routes
 * 
 * API endpoints for live delivery tracking
 */

const express = require('express');
const router = express.Router();
const DeliveryTracking = require('../models/DeliveryTracking');
const Beneficiary = require('../models/Beneficiary');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const axios = require('axios');

/**
 * @route   POST /api/tracking/create
 * @desc    Create new delivery tracking
 * @access  Private (ngo, admin)
 */
router.post('/create', protect, authorize('ngo', 'admin'), async (req, res) => {
  try {
    const {
      beneficiaryId,
      driverId,
      items,
      origin,
      scheduledDelivery,
      priority
    } = req.body;
    
    // Get beneficiary
    const beneficiary = await Beneficiary.findById(beneficiaryId);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found'
      });
    }
    
    if (!beneficiary.location?.coordinates || beneficiary.location.coordinates[0] === 0) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary location not available'
      });
    }
    
    // Generate tracking ID
    const trackingId = DeliveryTracking.generateTrackingId();
    
    // Calculate route using Mapbox (if API key available)
    let totalDistance = 0;
    let estimatedDuration = 0;
    let plannedRoute = null;
    
    if (process.env.MAPBOX_API_KEY && origin?.coordinates) {
      try {
        const [originLng, originLat] = origin.coordinates;
        const [destLng, destLat] = beneficiary.location.coordinates;
        
        const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}`;
        
        const routeResponse = await axios.get(mapboxUrl, {
          params: {
            access_token: process.env.MAPBOX_API_KEY,
            geometries: 'geojson',
            overview: 'full'
          }
        });
        
        if (routeResponse.data.routes && routeResponse.data.routes.length > 0) {
          const route = routeResponse.data.routes[0];
          totalDistance = route.distance / 1000; // Convert to km
          estimatedDuration = route.duration / 60; // Convert to minutes
          plannedRoute = route.geometry;
        }
      } catch (err) {
        console.error('Mapbox routing error:', err.message);
      }
    }
    
    // Fallback distance calculation
    if (totalDistance === 0 && origin?.coordinates) {
      const tracking = new DeliveryTracking();
      totalDistance = tracking.calculateDistance(
        origin.coordinates,
        beneficiary.location.coordinates
      );
      estimatedDuration = (totalDistance / 40) * 60; // Assume 40 km/h average
    }
    
    // Calculate ETA
    const eta = scheduledDelivery || new Date(Date.now() + estimatedDuration * 60 * 1000);
    
    // Create tracking record
    const tracking = await DeliveryTracking.create({
      trackingId,
      beneficiary: beneficiaryId,
      driver: driverId,
      items,
      origin: {
        type: 'Point',
        coordinates: origin?.coordinates || [78.9629, 20.5937],
        address: origin?.address || 'Distribution Center'
      },
      destination: {
        type: 'Point',
        coordinates: beneficiary.location.coordinates,
        address: beneficiary.address?.village || 'Beneficiary Location'
      },
      totalDistance,
      distanceRemaining: totalDistance,
      estimatedDuration,
      eta,
      scheduledDelivery: eta,
      priority: priority || beneficiary.priorityLevel || 'MEDIUM',
      currentLocation: {
        type: 'Point',
        coordinates: origin?.coordinates || [78.9629, 20.5937]
      },
      plannedRoute: plannedRoute || undefined
    });
    
    res.status(201).json({
      success: true,
      message: 'Tracking created successfully',
      tracking: tracking.getPublicTrackingInfo()
    });
  } catch (err) {
    console.error('Create tracking error:', err);
    res.status(500).json({
      success: false,
      message: 'Error creating tracking',
      error: err.message
    });
  }
});

/**
 * @route   GET /api/tracking/:trackingId
 * @desc    Get tracking details (PUBLIC - no auth required)
 * @access  Public
 */
router.get('/:trackingId', async (req, res) => {
  try {
    const tracking = await DeliveryTracking.findOne({ 
      trackingId: req.params.trackingId 
    })
    .populate('beneficiary', 'name address')
    .populate('driver', 'name phone');
    
    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'Tracking not found'
      });
    }
    
    res.json({
      success: true,
      tracking: tracking.getPublicTrackingInfo()
    });
  } catch (err) {
    console.error('Get tracking error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching tracking',
      error: err.message
    });
  }
});

/**
 * @route   PUT /api/tracking/:trackingId/status
 * @desc    Update delivery status
 * @access  Private (driver, ngo, admin)
 */
router.put('/:trackingId/status', protect, async (req, res) => {
  try {
    const { status, notes, location } = req.body;
    
    const tracking = await DeliveryTracking.findOne({ 
      trackingId: req.params.trackingId 
    });
    
    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'Tracking not found'
      });
    }
    
    await tracking.updateStatus(status, location, notes, req.user.id);
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(`tracking-${tracking.trackingId}`).emit('status-changed', {
      trackingId: tracking.trackingId,
      status,
      timestamp: new Date(),
      notes
    });
    
    res.json({
      success: true,
      message: 'Status updated successfully',
      tracking: tracking.getPublicTrackingInfo()
    });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
      error: err.message
    });
  }
});

/**
 * @route   POST /api/tracking/:trackingId/complete
 * @desc    Complete delivery with proof
 * @access  Private (driver)
 */
router.post('/:trackingId/complete', protect, async (req, res) => {
  try {
    const { photo, signature, receivedBy, relationship, location } = req.body;
    
    const tracking = await DeliveryTracking.findOne({ 
      trackingId: req.params.trackingId 
    });
    
    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'Tracking not found'
      });
    }
    
    const proofData = {
      photo,
      signature,
      receivedBy,
      relationship,
      location: location ? {
        type: 'Point',
        coordinates: location
      } : undefined
    };
    
    await tracking.completeDelivery(proofData, req.user.id);
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(`tracking-${tracking.trackingId}`).emit('delivery-completed', {
      trackingId: tracking.trackingId,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Delivery completed successfully',
      tracking: tracking.getPublicTrackingInfo()
    });
  } catch (err) {
    console.error('Complete delivery error:', err);
    res.status(500).json({
      success: false,
      message: 'Error completing delivery',
      error: err.message
    });
  }
});

/**
 * @route   GET /api/tracking/driver/:driverId/active
 * @desc    Get active deliveries for a driver
 * @access  Private
 */
router.get('/driver/:driverId/active', protect, async (req, res) => {
  try {
    const deliveries = await DeliveryTracking.getActiveDeliveriesForDriver(
      req.params.driverId
    );
    
    res.json({
      success: true,
      count: deliveries.length,
      deliveries
    });
  } catch (err) {
    console.error('Get driver deliveries error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching deliveries',
      error: err.message
    });
  }
});

/**
 * @route   GET /api/tracking/status/:status
 * @desc    Get deliveries by status
 * @access  Private (ngo, admin)
 */
router.get('/status/:status', protect, authorize('ngo', 'admin'), async (req, res) => {
  try {
    const deliveries = await DeliveryTracking.getByStatus(req.params.status);
    
    res.json({
      success: true,
      status: req.params.status,
      count: deliveries.length,
      deliveries
    });
  } catch (err) {
    console.error('Get by status error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching deliveries',
      error: err.message
    });
  }
});

module.exports = router;