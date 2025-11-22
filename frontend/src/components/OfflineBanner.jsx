/**
 * Offline Banner Component
 * 
 * Displays a banner when the user is offline.
 * Indicates that data will be saved locally and synced later.
 */

import React from 'react';
import { WifiOff, Cloud } from 'lucide-react';

const OfflineBanner = () => {
  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 z-50">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-center text-sm font-medium">
          <WifiOff className="w-4 h-4 mr-2" />
          <span>You're offline.</span>
          <Cloud className="w-4 h-4 ml-2 mr-1" />
          <span>Data will be saved locally and synced when you're back online.</span>
        </div>
      </div>
    </div>
  );
};

export default OfflineBanner;