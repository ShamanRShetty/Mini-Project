/**
 * Logistics Controller
 * 
 * Handles supply matching and route optimization.
 * 
 * Functions:
 * - matchSupplies: Match beneficiary needs with available resources
 * - generateRoute: Generate optimized delivery route using Mapbox
 * - getInventory: Get current inventory status
 * - allocateResources: Allocate resources to beneficiaries
 */

const Beneficiary = require('../models/Beneficiary');
const Resource = require('../models/Resource');
const axios = require('axios');

/**
 * @route   POST /api/logistics/match
 * @desc    Match beneficiary needs with available resources
 * @access  Private
 */
exports.matchSupplies = async (req, res) => {
  try {
    const { district, priority, needType } = req.query;

    // Build beneficiary query
    const beneficiaryQuery = {
      status: 'active',
      needs: { $exists: true, $ne: [] }
    };

    if (district) beneficiaryQuery['address.district'] = district;
    if (needType) beneficiaryQuery['needs.type'] = needType;

    // Get beneficiaries with needs
    const beneficiaries = await Beneficiary.find(beneficiaryQuery)
      .sort({ 'needs.priority': -1 })
      .limit(100);

    // Aggregate needs
    const aggregatedNeeds = {};
    
    beneficiaries.forEach(beneficiary => {
      beneficiary.needs.forEach(need => {
        const key = need.type;
        if (!aggregatedNeeds[key]) {
          aggregatedNeeds[key] = {
            type: key,
            totalQuantity: 0,
            beneficiaries: [],
            criticalCount: 0,
            highCount: 0
          };
        }
        
        aggregatedNeeds[key].totalQuantity += need.quantity || 1;
        aggregatedNeeds[key].beneficiaries.push({
          id: beneficiary._id,
          name: beneficiary.name,
          quantity: need.quantity || 1,
          priority: need.priority
        });

        if (need.priority === 'critical') aggregatedNeeds[key].criticalCount++;
        if (need.priority === 'high') aggregatedNeeds[key].highCount++;
      });
    });

    // Get available resources
    const matches = [];

    for (const [needType, needData] of Object.entries(aggregatedNeeds)) {
      const availableResources = await Resource.find({
        type: needType,
        status: { $in: ['available', 'reserved'] }
      }).sort({ priority: -1, expiryDate: 1 });

      const totalAvailable = availableResources.reduce(
        (sum, r) => sum + r.availableQuantity,
        0
      );

      matches.push({
        needType,
        totalNeeded: needData.totalQuantity,
        totalAvailable,
        gap: needData.totalQuantity - totalAvailable,
        criticalBeneficiaries: needData.criticalCount,
        highPriorityBeneficiaries: needData.highCount,
        resources: availableResources.map(r => ({
          id: r._id,
          name: r.name,
          available: r.availableQuantity,
          location: r.storageLocation
        })),
        beneficiaries: needData.beneficiaries,
        canFulfill: totalAvailable >= needData.totalQuantity
      });
    }

    // Sort by criticality
    matches.sort((a, b) => {
      if (b.criticalBeneficiaries !== a.criticalBeneficiaries) {
        return b.criticalBeneficiaries - a.criticalBeneficiaries;
      }
      return b.gap - a.gap;
    });

    res.json({
      success: true,
      totalBeneficiaries: beneficiaries.length,
      matches
    });

  } catch (error) {
    console.error('Match supplies error:', error);
    res.status(500).json({
      success: false,
      message: 'Error matching supplies',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/logistics/route
 * @desc    Generate optimized delivery route
 * @access  Private
 */
exports.generateRoute = async (req, res) => {
  try {
    const { beneficiaryIds, startLocation } = req.body;

    if (!beneficiaryIds || beneficiaryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary IDs are required'
      });
    }

    // Get beneficiaries with locations
    const beneficiaries = await Beneficiary.find({
      _id: { $in: beneficiaryIds },
      location: { $exists: true }
    });

    if (beneficiaries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No beneficiaries with valid locations found'
      });
    }

    // Extract coordinates
    const coordinates = beneficiaries.map(b => ({
      longitude: b.location.coordinates[0],
      latitude: b.location.coordinates[1],
      beneficiary: {
        id: b._id,
        name: b.name,
        address: b.address
      }
    }));

    // Add start location if provided
    if (startLocation?.longitude && startLocation?.latitude) {
      coordinates.unshift({
        longitude: startLocation.longitude,
        latitude: startLocation.latitude,
        beneficiary: { name: 'Start Location' }
      });
    }

    // Use Mapbox Directions API if API key is available
    let route = null;
    
    if (process.env.MAPBOX_API_KEY && coordinates.length > 1) {
      try {
        // Format coordinates for Mapbox (max 25 waypoints)
        const waypointsLimit = Math.min(coordinates.length, 25);
        const waypoints = coordinates.slice(0, waypointsLimit);
        
        const coordinatesString = waypoints
          .map(c => `${c.longitude},${c.latitude}`)
          .join(';');

        const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}`;
        
        const response = await axios.get(mapboxUrl, {
          params: {
            access_token: process.env.MAPBOX_API_KEY,
            geometries: 'geojson',
            overview: 'full',
            steps: true
          }
        });

        if (response.data.routes && response.data.routes.length > 0) {
          const mapboxRoute = response.data.routes[0];
          
          route = {
            distance: mapboxRoute.distance, // meters
            duration: mapboxRoute.duration, // seconds
            geometry: mapboxRoute.geometry,
            legs: mapboxRoute.legs
          };
        }

      } catch (mapboxError) {
        console.error('Mapbox API error:', mapboxError.message);
        // Continue with simple route if Mapbox fails
      }
    }

    // If no Mapbox route, create simple sequential route
    if (!route) {
      // Calculate simple distance (straight line between points)
      let totalDistance = 0;
      for (let i = 1; i < coordinates.length; i++) {
        const dist = calculateDistance(
          coordinates[i - 1].latitude,
          coordinates[i - 1].longitude,
          coordinates[i].latitude,
          coordinates[i].longitude
        );
        totalDistance += dist;
      }

      route = {
        distance: totalDistance * 1000, // convert km to meters
        duration: (totalDistance / 40) * 3600, // assume 40 km/h, convert to seconds
        geometry: {
          type: 'LineString',
          coordinates: coordinates.map(c => [c.longitude, c.latitude])
        },
        note: 'Simple route (Mapbox not available)'
      };
    }

    res.json({
      success: true,
      waypoints: coordinates,
      route,
      summary: {
        totalDistance: `${(route.distance / 1000).toFixed(2)} km`,
        estimatedDuration: `${Math.round(route.duration / 60)} minutes`,
        numberOfStops: coordinates.length
      }
    });

  } catch (error) {
    console.error('Generate route error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating route',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/logistics/inventory
 * @desc    Get inventory summary
 * @access  Private
 */
exports.getInventory = async (req, res) => {
  try {
    // Get inventory summary by type
    const summary = await Resource.getInventorySummary();

    // Get low stock items
    const lowStock = await Resource.find({
      $expr: {
        $lte: [
          { $subtract: ['$quantity', { $add: ['$reservedQuantity', '$distributedQuantity'] }] },
          '$minimumStock'
        ]
      },
      status: { $ne: 'depleted' }
    }).limit(20);

    // Get expiring soon items (next 30 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    const expiringSoon = await Resource.find({
      expiryDate: {
        $gte: new Date(),
        $lte: expiryDate
      }
    }).sort({ expiryDate: 1 });

    res.json({
      success: true,
      summary,
      lowStock,
      expiringSoon
    });

  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/logistics/allocate
 * @desc    Allocate resources to beneficiaries
 * @access  Private
 */
exports.allocateResources = async (req, res) => {
  try {
    const { resourceId, beneficiaryIds, quantityPerBeneficiary } = req.body;

    if (!resourceId || !beneficiaryIds || !quantityPerBeneficiary) {
      return res.status(400).json({
        success: false,
        message: 'Resource ID, beneficiary IDs, and quantity are required'
      });
    }

    // Get resource
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }

    // Calculate total needed
    const totalNeeded = beneficiaryIds.length * quantityPerBeneficiary;

    // Check availability
    if (resource.availableQuantity < totalNeeded) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient quantity available',
        available: resource.availableQuantity,
        needed: totalNeeded
      });
    }

    // Reserve the quantity
    await resource.reserve(totalNeeded);

    // Create allocation record
    const allocation = {
      resourceId: resource._id,
      resourceName: resource.name,
      beneficiaries: beneficiaryIds,
      quantityPerBeneficiary,
      totalQuantity: totalNeeded,
      allocatedBy: req.user.id,
      allocatedAt: new Date(),
      status: 'reserved'
    };

    res.json({
      success: true,
      message: 'Resources allocated successfully',
      allocation
    });

  } catch (error) {
    console.error('Allocate resources error:', error);
    res.status(500).json({
      success: false,
      message: 'Error allocating resources',
      error: error.message
    });
  }
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = exports;