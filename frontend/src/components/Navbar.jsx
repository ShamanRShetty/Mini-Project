/**
 * Navbar Component
 * 
 * Top navigation bar with:
 * - Logo and app name
 * - Navigation links (based on user role)
 * - User info and logout
 * - Mobile menu toggle
 */

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { 
  Menu, X, Home, Users, Package, Truck, Heart, 
  BookOpen, LogOut, User, Wifi, WifiOff 
} from 'lucide-react';

const Navbar = () => {
  const { user, logout, isOnline } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Navigation links based on user role
  const getNavLinks = () => {
    const links = [
      { to: '/dashboard', label: 'Dashboard', icon: Home, roles: ['all'] }
    ];
    
    // Field worker links
    if (['field_worker', 'ngo', 'admin'].includes(user?.role)) {
      links.push(
        { to: 'register', label: 'Register', icon: Users, roles: ['field_worker', 'ngo', 'admin'] },
        { to: '/aid-distribution', label: 'Aid Distribution', icon: Package, roles: ['field_worker', 'ngo', 'admin'] }
      );
    }
    
    // NGO/Admin links
    if (['ngo', 'admin'].includes(user?.role)) {
      links.push(
        { to: '/logistics', label: 'Logistics', icon: Truck, roles: ['ngo', 'admin'] }
      );
    }
    
    // Donor links
    if (['donor', 'admin'].includes(user?.role)) {
      links.push(
        { to: '/donor-portal', label: 'Donor Portal', icon: Heart, roles: ['donor', 'admin'] }
      );
    }
    
    // Ledger for all
    links.push(
      { to: '/ledger', label: 'Ledger', icon: BookOpen, roles: ['all'] }
    );
    
    return links;
  };
  
  const navLinks = getNavLinks();
  
  const handleLogout = () => {
    logout();
    navigate('/home');
  };
  
  const isActiveLink = (path) => location.pathname === path;
  
  return (
    <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="font-bold text-xl text-gray-900">ResilienceHub</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActiveLink(link.to)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {link.label}
                </Link>
              );
            })}
          </div>
          
          {/* Right side: Online status, User, Logout */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Online/Offline indicator */}
            <div className={`flex items-center text-sm ${isOnline ? 'text-green-600' : 'text-yellow-600'}`}>
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 mr-1" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 mr-1" />
                  <span>Offline</span>
                </>
              )}
            </div>
            
            {/* User info */}
            <div className="flex items-center text-sm text-gray-600">
              <User className="w-4 h-4 mr-1" />
              <span>{user?.name}</span>
              <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            
            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </button>
          </div>
          
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium ${
                    isActiveLink(link.to)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {link.label}
                </Link>
              );
            })}
            
            <hr className="my-2" />
            
            {/* Mobile: Online status */}
            <div className={`flex items-center px-3 py-2 text-sm ${isOnline ? 'text-green-600' : 'text-yellow-600'}`}>
              {isOnline ? <Wifi className="w-4 h-4 mr-2" /> : <WifiOff className="w-4 h-4 mr-2" />}
              {isOnline ? 'Online' : 'Offline Mode'}
            </div>
            
            {/* Mobile: User info */}
            <div className="flex items-center px-3 py-2 text-sm text-gray-600">
              <User className="w-4 h-4 mr-2" />
              {user?.name} ({user?.role?.replace('_', ' ')})
            </div>
            
            {/* Mobile: Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;