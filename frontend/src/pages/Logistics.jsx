/*
  WHAT THIS FILE DOES:
  - Displays logistics management page with supply matching
  - Allows selecting MULTIPLE beneficiaries from a list
  - Shows a Mapbox map with optimized route connecting selected beneficiaries
  - Uses Mapbox Directions API to calculate the best route
  
  REQUIREMENTS:
  - You need a Mapbox Access Token (free tier available)
  - Add VITE_MAPBOX_TOKEN to your .env file in frontend folder
*/

import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set your Mapbox token here - get free token at https://www.mapbox.com/
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN_HERE';

const Logistics = () => {
  // State for beneficiaries list
  const [beneficiaries, setBeneficiaries] = useState([]);
  // State for selected beneficiaries (array of IDs)
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState([]);
  // State for supplies
  const [supplies, setSupplies] = useState([]);
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Route information
  const [routeInfo, setRouteInfo] = useState(null);
  const [generatingRoute, setGeneratingRoute] = useState(false);
  
  // Map references
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);

  // Fetch beneficiaries and supplies on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Initialize map when component mounts
    // Initialize map ONLY when container is ready
  useEffect(() => {
    if (!mapContainer.current) return; // ← Critical guard
    if (map.current) return;           // Prevent double init

    map.current = new mapboxgl.Map({
      container: mapContainer.current, // Now guaranteed to be a DOM element
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [78.9629, 20.5937],
      zoom: 4
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Optional: Wait for map to load before allowing interactions
    map.current.on('load', () => {
      // You can trigger something here if needed
    });

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Empty dependency array is fine

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch beneficiaries
      const benResponse = await fetch('http://localhost:5000/api/beneficiaries', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (benResponse.ok) {
        const benData = await benResponse.json();
        // Filter beneficiaries with valid coordinates
        const withCoords = benData.filter(b => 
          b.location?.coordinates?.lat && b.location?.coordinates?.lng
        );
        setBeneficiaries(withCoords);
      }

      // Fetch supplies
      const supplyResponse = await fetch('http://localhost:5000/api/supplies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (supplyResponse.ok) {
        const supplyData = await supplyResponse.json();
        setSupplies(supplyData);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again.');
      setLoading(false);
    }
  };

  // Handle checkbox selection for beneficiaries
  const handleSelectBeneficiary = (beneficiaryId) => {
    setSelectedBeneficiaries(prev => {
      if (prev.includes(beneficiaryId)) {
        // Remove if already selected
        return prev.filter(id => id !== beneficiaryId);
      } else {
        // Add if not selected
        return [...prev, beneficiaryId];
      }
    });
  };

  // Select all beneficiaries
  const handleSelectAll = () => {
    if (selectedBeneficiaries.length === beneficiaries.length) {
      setSelectedBeneficiaries([]);
    } else {
      setSelectedBeneficiaries(beneficiaries.map(b => b._id));
    }
  };

  // Clear all markers and routes from map
  const clearMap = () => {
    // Remove all markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Remove route layer and source if they exist
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }
  };

  // Generate optimized route using Mapbox Directions API
  const generateRoute = async () => {
    if (selectedBeneficiaries.length < 2) {
      alert('Please select at least 2 beneficiaries to generate a route');
      return;
    }

    setGeneratingRoute(true);
    setRouteInfo(null);
    clearMap();

    try {
      // Get selected beneficiaries with their coordinates
      const selected = beneficiaries.filter(b => 
        selectedBeneficiaries.includes(b._id)
      );

      // Build coordinates string for Mapbox API
      // Format: lng,lat;lng,lat;lng,lat
      const coordinates = selected.map(b => 
        `${b.location.coordinates.lng},${b.location.coordinates.lat}`
      ).join(';');

      // Call Mapbox Directions API with optimization
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` +
        `geometries=geojson&overview=full&steps=true&access_token=${mapboxgl.accessToken}`
      );

      if (!response.ok) {
        throw new Error('Failed to get route from Mapbox');
      }

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        // Add route line to map
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          }
        });

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 5,
            'line-opacity': 0.75
          }
        });

        // Add markers for each beneficiary
        selected.forEach((ben, index) => {
          // Create custom marker element
          const el = document.createElement('div');
          el.className = 'custom-marker';
          el.style.cssText = `
            background-color: ${index === 0 ? '#22c55e' : index === selected.length - 1 ? '#ef4444' : '#3b82f6'};
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          `;
          el.textContent = index + 1;

          // Create popup
          const popup = new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div style="padding: 8px;">
                <strong>${ben.name}</strong><br/>
                <span style="color: #666;">${ben.location?.village || 'Unknown'}</span><br/>
                <span style="font-size: 12px;">Stop #${index + 1}</span>
              </div>
            `);

          // Add marker to map
          const marker = new mapboxgl.Marker(el)
            .setLngLat([ben.location.coordinates.lng, ben.location.coordinates.lat])
            .setPopup(popup)
            .addTo(map.current);

          markersRef.current.push(marker);
        });

        // Fit map to show entire route
        const bounds = new mapboxgl.LngLatBounds();
        selected.forEach(ben => {
          bounds.extend([ben.location.coordinates.lng, ben.location.coordinates.lat]);
        });
        map.current.fitBounds(bounds, { padding: 50 });

        // Set route info
        setRouteInfo({
          distance: (route.distance / 1000).toFixed(2), // Convert to km
          duration: Math.round(route.duration / 60), // Convert to minutes
          stops: selected.length
        });
      }
    } catch (err) {
      console.error('Error generating route:', err);
      alert('Failed to generate route. Please check your Mapbox token and try again.');
    } finally {
      setGeneratingRoute(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg">Loading logistics data...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Logistics Management</h1>
          <p className="text-gray-600 mt-2">
            Select beneficiaries and generate optimized delivery routes
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Beneficiary Selection */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Select Beneficiaries
              </h2>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                {selectedBeneficiaries.length} selected
              </span>
            </div>

            {/* Select All Checkbox */}
            <div className="mb-4 pb-3 border-b">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedBeneficiaries.length === beneficiaries.length && beneficiaries.length > 0}
                  onChange={handleSelectAll}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="ml-3 font-medium text-gray-700">Select All</span>
              </label>
            </div>

            {/* Beneficiaries List */}
            <div className="max-h-96 overflow-y-auto space-y-2">
              {beneficiaries.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No beneficiaries with location data found.
                </p>
              ) : (
                beneficiaries.map((ben, index) => (
                  <label
                    key={ben._id}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                      selectedBeneficiaries.includes(ben._id)
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedBeneficiaries.includes(ben._id)}
                      onChange={() => handleSelectBeneficiary(ben._id)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="ml-3 flex-1">
                      <p className="font-medium text-gray-800">{ben.name}</p>
                      <p className="text-sm text-gray-500">
                        {ben.location?.village || 'Unknown location'}
                        {ben.location?.district && `, ${ben.location.district}`}
                      </p>
                    </div>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                  </label>
                ))
              )}
            </div>

            {/* Generate Route Button */}
            <div className="mt-6">
              <button
                onClick={generateRoute}
                disabled={selectedBeneficiaries.length < 2 || generatingRoute}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                  selectedBeneficiaries.length < 2 || generatingRoute
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
                }`}
              >
                {generatingRoute ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Generating Route...
                  </span>
                ) : (
                  `🗺️ Generate Route (${selectedBeneficiaries.length} stops)`
                )}
              </button>
              {selectedBeneficiaries.length < 2 && (
                <p className="text-sm text-gray-500 text-center mt-2">
                  Select at least 2 beneficiaries to generate a route
                </p>
              )}
            </div>
          </div>

          {/* Right Panel - Map */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
            {/* Route Info Bar */}
            {routeInfo && (
              <div className="bg-blue-600 text-white p-4 flex justify-around">
                <div className="text-center">
                  <p className="text-2xl font-bold">{routeInfo.stops}</p>
                  <p className="text-sm opacity-90">Stops</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{routeInfo.distance} km</p>
                  <p className="text-sm opacity-90">Total Distance</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{routeInfo.duration} min</p>
                  <p className="text-sm opacity-90">Est. Duration</p>
                </div>
              </div>
            )}

            {/* Map Container */}
            <div ref={mapContainer} className="flex-1" />

            {/* Map Legend */}
            <div className="p-4 bg-gray-50 border-t">
              <div className="p-4 bg-gray-50 border-t">
              <div className="flex space-x-4 text-sm">
                <span className="flex items-center">
                  <span className="w-4 h-4 rounded-full bg-green-500 mr-2"></span>
                  Start Point
                </span>
                <span className="flex items-center">
                  <span className="w-4 h-4 rounded-full bg-blue-500 mr-2"></span>
                  Waypoint
                </span>
                <span className="flex items-center">
                  <span className="w-4 h-4 rounded-full bg-red-500 mr-2"></span>
                  End Point
                </span>
              </div>
            </div>
          </div>
        </div>
        </div>


        {/* Supply Matching Section */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Available Supplies for Distribution
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {supplies.length === 0 ? (
              <p className="text-gray-500 col-span-full text-center py-4">
                No supplies available.
              </p>
            ) : (
              supplies.map(supply => (
                <div 
                  key={supply._id} 
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <h3 className="font-semibold text-gray-800">{supply.name}</h3>
                  <p className="text-sm text-gray-500">{supply.category}</p>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-lg font-bold text-blue-600">
                      {supply.quantity} units
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      supply.quantity > 100 
                        ? 'bg-green-100 text-green-800' 
                        : supply.quantity > 20 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {supply.quantity > 100 ? 'In Stock' : supply.quantity > 20 ? 'Low' : 'Critical'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Logistics;