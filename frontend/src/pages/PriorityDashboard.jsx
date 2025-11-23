/**
 * Priority Dashboard Page
 * 
 * Features:
 * - Color-coded priority counters (Red/Orange/Yellow/Green)
 * - Live map with colored pins based on vulnerability
 * - Countdown timers for deliveries
 * - Real-time alerts for escalations
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle, Clock, MapPin, Users, TrendingUp,
  RefreshCw, Filter, Download, Bell
} from 'lucide-react';

// Set Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN';

const PriorityDashboard = () => {
  const { token } = useAuth();
  
  // State
  const [dashboard, setDashboard] = useState(null);
  const [mapData, setMapData] = useState([]);
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Map ref
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  
  // Load dashboard data
  useEffect(() => {
    loadDashboard();
    
    // Auto-refresh every 30 seconds
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadDashboard, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);
  
  // Load map data when priority filter changes
  useEffect(() => {
    loadMapData();
  }, [selectedPriority]);
  
  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [78.9629, 20.5937], // India center
      zoom: 4
    });
    
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Update map markers when data changes
  useEffect(() => {
    if (!map.current || !mapData.length) return;
    
    updateMapMarkers();
  }, [mapData]);
  
  const loadDashboard = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/priority/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load dashboard');
      
      const data = await response.json();
      setDashboard(data);
      setError(null);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const loadMapData = async () => {
    try {
      const url = selectedPriority
        ? `http://localhost:5000/api/priority/map-data?priorityLevel=${selectedPriority}`
        : 'http://localhost:5000/api/priority/map-data';
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load map data');
      
      const data = await response.json();
      setMapData(data.beneficiaries || []);
    } catch (err) {
      console.error('Map data error:', err);
    }
  };
  
  const updateMapMarkers = () => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    // Add new markers
    mapData.forEach(ben => {
      if (!ben.location?.coordinates || ben.location.coordinates[0] === 0) return;
      
      const [lng, lat] = ben.location.coordinates;
      
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: ${getColorForPriority(ben.priorityColor)};
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      
      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div style="padding: 8px;">
            <strong>${ben.name}</strong><br/>
            <span style="color: ${getColorForPriority(ben.priorityColor)};">
              ${ben.priorityLevel} Priority
            </span><br/>
            <span style="font-size: 12px;">Score: ${ben.vulnerabilityScore}/100</span><br/>
            <span style="font-size: 12px;">ETA: ${formatETA(ben.estimatedDelivery)}</span>
          </div>
        `);
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current);
      
      markersRef.current.push(marker);
    });
    
    // Fit map to markers
    if (mapData.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      mapData.forEach(ben => {
        if (ben.location?.coordinates && ben.location.coordinates[0] !== 0) {
          bounds.extend(ben.location.coordinates);
        }
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 10 });
    }
  };
  
  const getColorForPriority = (color) => {
    const colors = {
      red: '#ef4444',
      orange: '#f97316',
      yellow: '#eab308',
      green: '#22c55e'
    };
    return colors[color] || '#6b7280';
  };
  
  const formatETA = (date) => {
    if (!date) return 'Unknown';
    const eta = new Date(date);
    const now = new Date();
    
    if (eta < now) return '⚠️ OVERDUE';
    
    return formatDistanceToNow(eta, { addSuffix: true });
  };
  
  const formatCountdown = (date) => {
    if (!date) return '--:--:--';
    const eta = new Date(date);
    const now = new Date();
    const diff = eta - now;
    
    if (diff < 0) return 'OVERDUE';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  };
  
  const triggerManualUpdate = async () => {
    try {
      setLoading(true);
      await fetch('http://localhost:5000/api/priority/update-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setTimeout(() => {
        loadDashboard();
        loadMapData();
      }, 2000);
    } catch (err) {
      console.error('Manual update error:', err);
    }
  };
  
  if (loading && !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }
  
  const dist = dashboard?.distribution?.distribution || {};
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <AlertTriangle className="w-8 h-8 mr-3 text-red-500" />
            Priority Dashboard
          </h1>
          <p className="text-gray-600">Vulnerability-based aid prioritization</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh (30s)
          </label>
          
          <button onClick={loadDashboard} className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          
          <button onClick={triggerManualUpdate} className="btn-primary">
            <TrendingUp className="w-4 h-4 mr-2" />
            Recalculate All
          </button>
        </div>
      </div>
      
      {error && (
        <div className="alert-error mb-6">{error}</div>
      )}
      
      {/* Priority Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { level: 'CRITICAL', color: 'red', data: dist.CRITICAL },
          { level: 'HIGH', color: 'orange', data: dist.HIGH },
          { level: 'MEDIUM', color: 'yellow', data: dist.MEDIUM },
          { level: 'LOW', color: 'green', data: dist.LOW }
        ].map(({ level, color, data }) => (
          <button
            key={level}
            onClick={() => setSelectedPriority(selectedPriority === level ? null : level)}
            className={`card text-center transition-all cursor-pointer ${
              selectedPriority === level ? 'ring-4 ring-blue-500' : ''
            }`}
            style={{
              borderLeft: `6px solid ${getColorForPriority(color)}`
            }}
          >
            <div
              className="text-4xl font-bold mb-2"
              style={{ color: getColorForPriority(color) }}
            >
              {data?.count || 0}
            </div>
            <div className="text-sm font-medium text-gray-700">{level}</div>
            <div className="text-xs text-gray-500 mt-1">
              Avg Score: {data?.avgScore || 0}
            </div>
          </button>
        ))}
      </div>
      
      {/* Overdue Alert */}
      {dashboard?.overdue > 0 && (
        <div className="alert-error mb-6 flex items-center">
          <Bell className="w-5 h-5 mr-2 animate-pulse" />
          <strong>{dashboard.overdue}</strong> deliveries are overdue!
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Priority Map {selectedPriority && `- ${selectedPriority}`}
            </h3>
            <span className="text-sm text-gray-500">
              {mapData.length} beneficiaries
            </span>
          </div>
          
          <div ref={mapContainer} className="w-full h-96 rounded-lg" />
          
          {/* Legend */}
          <div className="flex items-center justify-center space-x-4 mt-4 text-sm">
            {['red', 'orange', 'yellow', 'green'].map(color => (
              <span key={color} className="flex items-center">
                <span
                  className="w-4 h-4 rounded-full mr-1"
                  style={{ backgroundColor: getColorForPriority(color) }}
                />
                {color.charAt(0).toUpperCase() + color.slice(1)}
              </span>
            ))}
          </div>
        </div>
        
        {/* Urgent Cases */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-red-500" />
            Urgent Cases
          </h3>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {dashboard?.urgent?.length > 0 ? (
              dashboard.urgent.map(ben => (
                <div
                  key={ben._id}
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: `${getColorForPriority(ben.priorityColor)}15`,
                    borderLeft: `4px solid ${getColorForPriority(ben.priorityColor)}`
                  }}
                >
                  <div className="font-medium">{ben.name}</div>
                  <div className="text-sm text-gray-600">
                    Score: {ben.vulnerabilityScore}/100
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    ETA: {formatETA(ben.estimatedDelivery)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No urgent cases</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Recent Escalations */}
      {dashboard?.recentEscalations?.length > 0 && (
        <div className="card mt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-orange-500" />
            Recent Priority Escalations (Last 24h)
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3">Beneficiary</th>
                  <th className="pb-3">Score</th>
                  <th className="pb-3">Priority</th>
                  <th className="pb-3">ETA</th>
                  <th className="pb-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentEscalations.map(ben => (
                  <tr key={ben._id} className="border-b border-gray-100">
                    <td className="py-3">{ben.name}</td>
                    <td className="py-3">
                      <span className="font-bold">{ben.vulnerabilityScore}</span>/100
                    </td>
                    <td className="py-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: getColorForPriority(ben.priorityColor) }}
                      >
                        {ben.priorityLevel}
                      </span>
                    </td>
                    <td className="py-3">{formatETA(ben.estimatedDelivery)}</td>
                    <td className="py-3 text-sm text-gray-500">
                      {formatDistanceToNow(new Date(ben.lastScoreUpdate), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriorityDashboard;