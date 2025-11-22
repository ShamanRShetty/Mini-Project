/**
 * Logistics Page
 * 
 * Supply matching and inventory management
 */

import React, { useState, useEffect } from 'react';
import { logisticsAPI } from '../utils/api';
import { Truck, Package, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';

const Logistics = () => {
  const [inventory, setInventory] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await logisticsAPI.getInventory();
      setInventory(response.data);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const runMatching = async () => {
    setMatching(true);
    try {
      const response = await logisticsAPI.match();
      setMatches(response.data.matches || []);
    } catch (err) {
      console.error('Error matching:', err);
    } finally {
      setMatching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logistics</h1>
          <p className="text-gray-600">Supply matching and inventory management</p>
        </div>
        <div className="flex space-x-4">
          <button onClick={runMatching} disabled={matching} className="btn-primary">
            {matching ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
            {matching ? 'Matching...' : 'Run Auto-Match'}
          </button>
          <button onClick={loadData} className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Inventory Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {inventory?.summary?.map((item, index) => (
          <div key={index} className="card">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold capitalize">{item._id}</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {item.availableQuantity?.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">units available</p>
              </div>
              <Package className="w-8 h-8 text-primary-600" />
            </div>
            {item.lowStockItems > 0 && (
              <div className="mt-3 flex items-center text-yellow-600 text-sm">
                <AlertTriangle className="w-4 h-4 mr-1" />
                {item.lowStockItems} low stock items
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Low Stock Alerts */}
      {inventory?.lowStock?.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
            Low Stock Alerts
          </h2>
          <div className="space-y-2">
            {inventory.lowStock.map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                <div>
                  <span className="font-medium">{item.name}</span>
                  <span className="text-sm text-gray-500 ml-2">({item.type})</span>
                </div>
                <div className="text-yellow-700">
                  {item.availableQuantity} / {item.minimumStock} min
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matching Results */}
      {matches.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Supply Matching Results</h2>
          <div className="space-y-4">
            {matches.map((match, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold capitalize">{match.needType}</h3>
                  {match.canFulfill ? (
                    <span className="badge-success flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Can Fulfill
                    </span>
                  ) : (
                    <span className="badge-danger">Gap: {match.gap}</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Needed:</span>
                    <span className="ml-2 font-medium">{match.totalNeeded}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Available:</span>
                    <span className="ml-2 font-medium">{match.totalAvailable}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Critical:</span>
                    <span className="ml-2 font-medium text-red-600">{match.criticalBeneficiaries}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Logistics;