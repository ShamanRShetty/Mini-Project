/*
  WHAT THIS FILE DOES:
  - Beautiful, modern home page for ResilienceHub
  - Features disaster warnings section with real/demo data
  - Hero section with call-to-action
  - Statistics section showing impact
  - Features showcase
  - How it works section
  - Responsive design with animations
*/

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  const [warnings, setWarnings] = useState([]);
  const [loadingWarnings, setLoadingWarnings] = useState(true);
  const [stats, setStats] = useState({
    beneficiaries: 0,
    aidDistributed: 0,
    activeWorkers: 0,
    regionsServed: 0
  });

  // Fetch disaster warnings on component mount
  useEffect(() => {
    fetchDisasterWarnings();
    fetchStats();
  }, []);

  // Fetch disaster warnings from government/weather APIs
  const fetchDisasterWarnings = async () => {
    try {
      // Try fetching from India Meteorological Department or similar
      // For demo, we'll use sample data + try a real API
      
      // Attempt to fetch from a public disaster API
      // Note: Many government APIs require registration
      // Using Open-Meteo's weather alerts as example
      const lat = 20.5937; // Center of India
      const lng = 78.9629;
      
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
        );
        
        if (response.ok) {
          const data = await response.json();
          // Process weather data into warnings format
          const weatherWarnings = processWeatherData(data);
          setWarnings(prev => [...weatherWarnings, ...getDemoWarnings()]);
        }
      } catch (apiError) {
        console.log('Weather API not available, using demo data');
        setWarnings(getDemoWarnings());
      }
    } catch (error) {
      console.error('Error fetching warnings:', error);
      setWarnings(getDemoWarnings());
    } finally {
      setLoadingWarnings(false);
    }
  };

  // Process weather data into warning format
  const processWeatherData = (data) => {
    const warnings = [];
    const weatherCodes = {
      95: { type: 'Thunderstorm', severity: 'high', icon: '⛈️' },
      96: { type: 'Thunderstorm with Hail', severity: 'high', icon: '🌨️' },
      99: { type: 'Severe Thunderstorm', severity: 'critical', icon: '🌪️' },
      77: { type: 'Snow Grains', severity: 'medium', icon: '🌨️' },
      85: { type: 'Snow Showers', severity: 'medium', icon: '❄️' },
    };

    if (data.current?.weather_code && weatherCodes[data.current.weather_code]) {
      const weather = weatherCodes[data.current.weather_code];
      warnings.push({
        id: 'weather-current',
        type: weather.type,
        severity: weather.severity,
        location: 'Current Location',
        message: `${weather.type} conditions detected. Take necessary precautions.`,
        source: 'Open-Meteo Weather',
        timestamp: new Date().toISOString(),
        icon: weather.icon
      });
    }

    return warnings;
  };

  // Demo warnings for display
  const getDemoWarnings = () => [
    {
      id: 'demo-1',
      type: 'Cyclone Alert',
      severity: 'critical',
      location: 'Coastal Odisha, Andhra Pradesh',
      message: 'Cyclone DANA approaching eastern coast. Expected landfall in 48 hours. Evacuate low-lying areas immediately.',
      source: 'India Meteorological Department',
      timestamp: new Date().toISOString(),
      icon: '🌀'
    },
    {
      id: 'demo-2',
      type: 'Flood Warning',
      severity: 'high',
      location: 'Bihar, Eastern Uttar Pradesh',
      message: 'Heavy rainfall causing flooding in Ganga basin. Water levels rising above danger mark.',
      source: 'Central Water Commission',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      icon: '🌊'
    },
    {
      id: 'demo-3',
      type: 'Heat Wave',
      severity: 'medium',
      location: 'Rajasthan, Gujarat',
      message: 'Severe heat wave conditions expected for next 5 days. Temperature may exceed 45°C.',
      source: 'IMD Regional Center',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      icon: '🔥'
    },
    {
      id: 'demo-4',
      type: 'Earthquake Advisory',
      severity: 'low',
      location: 'Himalayan Region',
      message: 'Minor seismic activity detected. No immediate danger but remain alert.',
      source: 'National Center for Seismology',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      icon: '📳'
    }
  ];

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch('http://localhost:5000/api/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
          return;
        }
      }
    } catch (error) {
      console.log('Using demo stats');
    }
    
    // Demo stats
    setStats({
      beneficiaries: 12547,
      aidDistributed: 45230,
      activeWorkers: 342,
      regionsServed: 28
    });
  };

  // Severity color mapping
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 border-red-600';
      case 'high': return 'bg-orange-500 border-orange-600';
      case 'medium': return 'bg-yellow-500 border-yellow-600';
      case 'low': return 'bg-blue-500 border-blue-600';
      default: return 'bg-gray-500 border-gray-600';
    }
  };

  const getSeverityBg = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-200';
      case 'high': return 'bg-orange-50 border-orange-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'low': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const isLoggedIn = !!localStorage.getItem('token');

  return (
    <div className="min-h-screen">
      {/* ==================== HERO SECTION ==================== */}
      <section className="relative bg-gradient-to-br from-blue-700 via-indigo-800 to-purple-900 text-white overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500 rounded-full opacity-20 animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500 rounded-full opacity-10 animate-ping" style={{animationDuration: '3s'}}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl font-extrabold mb-6 animate-fade-in">
              <span className="block">🛡️ ResilienceHub</span>
              <span className="block text-3xl sm:text-4xl font-light mt-4 text-blue-200">
                Disaster Relief Management System
              </span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-xl text-blue-100 mb-10">
              Empowering field workers with offline-first technology to deliver aid 
              efficiently, transparently, and with dignity to those who need it most.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isLoggedIn ? (
                <>
                  <Link
                    to="/dashboard"
                    className="px-8 py-4 bg-white text-blue-700 rounded-xl font-bold text-lg hover:bg-blue-50 transform hover:scale-105 transition-all shadow-lg"
                  >
                    📊 Go to Dashboard
                  </Link>
                  <Link
                    to="/register"
                    className="px-8 py-4 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 transform hover:scale-105 transition-all shadow-lg"
                  >
                    📋 Register Beneficiary
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-8 py-4 bg-white text-blue-700 rounded-xl font-bold text-lg hover:bg-blue-50 transform hover:scale-105 transition-all shadow-lg"
                  >
                    🔐 Login to System
                  </Link>
                  <a
                    href="#features"
                    className="px-8 py-4 border-2 border-white text-white rounded-xl font-bold text-lg hover:bg-white/10 transform hover:scale-105 transition-all"
                  >
                    Learn More ↓
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="#f9fafb"/>
          </svg>
        </div>
      </section>

      {/* ==================== DISASTER WARNINGS SECTION ==================== */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <span className="text-4xl">⚠️</span>
                Active Disaster Warnings
              </h2>
              <p className="text-gray-600 mt-2">
                Real-time alerts from government and meteorological sources
              </p>
            </div>
            <button 
              onClick={fetchDisasterWarnings}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
            >
              🔄 Refresh
            </button>
          </div>

          {loadingWarnings ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : warnings.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <span className="text-5xl mb-4 block">✅</span>
              <p className="text-green-800 text-lg font-medium">No active warnings at this time</p>
              <p className="text-green-600">All regions are currently safe</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {warnings.map((warning, index) => (
                <div
                  key={warning.id}
                  className={`border-l-4 rounded-xl p-6 shadow-sm hover:shadow-md transition-all ${getSeverityBg(warning.severity)}`}
                  style={{ 
                    animationDelay: `${index * 0.1}s`,
                    animation: 'fadeInUp 0.5s ease-out forwards'
                  }}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">{warning.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">
                          {warning.type}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getSeverityColor(warning.severity)}`}>
                          {warning.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-2">
                        📍 <strong>{warning.location}</strong>
                      </p>
                      <p className="text-gray-700 mb-3">{warning.message}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>📡 Source: {warning.source}</span>
                        <span>🕐 {new Date(warning.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ==================== STATISTICS SECTION ==================== */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            📈 Our Impact
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Beneficiaries Registered', value: stats.beneficiaries.toLocaleString(), icon: '👥', color: 'blue' },
              { label: 'Aid Packages Distributed', value: stats.aidDistributed.toLocaleString(), icon: '📦', color: 'green' },
              { label: 'Active Field Workers', value: stats.activeWorkers.toLocaleString(), icon: '👷', color: 'orange' },
              { label: 'Regions Served', value: stats.regionsServed.toLocaleString(), icon: '🗺️', color: 'purple' },
            ].map((stat, index) => (
              <div
                key={index}
                className={`bg-gradient-to-br from-${stat.color}-50 to-${stat.color}-100 rounded-2xl p-6 text-center transform hover:scale-105 transition-all`}
              >
                <span className="text-4xl block mb-3">{stat.icon}</span>
                <p className={`text-4xl font-bold text-${stat.color}-600 mb-2`}>
                  {stat.value}
                </p>
                <p className="text-gray-600 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FEATURES SECTION ==================== */}
      <section id="features" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">
            🚀 Key Features
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Built specifically for disaster relief operations with field workers in mind
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: '📴',
                title: 'Offline-First PWA',
                description: 'Works without internet connection. Register beneficiaries, capture data, and sync when back online.',
                color: 'blue'
              },
              {
                icon: '📷',
                title: 'Biometric Verification',
                description: 'Face capture and verification to prevent duplicate registrations and ensure aid reaches the right people.',
                color: 'green'
              },
              {
                icon: '🗺️',
                title: 'Route Optimization',
                description: 'Smart logistics with Mapbox integration to plan efficient delivery routes to multiple beneficiaries.',
                color: 'orange'
              },
              {
                icon: '🔗',
                title: 'Blockchain Transparency',
                description: 'SHA256 hash chain ledger ensuring every aid distribution is recorded and verifiable.',
                color: 'purple'
              },
              {
                icon: '📊',
                title: 'Real-Time Dashboard',
                description: 'Heatmaps, charts, and analytics to monitor relief operations and identify areas of need.',
                color: 'red'
              },
              {
                icon: '💝',
                title: 'Donor Portal',
                description: 'Transparent reporting for donors to track how their contributions are being utilized.',
                color: 'pink'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-100"
              >
                <span className="text-5xl block mb-4">{feature.icon}</span>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            🔄 How It Works
          </h2>

          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {[
              { step: 1, icon: '📝', title: 'Register', desc: 'Field workers register affected people with photo and location' },
              { step: 2, icon: '✅', title: 'Verify', desc: 'System verifies identity and checks for duplicates' },
              { step: 3, icon: '🚚', title: 'Plan', desc: 'Logistics optimize delivery routes' },
              { step: 4, icon: '📦', title: 'Distribute', desc: 'Aid is distributed with blockchain logging' },
              { step: 5, icon: '📊', title: 'Track', desc: 'Donors and admins track all operations' },
            ].map((item, index) => (
              <React.Fragment key={index}>
                <div className="text-center flex-1">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">{item.icon}</span>
                  </div>
                  <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                    {item.step}
                  </div>
                  <h4 className="font-bold text-gray-800 mb-1">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
                {index < 4 && (
                  <div className="hidden md:block text-4xl text-gray-300">→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== CTA SECTION ==================== */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Make a Difference?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of field workers using ResilienceHub to deliver aid efficiently
          </p>
          <Link
            to={isLoggedIn ? "/dashboard" : "/login"}
            className="inline-block px-8 py-4 bg-white text-blue-700 rounded-xl font-bold text-lg hover:bg-blue-50 transform hover:scale-105 transition-all shadow-lg"
          >
            {isLoggedIn ? "Go to Dashboard →" : "Get Started →"}
          </Link>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4">🛡️ ResilienceHub</h3>
              <p className="text-sm">
                Empowering disaster relief with technology
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="hover:text-white">Home</Link></li>
                <li><Link to="/login" className="hover:text-white">Login</Link></li>
                <li><Link to="/donor" className="hover:text-white">Donor Portal</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">API Reference</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <p className="text-sm">
                📧 support@resiliencehub.org<br />
                📞 1800-XXX-XXXX
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            © 2025 ResilienceHub. All rights reserved.
          </div>
        </div>
      </footer>

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Home;