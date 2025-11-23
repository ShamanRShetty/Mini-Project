/*
  WHAT THIS FILE DOES:
  - Beneficiary registration form with offline support
  - FIXED: Camera capture with live preview
  - FIXED: GPS location with reverse geocoding (village/district/region)
  - Saves to IndexedDB when offline, syncs when online
  
  FIXES APPLIED:
  1. Camera now shows live preview before capture
  2. GPS fetches and displays village, district, state, region
  3. Uses free Nominatim API for reverse geocoding
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { saveToOfflineQueue, getOfflineQueue } from '../utils/indexedDB';
import { useAuth } from '../App';  

const Register = () => {
  // Form data state
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'prefer_not_to_say',
    phone: '',
    idType: 'aadhaar',
    idNumber: '',
    familySize: '',
    needs: [],
    faceImage: '',
    location: {
      village: '',
      district: '',
      state: '',
      region: '',
      coordinates: { lat: null, lng: null }
    }
  });

  // Camera states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  // GPS states
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  
  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);

  // Refs for video and canvas
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Available needs options
  const needsOptions = [
    'Food', 'Water', 'Shelter', 'Medical', 'Clothing', 
    'Sanitation', 'Baby Supplies', 'Elderly Care'
  ];

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Get offline queue count
    getOfflineQueue().then(queue => setOfflineCount(queue.length));
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // ==================== CAMERA FUNCTIONS (FIXED) ====================
  
  const startCamera = async () => {
    setCameraError('');
    setCapturedImage(null);
    
    try {
      // Request camera permission with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' // Front camera for face capture
        },
        audio: false
      });
      
      // Store stream reference for cleanup
      setCameraStream(stream);
      
      
      // IMPORTANT: Wait for video element to be ready
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load metadata before playing
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(() => {
              setCameraActive(true);
              console.log('Camera started successfully');
            })
            .catch(err => {
              console.error('Error playing video:', err);
              setCameraError('Failed to start video preview');
            });
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      
      // Provide specific error messages based on error type
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (err.name === 'NotReadableError') {
        setCameraError('Camera is being used by another application.');
      } else {
        setCameraError(`Camera error: ${err.message}`);
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      setCameraError('Camera not ready');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw the current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to base64 image
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Update states
    setCapturedImage(imageData);
    setFormData(prev => ({ ...prev, faceImage: imageData }));
    
    // Stop the camera after capture
    stopCamera();
    
    console.log('Photo captured successfully');
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setFormData(prev => ({ ...prev, faceImage: '' }));
    startCamera();
  };

  // ==================== GPS FUNCTIONS (FIXED) ====================
  
  const getLocation = () => {
    setGpsLoading(true);
    setGpsError('');

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        console.log('GPS coordinates:', latitude, longitude);
        
        // Update coordinates immediately
        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            coordinates: { lat: latitude, lng: longitude }
          }
        }));

        // Reverse geocode to get address details
        try {
          await reverseGeocode(latitude, longitude);
        } catch (err) {
          console.error('Reverse geocoding failed:', err);
          setGpsError('Got coordinates but could not fetch address details');
        }
        
        setGpsLoading(false);
      },
      (error) => {
        console.error('GPS error:', error);
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Location permission denied. Please enable location access.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Location information unavailable.');
            break;
          case error.TIMEOUT:
            setGpsError('Location request timed out. Please try again.');
            break;
          default:
            setGpsError('An unknown error occurred.');
        }
        
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Reverse geocoding using free Nominatim API
  const reverseGeocode = async (lat, lng) => {
    try {
      // Using OpenStreetMap's Nominatim API (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'ResilienceHub-DisasterRelief/1.0' // Required by Nominatim
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding API request failed');
      }

      const data = await response.json();
      console.log('Geocoding response:', data);

      if (data && data.address) {
        const address = data.address;
        
        // Extract location details from response
        // Nominatim returns different fields based on location
        const village = address.village || address.hamlet || address.town || 
                       address.city || address.suburb || address.neighbourhood || '';
        
        const district = address.county || address.state_district || 
                        address.district || address.city_district || '';
        
        const state = address.state || address.province || '';
        
        const region = address.region || address.country || '';

        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            village: village,
            district: district,
            state: state,
            region: region
          }
        }));

        console.log('Location parsed:', { village, district, state, region });
      } else {
        throw new Error('No address data in response');
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err);
      
      // Try backup API (BigDataCloud - also free)
      try {
        const backupResponse = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
        );
        
        if (backupResponse.ok) {
          const backupData = await backupResponse.json();
          console.log('Backup geocoding response:', backupData);
          
          setFormData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              village: backupData.locality || backupData.city || '',
              district: backupData.localityInfo?.administrative?.[2]?.name || '',
              state: backupData.principalSubdivision || '',
              region: backupData.countryName || ''
            }
          }));
        }
      } catch (backupErr) {
        console.error('Backup geocoding also failed:', backupErr);
        throw err;
      }
    }
  };

  // ==================== FORM HANDLERS ====================
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNeedsChange = (need) => {
    setFormData(prev => ({
      ...prev,
      needs: prev.needs.includes(need)
        ? prev.needs.filter(n => n !== need)
        : [...prev.needs, need]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMessage({ type: '', text: '' });

    // Validate required fields
    if (!formData.name || !formData.phone) {
      setSubmitMessage({ type: 'error', text: 'Name and phone are required' });
      setSubmitting(false);
      return;
    }

    try {
      if (isOnline) {
        const needsMap = {
  "Food": "food",
  "Water": "water",
  "Shelter": "shelter",
  "Medical": "medicine",
  "Clothing": "clothing",
  "Sanitation": "hygiene",
  "Baby Supplies": "hygiene", 
  "Elderly Care": "hygiene"
};
        const payload = {
      name: formData.name,
      age: parseInt(formData.age) || null,
      gender: formData.gender,
      phone: formData.phone,
      nationalId: formData.idNumber,
      familySize: parseInt(formData.familySize) || 1,

      address: {
        village: formData.location.village,
        district: formData.location.district,
        region: formData.location.region
      },

      latitude: formData.location.coordinates.lat,
      longitude: formData.location.coordinates.lng,

      biometric: formData.faceImage 
        ? { faceImageData: formData.faceImage }
        : undefined,

      

needs: formData.needs.map(n => ({ type: needsMap[n] }))

    };

        // Submit to server
        const response = await fetch('http://localhost:5000/api/beneficiaries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)

        });

        if (response.ok) {
          setSubmitMessage({ type: 'success', text: 'Beneficiary registered successfully!' });
          resetForm();
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Registration failed');
        }
      } else {
        // Save to offline queue
        await saveToOfflineQueue({
          type: 'beneficiary_registration',
          data: formData,
          timestamp: new Date().toISOString()
        });
        
        setSubmitMessage({ 
          type: 'success', 
          text: 'Saved offline! Will sync when connection is restored.' 
        });
        
        // Update offline count
        const queue = await getOfflineQueue();
        setOfflineCount(queue.length);
        
        resetForm();
      }
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      age: '',
      gender: 'prefer_not_to_say',
      phone: '',
      idType: 'aadhaar',
      idNumber: '',
      familySize: '',
      needs: [],
      faceImage: '',
      location: {
        village: '',
        district: '',
        state: '',
        region: '',
        coordinates: { lat: null, lng: null }
      }
    });
    setCapturedImage(null);
    stopCamera();
  };
  const syncOfflineData = async () => {
  try {
    const queue = await getOfflineQueue();

    if (queue.length === 0) {
      setSubmitMessage({ type: "success", text: "No offline records to sync." });
      return;
    }

    setSubmitMessage({ type: "info", text: "Syncing offline data..." });

    const response = await fetch("http://localhost:5000/api/sync/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        records: queue,
        deviceId: "browser-client",
        deviceInfo: navigator.userAgent
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Sync failed");
    }

    // Clear synced items from IndexedDB
    const request = indexedDB.open("ResilienceHubDB", 3);

request.onsuccess = () => {
  const db = request.result;
  const tx = db.transaction("offlineQueue", "readwrite");
  const store = tx.objectStore("offlineQueue");
  store.clear();
};




    setSubmitMessage({
      type: "success",
      text: `Sync complete! ${data.results.success.length} records uploaded.`
    });

    // Re-count offline queue
    getOfflineQueue().then(q => setOfflineCount(q.length));

  } catch (err) {
    console.error("Sync error:", err);
    setSubmitMessage({ type: "error", text: err.message });
  }
};


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            📋 Beneficiary Registration
          </h1>
          <p className="text-gray-600 mt-2">
            Register disaster-affected individuals for aid distribution
          </p>
          
          {/* Online/Offline Status */}
