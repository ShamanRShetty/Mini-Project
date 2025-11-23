import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { 
  Menu, X, Home, Users, Package, Truck, Heart, 
  BookOpen, LogOut, User, Wifi, WifiOff, AlertTriangle, ChevronDown
} from 'lucide-react';

const Navbar = () => {
  const { user, logout, isOnline } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isActiveLink = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/home');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <span className="font-bold text-xl text-gray-900 hidden sm:block">ResilienceHub</span>
          </Link>

          {/* Desktop: Main Links */}
          <div className="hidden lg:flex items-center space-x-1 flex-1 justify-center">
            <Link to="/dashboard" className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition ${isActiveLink('/dashboard') ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`}>
              <Home className="w-4 h-4 mr-2" /> Dashboard
            </Link>

            {['field_worker', 'ngo', 'admin'].includes(user?.role) && (
              <>
                <Link to="/register" className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition ${isActiveLink('/register') ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                  <Users className="w-4 h-4 mr-2" /> Register
                </Link>
                <Link to="/aid-distribution" className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition ${isActiveLink('/aid-distribution') ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                  <Package className="w-4 h-4 mr-2" /> Distribution
                </Link>
                <Link to="/priority-dashboard" className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition ${isActiveLink('/priority-dashboard') ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                  <AlertTriangle className="w-4 h-4 mr-2" /> Priority
                </Link>
              </>
            )}

            {/* MORE DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <Menu className="w-4 h-4 mr-2" /> More <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
                  <div className="py-3">

                    {['field_worker', 'ngo', 'admin'].includes(user?.role) && (
                      <Link to="/track" onClick={() => setDropdownOpen(false)} className="flex items-center px-5 py-3 hover:bg-gray-50 text-gray-800">
                        <Truck className="w-5 h-5 mr-3 text-blue-600" />
                        <div>
                          <div className="font-medium">Track Deliveries</div>
                          <div className="text-xs text-gray-500">Live truck tracking</div>
                        </div>
                      </Link>
                    )}

                    {['ngo', 'admin'].includes(user?.role) && (
                      <Link to="/logistics" onClick={() => setDropdownOpen(false)} className="flex items-center px-5 py-3 hover:bg-gray-50 text-gray-800">
                        <Truck className="w-5 h-5 mr-3 text-purple-600" />
                        <div>
                          <div className="font-medium">Logistics</div>
                          <div className="text-xs text-gray-500">Fleet & routes</div>
                        </div>
                      </Link>
                    )}

                    {['donor', 'admin'].includes(user?.role) && (
                      <Link to="/donor-portal" onClick={() => setDropdownOpen(false)} className="flex items-center px-5 py-3 hover:bg-gray-50 text-gray-800">
                        <Heart className="w-5 h-5 mr-3 text-red-600" />
                        <div>
                          <div className="font-medium">Donor Portal</div>
                          <div className="text-xs text-gray-500">Transparency dashboard</div>
                        </div>
                      </Link>
                    )}

                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <Link to="/ledger" onClick={() => setDropdownOpen(false)} className="flex items-center px-5 py-3 hover:bg-gray-50 text-gray-800">
                        <BookOpen className="w-5 h-5 mr-3 text-green-600" />
                        <div>
                          <div className="font-medium">Ledger Explorer</div>
                          <div className="text-xs text-gray-500">Blockchain records</div>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Status + User + Logout */}
          <div className="flex items-center space-x-4">

            {/* Online/Offline */}
            <div className={`hidden sm:flex items-center text-sm font-medium ${isOnline ? 'text-green-600' : 'text-orange-600'}`}>
              {isOnline ? <Wifi className="w-5 h-5 mr-1.5" /> : <WifiOff className="w-5 h-5 mr-1.5" />}
              <span className="hidden md:inline">{isOnline ? 'Online' : 'Offline Mode'}</span>
            </div>

            {/* User Info */}
            <div className="hidden md:flex items-center text-sm text-gray-700">
              <User className="w-5 h-5 mr-2 text-gray-500" />
              <div>
                <div className="font-medium">{user?.name}</div>
                <div className="text-xs text-gray-500">{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {dropdownOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Full Menu */}
      {dropdownOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200">
          <div className="px-4 py-4 space-y-2">
            {/* Mobile links - same as before */}
            <Link to="/dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center px-4 py-3 rounded-lg hover:bg-gray-50">
              <Home className="w-5 h-5 mr-3" /> Dashboard
            </Link>
            {['field_worker', 'ngo', 'admin'].includes(user?.role) && (
              <>
                <Link to="/register" onClick={() => setDropdownOpen(false)} className="flex items-center px-4 py-3 rounded-lg hover:bg-gray-50"><Users className="w-5 h-5 mr-3" /> Register Beneficiary</Link>
                <Link to="/aid-distribution" onClick={() => setDropdownOpen(false)} className="flex items-center px-4 py-3 rounded-lg hover:bg-gray-50"><Package className="w-5 h-5 mr-3" /> Aid Distribution</Link>
                <Link to="/priority-dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center px-4 py-3 rounded-lg hover:bg-gray-50"><AlertTriangle className="w-5 h-5 mr-3" /> Priority Dashboard</Link>
                <Link to="/track" onClick={() => setDropdownOpen(false)} className="flex items-center px-4 py-3 rounded-lg hover:bg-gray-50"><Truck className="w-5 h-5 mr-3" /> Track Deliveries</Link>
              </>
            )}
            {['ngo', 'admin'].includes(user?.role) && (
              <Link to="/logistics" onClick={() => setDropdownOpen(false)} className="flex items-center px-4 py-3 rounded-lg hover:bg-gray-50"><Truck className="w-5 h-5 mr-3" /> Logistics</Link>
            )}
            <Link to="/ledger" onClick={() => setDropdownOpen(false)} className="flex items-center px-4 py-3 rounded-lg hover:bg-gray-50"><BookOpen className="w-5 h-5 mr-3" /> Ledger Explorer</Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;