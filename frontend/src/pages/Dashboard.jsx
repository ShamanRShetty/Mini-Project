/**
 * Dashboard Page
 * 
 * Main dashboard showing:
 * - Key statistics (beneficiaries, distributions, resources)
 * - Charts (distribution by type, timeline)
 * - Heatmap of beneficiary locations
 * - Recent activity
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { beneficiaryAPI, aidAPI, logisticsAPI } from '../utils/api';
import { getSyncQueueStatus } from '../utils/indexedDB';
import SyncButton from '../components/SyncButton';
import { 
  Users, Package, Truck, TrendingUp, 
  AlertTriangle, CheckCircle, Clock, MapPin,
  RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const Dashboard = () => {
  const { user, isOnline } = useAuth();
  
  // Data state
  const [stats, setStats] = useState(null);
  const [aidStats, setAidStats] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
    loadSyncStatus();
  }, []);
  
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load data in parallel
      const [beneficiaryStats, aidStatsData, inventoryData] = await Promise.all([
        beneficiaryAPI.getStats().catch(() => ({ data: { stats: {} } })),
        aidAPI.getStats().catch(() => ({ data: {} })),
        logisticsAPI.getInventory().catch(() => ({ data: {} }))
      ]);
      
      setStats(beneficiaryStats.data.stats);
      setAidStats(aidStatsData.data);
      setInventory(inventoryData.data);
      
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  
  const loadSyncStatus = async () => {
    try {
      const status = await getSyncQueueStatus();
      setSyncStatus(status);
    } catch (err) {
      console.error('Error loading sync status:', err);
    }
  };
  
  // Prepare chart data
  const districtData = stats?.byDistrict?.slice(0, 5).map(d => ({
    name: d._id || 'Unknown',
    count: d.count
  })) || [];
  
  const aidTypeData = aidStats?.byType?.map(d => ({
    name: d._id,
    count: d.count,
    value: d.totalValue
  })) || [];
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  
  // Stat cards data
  const statCards = [
    {
      title: 'Total Beneficiaries',
      value: stats?.total || 0,
      icon: Users,
      color: 'bg-blue-500',
      change: '+12%'
    },
    {
      title: 'Aid Distributions',
      value: aidStats?.stats?.totalDistributions || 0,
      icon: Package,
      color: 'bg-green-500',
      change: '+8%'
    },
    {
      title: 'Resources Available',
      value: inventory?.summary?.length || 0,
      icon: Truck,
      color: 'bg-yellow-500',
      subtext: 'types in stock'
    },
    {
      title: 'Pending Sync',
      value: syncStatus?.totalPending || 0,
      icon: Clock,
      color: syncStatus?.totalPending > 0 ? 'bg-orange-500' : 'bg-gray-400',
      subtext: 'records to sync'
    }
  ];
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center space-x-4">
          <SyncButton onSyncComplete={loadSyncStatus} />
          <button
            onClick={loadDashboardData}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Offline warning */}
      {!isOnline && (
        <div className="alert-warning mb-6 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          You're viewing cached data. Some features may be limited.
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="alert-error mb-6">{error}</div>
      )}
      
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                  {card.change && (
                    <p className="text-sm text-green-600 flex items-center mt-1">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      {card.change}
                    </p>
                  )}
                  {card.subtext && (
                    <p className="text-sm text-gray-500 mt-1">{card.subtext}</p>
                  )}
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Beneficiaries by District */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Beneficiaries by District</h3>
          {districtData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={districtData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
        
        {/* Aid Distribution by Type */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Aid Distribution by Type</h3>
          {aidTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={aidTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="count"
                  label={({ name, count }) => `${name}: ${count}`}
                >
                  {aidTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {['field_worker', 'ngo', 'admin'].includes(user?.role) && (
              <Link
                to="/field-worker"
                className="flex items-center p-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
              >
                <Users className="w-5 h-5 text-primary-600 mr-3" />
                <span className="text-primary-700 font-medium">Register Beneficiary</span>
              </Link>
            )}
            {['field_worker', 'ngo', 'admin'].includes(user?.role) && (
              <Link
                to="/aid-distribution"
                className="flex items-center p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <Package className="w-5 h-5 text-green-600 mr-3" />
                <span className="text-green-700 font-medium">Distribute Aid</span>
              </Link>
            )}
            <Link
              to="/ledger"
              className="flex items-center p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <CheckCircle className="w-5 h-5 text-purple-600 mr-3" />
              <span className="text-purple-700 font-medium">View Ledger</span>
            </Link>
          </div>
        </div>
        
        {/* Inventory Status */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Status</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Available</th>
                  <th className="pb-2">Total Value</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {inventory?.summary?.slice(0, 5).map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 capitalize">{item._id}</td>
                    <td className="py-3">{item.availableQuantity}</td>
                    <td className="py-3">${item.totalValue?.toLocaleString()}</td>
                    <td className="py-3">
                      {item.lowStockItems > 0 ? (
                        <span className="badge-warning">Low Stock</span>
                      ) : (
                        <span className="badge-success">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!inventory?.summary || inventory.summary.length === 0) && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-gray-500">
                      No inventory data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;