<div className="flex items-center justify-center gap-4 mt-4">

  {/* Online/Offline Badge */}
  <div
    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
      isOnline ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
    }`}
  >
    <span
      className={`w-2 h-2 rounded-full mr-2 ${
        isOnline ? 'bg-green-500' : 'bg-yellow-500'
      }`}
    ></span>
    {isOnline ? 'Online' : `Offline (${offlineCount} pending)`}
  </div>

  {/* Sync Now Button */}
  {offlineCount > 0 && (
    <button
      type="button"
      onClick={syncOfflineData}
      className="px-5 py-2 bg-green-600 text-white rounded-full shadow hover:bg-green-700 transition flex items-center gap-2"
    >
      <span>🔄</span>
      <span>Sync Now ({offlineCount} pending)</span>
    </button>
  )}

</div>



        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8">
          
          {/* Submit Message */}
          {submitMessage.text && (
            <div className={`mb-6 p-4 rounded-lg ${
              submitMessage.type === 'success' 
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}>
              {submitMessage.text}
            </div>
          )}

          {/* ==================== CAMERA SECTION (FIXED) ==================== */}
          <div className="mb-8">
            <label className="block text-lg font-semibold text-gray-700 mb-3">
              📷 Face Photo Capture
            </label>
            
            <div className="bg-gray-100 rounded-xl p-4">
              {/* Camera Error Message */}
              {cameraError && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                  ⚠️ {cameraError}
                </div>
              )}

              {/* Video Preview - FIXED: Always render video element */}
              <div className="relative mb-4">
                {/* Live Video Feed */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full rounded-lg bg-black ${capturedImage ? 'hidden' : ''}`}
                  style={{ maxHeight: '400px', objectFit: 'cover' }}
                />
                
                {/* Captured Image Preview */}
                {capturedImage && (
                  <img
                    src={capturedImage}
                    alt="Captured face"
                    className="w-full rounded-lg"
                    style={{ maxHeight: '400px', objectFit: 'cover' }}
                  />
                )}

                {/* Camera overlay guides */}
                {cameraActive && !capturedImage && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-4 border-white border-dashed rounded-full opacity-50"></div>
                  </div>
                )}
              </div>

              {/* Hidden canvas for photo capture */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Camera Control Buttons */}
              <div className="flex gap-3 justify-center">
                {!cameraActive && !capturedImage && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <span>📷</span> Start Camera
                  </button>
                )}

                {cameraActive && !capturedImage && (
                  <>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <span>📸</span> Capture Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {capturedImage && (
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
                  >
                    <span>🔄</span> Retake Photo
                  </button>
                )}
              </div>

              {capturedImage && (
                <p className="text-center text-green-600 mt-3 font-medium">
                  ✅ Photo captured successfully!
                </p>
              )}
            </div>
          </div>

          {/* ==================== GPS LOCATION SECTION (FIXED) ==================== */}
          <div className="mb-8">
            <label className="block text-lg font-semibold text-gray-700 mb-3">
              📍 Location Details
            </label>
            
            <div className="bg-gray-100 rounded-xl p-4">
              {/* GPS Button */}
              <button
                type="button"
                onClick={getLocation}
                disabled={gpsLoading}
                className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  gpsLoading
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {gpsLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span>Getting Location...</span>
                  </>
                ) : (
                  <>
                    <span>🛰️</span>
                    <span>Auto-Detect Location</span>
                  </>
                )}
              </button>

              {/* GPS Error Message */}
              {gpsError && (
                <div className="mt-3 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                  ⚠️ {gpsError}
                </div>
              )}

              {/* Coordinates Display */}
              {formData.location.coordinates.lat && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                  <span className="font-medium">📍 Coordinates: </span>
                  {formData.location.coordinates.lat.toFixed(6)}, 
                  {formData.location.coordinates.lng.toFixed(6)}
                </div>
              )}

              {/* Location Fields - Now auto-populated */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Village/Town
                  </label>
                  <input
                    type="text"
                    name="location.village"
                    value={formData.location.village}
                    onChange={handleInputChange}
                    placeholder="Auto-detected or enter manually"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    name="location.district"
                    value={formData.location.district}
                    onChange={handleInputChange}
                    placeholder="Auto-detected or enter manually"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    State/Province
                  </label>
                  <input
                    type="text"
                    name="location.state"
                    value={formData.location.state}
                    onChange={handleInputChange}
                    placeholder="Auto-detected or enter manually"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Region/Country
                  </label>
                  <input
                    type="text"
                    name="location.region"
                    value={formData.location.region}
                    onChange={handleInputChange}
                    placeholder="Auto-detected or enter manually"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ==================== PERSONAL INFORMATION ==================== */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              👤 Personal Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter full name"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter phone number"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  min="0"
                  max="120"
                  placeholder="Enter age"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  ID Type
                </label>
                <select
                  name="idType"
                  value={formData.idType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="ration_card">Ration Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  ID Number
                </label>
                <input
                  type="text"
                  name="idNumber"
                  value={formData.idNumber}
                  onChange={handleInputChange}
                  placeholder="Enter ID number"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Family Size
                </label>
                <input
                  type="number"
                  name="familySize"
                  value={formData.familySize}
                  onChange={handleInputChange}
                  min="1"
                  placeholder="Number of family members"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ==================== NEEDS SELECTION ==================== */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              🆘 Immediate Needs
            </h3>
            
            <div className="flex flex-wrap gap-2">
              {needsOptions.map(need => (
                <button
                  key={need}
                  type="button"
                  onClick={() => handleNeedsChange(need)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    formData.needs.includes(need)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {formData.needs.includes(need) ? '✓ ' : ''}{need}
                </button>
              ))}
            </div>
          </div>

          {/* ==================== SUBMIT BUTTON ==================== */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              submitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Registering...
              </span>
            ) : (
              `${isOnline ? '✅ Register Beneficiary' : '💾 Save Offline'}`
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;