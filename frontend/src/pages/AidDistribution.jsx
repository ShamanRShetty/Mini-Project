/**
 * Aid Distribution Page
 * 
 * Allows distributing aid to beneficiaries with:
 * - Beneficiary search/selection
 * - Biometric verification
 * - Item selection
 * - Distribution logging
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { beneficiaryAPI, aidAPI, logisticsAPI } from '../utils/api';
import { queueAidDistribution } from '../utils/indexedDB';
import SyncButton from '../components/SyncButton';
import {
  Search, User, Package, CheckCircle, AlertCircle,
  Plus, Minus, Camera, Loader, Send
} from 'lucide-react';

const AidDistribution = () => {
  const { isOnline } = useAuth();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Selected beneficiary
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [verified, setVerified] = useState(false);
  
  // Resources
  const [resources, setResources] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  
  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  
  // Load resources on mount
  useEffect(() => {
    loadResources();
  }, []);
  
  const loadResources = async () => {
    try {
      const response = await logisticsAPI.getResources({ status: 'available' });
      setResources(response.data.resources || []);
    } catch (err) {
      console.error('Error loading resources:', err);
    }
  };
  
  // Search beneficiaries
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    setError(null);
    
    try {
      const response = await beneficiaryAPI.getAll({ search: searchQuery, limit: 10 });
      setSearchResults(response.data.beneficiaries || []);
    } catch (err) {
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  };
  
  // Select beneficiary
  const selectBeneficiary = (beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setSearchResults([]);
    setSearchQuery('');
    setVerified(false);
    setSelectedItems([]);
  };
  
  // Verify (placeholder - just simulates verification)
  const verifyBeneficiary = () => {
    setVerified(true);
  };
  
  // Add item
  const addItem = (resource) => {
    const existing = selectedItems.find(i => i.resourceId === resource._id);
    if (existing) {
      setSelectedItems(prev => prev.map(i => 
        i.resourceId === resource._id 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      setSelectedItems(prev => [...prev, {
        resourceId: resource._id,
        itemType: resource.type,
        itemName: resource.name,
        quantity: 1,
        unit: resource.unit,
        estimatedValue: resource.unitValue
      }]);
    }
  };
  
  // Update item quantity
  const updateQuantity = (resourceId, delta) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.resourceId === resourceId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };
  
  // Submit distribution
  const handleSubmit = async () => {
    if (!selectedBeneficiary || selectedItems.length === 0) return;
    
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const distributionData = {
        beneficiaryId: selectedBeneficiary._id,
        items: selectedItems,
        verificationMethod: verified ? 'manual' : 'none',
        distributionSite: 'Field Distribution',
        notes: ''
      };
      
      if (isOnline) {
        const response = await aidAPI.distribute(distributionData);
        setSuccess(`Aid distributed! Ledger hash: ${response.data.ledgerHash?.substring(0, 16)}...`);
      } else {
        await queueAidDistribution(distributionData);
        setSuccess('Distribution queued for sync');
      }
      
      // Reset
      setSelectedBeneficiary(null);
      setSelectedItems([]);
      setVerified(false);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Distribution failed');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aid Distribution</h1>
          <p className="text-gray-600">Distribute aid to verified beneficiaries</p>
        </div>
        <SyncButton />
      </div>
      
      {/* Messages */}
      {success && (
        <div className="alert-success mb-6 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          {success}
        </div>
      )}
      {error && (
        <div className="alert-error mb-6 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Beneficiary Selection */}
        <div className="space-y-6">
          {/* Search */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Find Beneficiary</h3>
            <div className="flex space-x-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name or ID..."
                className="input flex-1"
              />
              <button onClick={handleSearch} disabled={searching} className="btn-primary">
                {searching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map(b => (
                  <div
                    key={b._id}
                    onClick={() => selectBeneficiary(b)}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <div className="font-medium">{b.name}</div>
                    <div className="text-sm text-gray-500">{b.nationalId} • {b.address?.district}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Selected Beneficiary */}
          {selectedBeneficiary && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-primary-600" />
                Selected Beneficiary
              </h3>
              
              <div className="space-y-2">
                <p><strong>Name:</strong> {selectedBeneficiary.name}</p>
                <p><strong>ID:</strong> {selectedBeneficiary.nationalId || 'N/A'}</p>
                <p><strong>Family Size:</strong> {selectedBeneficiary.familySize}</p>
                <p><strong>District:</strong> {selectedBeneficiary.address?.district || 'N/A'}</p>
                <p><strong>Aid Count:</strong> {selectedBeneficiary.aidCount || 0}</p>
              </div>
              
              {/* Verification */}
              <div className="mt-4 pt-4 border-t">
                {verified ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Verified
                  </div>
                ) : (
                  <button onClick={verifyBeneficiary} className="btn-secondary">
                    <Camera className="w-4 h-4 mr-2" />
                    Verify Identity
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Right: Item Selection */}
        <div className="space-y-6">
          {/* Available Resources */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2 text-primary-600" />
              Available Resources
            </h3>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {resources.map(resource => (
                <div
                  key={resource._id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{resource.name}</div>
                    <div className="text-sm text-gray-500">
                      {resource.availableQuantity} {resource.unit} available
                    </div>
                  </div>
                  <button
                    onClick={() => addItem(resource)}
                    disabled={!selectedBeneficiary}
                    className="btn-primary text-sm"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Selected Items */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Selected Items</h3>
            
            {selectedItems.length === 0 ? (
              <p className="text-gray-500">No items selected</p>
            ) : (
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div
                    key={item.resourceId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-sm text-gray-500">
                        ${(item.estimatedValue * item.quantity).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(item.resourceId, -1)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.resourceId, 1)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Submit */}
            {selectedItems.length > 0 && selectedBeneficiary && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-success w-full mt-4"
              >
                {submitting ? (
                  <Loader className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Send className="w-5 h-5 mr-2" />
                )}
                {submitting ? 'Processing...' : 'Distribute Aid'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AidDistribution;