/**
 * Live Tracking Page - Flipkart Style
 * 
 * Features:
 * - Live map with moving truck icon
 * - Real-time ETA updates via Socket.io
 * - Status timeline (Packed → In Transit → Delivered)
 * - Distance remaining + countdown timer
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatDistanceToNow } from 'date-fns';
import {
  Package, Truck, MapPin, Clock, CheckCircle, 
  AlertCircle, Navigation, Phone
} from 'lucide-react';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN';

const LiveTracking = () => {
  const { trackingId } = useParams();
  
  // State
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  
  // Map refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const truckMarker = useRef(null);
  const destMarker = useRef(null);
  
  // Socket ref
  const socket = useRef(null);
  
  // Status configuration
  const statusConfig = {
    PACKED: { icon: Package, color: 'blue', label: 'Packed', step: 1 },
    IN_TRANSIT: { icon: Truck, color: 'orange', label: 'In Transit', step: 2 },
    OUT_FOR_DELIVERY: { icon: Navigation, color: 'purple', label: 'Out for Delivery', step: 3 },
    DELIVERED: { icon: CheckCircle, color: 'green', label: 'Delivered', step: 4 },
    FAILED: { icon: AlertCircle, color: 'red', label: 'Failed', step: 4 }
  };
  
  // Load tracking data
  useEffect(() => {
    loadTracking();
  }, [trackingId]);
  
  // Initialize Socket.io
  useEffect(() => {
    if (!trackingId) return;
    
    socket.current = io('http://localhost:5000');
    
    socket.current.on('connect', () => {
      console.log('[Socket] Connected');
      setConnected(true);
      socket.current.emit('join-tracking', trackingId);
    });
    
    socket.current.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
    });
    
    // Listen for location updates
    socket.current.on('location-updated', (data) => {
      console.log('[Socket] Location updated:', data);
      setTracking(prev => ({
        ...prev,
        currentLocation: data.location,
        distanceRemaining: data.distanceRemaining,
        eta: data.eta
      }));
      
      if (truckMarker.current && data.location?.coordinates) {
        truckMarker.current.setLngLat(data.location.coordinates);
      }
    });
    
    // Listen for status changes
    socket.current.on('status-changed', (data) => {
      console.log('[Socket] Status changed:', data);
      setTracking(prev => ({
        ...prev,
        status: data.status
      }));
    });
    
    // Listen for delivery completion
    socket.current.on('delivery-completed', (data) => {
      console.log('[Socket] Delivery completed:', data);
      loadTracking(); // Reload full data
    });
    
    return () => {
      if (socket.current) {
        socket.current.emit('leave-tracking', trackingId);
        socket.current.disconnect();
      }
    };
  }, [trackingId]);
  
  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [78.9629, 20.5937],
      zoom: 12
    });
    
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Update map when tracking data changes
  useEffect(() => {
    if (!map.current || !tracking) return;
    
    updateMap();
  }, [tracking]);
  
  const loadTracking = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/tracking/${trackingId}`);
      
      if (!response.ok) {
        throw new Error('Tracking not found');
      }
      
      const data = await response.json();
      setTracking(data.tracking);
      setError(null);
    } catch (err) {
      console.error('Load tracking error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const updateMap = () => {
    if (!tracking) return;
    
    // Remove existing markers
    if (truckMarker.current) truckMarker.current.remove();
    if (destMarker.current) destMarker.current.remove();
    
    // Add truck marker (current location)
    if (tracking.currentLocation?.coordinates) {
      const truckEl = document.createElement('div');
      truckEl.innerHTML = '🚚';
      truckEl.style.fontSize = '32px';
      
      truckMarker.current = new mapboxgl.Marker(truckEl)
        .setLngLat(tracking.currentLocation.coordinates)
        .setPopup(new mapboxgl.Popup().setHTML('<strong>Current Location</strong>'))
        .addTo(map.current);
    }
    
    // Add destination marker
    if (tracking.destination?.coordinates) {
      const destEl = document.createElement('div');
      destEl.innerHTML = '📍';
      destEl.style.fontSize = '32px';
      
      destMarker.current = new mapboxgl.Marker(destEl)
        .setLngLat(tracking.destination.coordinates)
        .setPopup(new mapboxgl.Popup().setHTML('<strong>Destination</strong>'))
        .addTo(map.current);
    }
    
    // Fit map to show both markers
    if (tracking.currentLocation?.coordinates && tracking.destination?.coordinates) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(tracking.currentLocation.coordinates);
      bounds.extend(tracking.destination.coordinates);
      map.current.fitBounds(bounds, { padding: 100 });
    }
  };
  
  const formatETA = (eta) => {
    if (!eta) return 'Calculating...';
    const etaDate = new Date(eta);
    const now = new Date();
    
    if (etaDate < now) return 'Arriving soon';
    
    return formatDistanceToNow(etaDate, { addSuffix: true });
  };
  
  const getStatusColor = (status) => {
    return statusConfig[status]?.color || 'gray';
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Truck className="w-12 h-12 animate-bounce text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading tracking information...</p>
        </div>
      </div>
    );
  }
  
  if (error || !tracking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Tracking Not Found</h2>
          <p className="text-gray-600">{error || 'Invalid tracking ID'}</p>
        </div>
      </div>
    );
  }
  
  const currentStatus = statusConfig[tracking.status] || {};
  const StatusIcon = currentStatus.icon || Package;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                Track Your Delivery
              </h1>
              <p className="text-sm text-gray-500">
                Tracking ID: <span className="font-mono font-medium">{trackingId}</span>
              </p>
            </div>
            
            {connected && (
              <span className="flex items-center text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status & Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Current Status */}
            <div className="card">
              <div className="flex items-center space-x-3 mb-4">
                <div
                  className="p-3 rounded-full"
                  style={{ backgroundColor: `${getStatusColor(tracking.status)}20` }}
                >
                  <StatusIcon
                    className="w-6 h-6"
                    style={{ color: getStatusColor(tracking.status) }}
                  />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{currentStatus.label}</h3>
                  <p className="text-sm text-gray-500">
                    {tracking.lastUpdate && formatDistanceToNow(new Date(tracking.lastUpdate), { addSuffix: true })}
                  </p>
                </div>
              </div>
              
              {/* ETA & Distance */}
              {tracking.status !== 'DELIVERED' && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Estimated Arrival</span>
                    <span className="font-semibold text-blue-600">
                      {formatETA(tracking.eta)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Distance Remaining</span>
                    <span className="font-semibold">
                      {tracking.distanceRemaining?.toFixed(1) || '0'} km
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Status Timeline */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Delivery Timeline</h3>
              <div className="space-y-4">
                {Object.entries(statusConfig)
                  .filter(([key]) => key !== 'FAILED')
                  .map(([key, config]) => {
                    const historyItem = tracking.statusHistory?.find(h => h.status === key);
                    const isActive = tracking.status === key;
                    const isCompleted = currentStatus.step > config.step;
                    
                    return (
                      <div key={key} className="flex items-start space-x-3">
                        <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center ${
                          isCompleted || isActive
                            ? `bg-${config.color}-500 text-white`
                            : 'bg-gray-200 text-gray-400'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : isActive ? (
                            <config.icon className="w-4 h-4" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-current" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            isActive || isCompleted ? 'text-gray-800' : 'text-gray-400'
                          }`}>
                            {config.label}
                          </p>
                          {historyItem && (
                            <p className="text-xs text-gray-500">
                              {new Date(historyItem.timestamp).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            {/* Items */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Items</h3>
              <div className="space-y-2">
                {tracking.items?.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.itemName}</span>
                    <span className="font-medium">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="card h-full">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                Live Location
              </h3>
              <div ref={mapContainer} className="w-full h-[500px] rounded-lg" />
            </div>
          </div>
        </div>
        
        {/* Delivery Proof (if delivered) */}
        {tracking.status === 'DELIVERED' && tracking.deliveryProof && (
          <div className="card mt-6">
            <h3 className="font-semibold text-gray-800 mb-4">Delivery Confirmation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tracking.deliveryProof.photo && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Photo</p>
                  <img
                    src={tracking.deliveryProof.photo}
                    alt="Delivery"
                    className="rounded-lg border"
                  />
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Received By</p>
                  <p className="font-medium">{tracking.deliveryProof.receivedBy}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Delivered At</p>
                  <p className="font-medium">
                    {new Date(tracking.deliveryProof.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTracking;