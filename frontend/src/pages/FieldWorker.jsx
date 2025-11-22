/**
 * Field Worker Page
 * 
 * Allows field workers to register beneficiaries.
 * Works offline - data is saved to IndexedDB and synced later.
 * 
 * Features:
 * - Beneficiary registration form
 * - Face image capture (webcam)
 * - Geolocation capture
 * - Offline queue management
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../App';
import { beneficiaryAPI } from '../utils/api';
import { queueBeneficiary, getAllQueuedBeneficiaries, getSyncQueueStatus } from '../utils/indexedDB';
import SyncButton from '../components/SyncButton';
import {
  User, MapPin, Camera, Save, Plus, Trash2,
  CheckCircle, AlertCircle, Users, Home, Phone,
  Calendar, Heart, FileText, X, Loader
} from 'lucide-react';

const FieldWorker = () => {
  const { isOnline } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'prefer_not_to_say',
    nationalId: '',
    phone: '',
    familySize: 1,
    dependents: 0,
    village: '',
    district: '',
    region: '',
    needs: [],
    notes: ''
  });
  
  // Location state
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  
  // Face capture state
  const [faceImage, setFaceImage] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  // Queue state
  const [queuedRecords, setQueuedRecords] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  
  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Need types
  const needTypes = ['food', 'water', 'shelter', 'medicine', 'clothing', 'hygiene'];
  const priorities = ['critical', 'high', 'medium', 'low'];
  
  // Load queued records on mount
  useEffect(() => {
    loadQueuedRecords();
  }, []);
  
  const loadQueuedRecords = async () => {
    try {
      const records = await getAllQueuedBeneficiaries();
      setQueuedRecords(records);
      const status = await getSyncQueueStatus();
      setSyncStatus(status);
    } catch (err) {
      console.error('Error loading queue:', err);
    }
  };
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Add need
  const addNeed = () => {
    setFormData(prev => ({
      ...prev,
      needs: [...prev.needs, { type: 'food', priority: 'medium', quantity: 1, description: '' }]
    }));
  };
  
  // Remove need
  const removeNeed = (index) => {
    setFormData(prev => ({
      ...prev,
      needs: prev.needs.filter((_, i) => i !== index)
    }));
  };
  
  // Update need
  const updateNeed = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      needs: prev.needs.map((need, i) => 
        i === index ? { ...need, [field]: value } : need
      )
    }));
  };
  
  // Get current location
  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    
    setLocationLoading(true);
    setLocationError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setLocationLoading(false);
      },
      (error) => {
        setLocationError(error.message);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  
  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera');
    }
  };
  
  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setFaceImage(imageData);
    stopCamera();
  };
  
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };
  
  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Prepare beneficiary data
      const beneficiaryData = {
        ...formData,
        age: parseInt(formData.age) || null,
        familySize: parseInt(formData.familySize) || 1,
        dependents: parseInt(formData.dependents) || 0,
        address: {
          village: formData.village,
          district: formData.district,
          region: formData.region
        },
        latitude: location?.latitude,
        longitude: location?.longitude,
        biometric: faceImage ? { faceImageData: faceImage } : undefined
      };
      
      // Remove address fields from root
      delete beneficiaryData.village;
      delete beneficiaryData.district;
      delete beneficiaryData.region;
      
      if (isOnline) {
        // Online: Submit directly to server
        const response = await beneficiaryAPI.register(beneficiaryData);
        
        if (response.data.success) {
          setSuccess(true);
          resetForm();
        } else {
          setError(response.data.message || 'Failed to register');
        }
      } else {
        // Offline: Save to IndexedDB queue
        await queueBeneficiary(beneficiaryData);
        setSuccess(true);
        resetForm();
        await loadQueuedRecords();
      }
      
    } catch (err) {
      console.error('Submit error:', err);
      
      // If network error, queue offline
      if (!isOnline || err.offline || err.message === 'Network Error') {
        try {
          await queueBeneficiary({
            ...formData,
            latitude: location?.latitude,
            longitude: location?.longitude
          });
          setSuccess(true);
          resetForm();
          await loadQueuedRecords();
        } catch (queueErr) {
          setError('Failed to save offline');
        }
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to register');
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      age: '',
      gender: 'prefer_not_to_say',
      nationalId: '',
      phone: '',
      familySize: 1,
      dependents: 0,
      village: '',
      district: '',
      region: '',
      needs: [],
      notes: ''
    });
    setFaceImage(null);
    // Keep location
  };
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Register Beneficiary</h1>
          <p className="text-gray-600">
            {isOnline ? 'Online - data will be saved immediately' : 'Offline - data will sync when online'}
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <SyncButton onSyncComplete={loadQueuedRecords} />
        </div>
      </div>
      
      {/* Queue Status */}
      {syncStatus?.totalPending > 0 && (
        <div className="alert-warning mb-6 flex items-center justify-between">
          <span>
            <strong>{syncStatus.totalPending}</strong> beneficiaries waiting to sync
          </span>
        </div>
      )}
      
      {/* Success/Error Messages */}
      {success && (
        <div className="alert-success mb-6 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          Beneficiary {isOnline ? 'registered' : 'queued'} successfully!
        </div>
      )}
      
      {error && (
        <div className="alert-error mb-6 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}
      
      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-primary-600" />
            Personal Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="label">Age</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                className="input"
                min="0"
                max="150"
              />
            </div>
            
            <div>
              <label className="label">Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="input">
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="label">National ID</label>
              <input
                type="text"
                name="nationalId"
                value={formData.nationalId}
                onChange={handleChange}
                className="input"
              />
            </div>
            
            <div>
              <label className="label">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input"
              />
            </div>
            
            <div>
              <label className="label">Family Size</label>
              <input
                type="number"
                name="familySize"
                value={formData.familySize}
                onChange={handleChange}
                className="input"
                min="1"
              />
            </div>
          </div>
        </div>
        
        {/* Location */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-primary-600" />
            Location
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Village</label>
              <input type="text" name="village" value={formData.village} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="label">District</label>
              <input type="text" name="district" value={formData.district} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="label">Region</label>
              <input type="text" name="region" value={formData.region} onChange={handleChange} className="input" />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button type="button" onClick={getLocation} disabled={locationLoading} className="btn-secondary">
              {locationLoading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
              {locationLoading ? 'Getting Location...' : 'Get GPS Location'}
            </button>
            
            {location && (
              <span className="text-sm text-green-600">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Location captured ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
              </span>
            )}
            {locationError && <span className="text-sm text-red-600">{locationError}</span>}
          </div>
        </div>
        
        {/* Face Capture */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Camera className="w-5 h-5 mr-2 text-primary-600" />
            Face Image (Biometric)
          </h3>
          
          {showCamera ? (
            <div className="space-y-4">
              <video ref={videoRef} autoPlay playsInline className="w-full max-w-md mx-auto rounded-lg" />
              <div className="flex justify-center space-x-4">
                <button type="button" onClick={capturePhoto} className="btn-primary">
                  <Camera className="w-4 h-4 mr-2" />
                  Capture
                </button>
                <button type="button" onClick={stopCamera} className="btn-secondary">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </button>
              </div>
            </div>
          ) : faceImage ? (
            <div className="flex items-center space-x-4">
              <img src={faceImage} alt="Captured" className="w-32 h-32 rounded-lg object-cover" />
              <button type="button" onClick={() => setFaceImage(null)} className="btn-secondary">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </button>
            </div>
          ) : (
            <button type="button" onClick={startCamera} className="btn-secondary">
              <Camera className="w-4 h-4 mr-2" />
              Open Camera
            </button>
          )}
        </div>
        
        {/* Needs */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Heart className="w-5 h-5 mr-2 text-primary-600" />
              Needs Assessment
            </h3>
            <button type="button" onClick={addNeed} className="btn-secondary text-sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Need
            </button>
          </div>
          
          {formData.needs.map((need, index) => (
            <div key={index} className="flex items-center space-x-2 mb-3 p-3 bg-gray-50 rounded-lg">
              <select
                value={need.type}
                onChange={(e) => updateNeed(index, 'type', e.target.value)}
                className="input flex-1"
              >
                {needTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                value={need.priority}
                onChange={(e) => updateNeed(index, 'priority', e.target.value)}
                className="input w-32"
              >
                {priorities.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                type="number"
                value={need.quantity}
                onChange={(e) => updateNeed(index, 'quantity', parseInt(e.target.value))}
                className="input w-20"
                min="1"
              />
              <button type="button" onClick={() => removeNeed(index)} className="p-2 text-red-600 hover:bg-red-100 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          {formData.needs.length === 0 && (
            <p className="text-gray-500 text-sm">No needs added yet</p>
          )}
        </div>
        
        {/* Notes */}
        <div className="card">
          <label className="label">Additional Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="input"
            placeholder="Any additional information..."
          />
        </div>
        
        {/* Submit Button */}
        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="btn-primary px-8 py-3">
            {submitting ? (
              <>
                <Loader className="w-5 h-5 animate-spin mr-2" />
                {isOnline ? 'Registering...' : 'Saving Offline...'}
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {isOnline ? 'Register Beneficiary' : 'Save Offline'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FieldWorker;