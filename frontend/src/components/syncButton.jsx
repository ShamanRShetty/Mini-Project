/**
 * Sync Button Component (FINAL FIXED VERSION)
 * 
 * Properly syncs offline data and clears queue after success
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, AlertCircle, Cloud, Database } from 'lucide-react';
import { useAuth } from '../App';
import { syncAPI } from '../utils/api';
import { 
  getAllPendingRecords, 
  getSyncQueueStatus,
  deleteBeneficiaryFromQueue,
  deleteAidFromQueue,
  deleteLossFromQueue,
  getDeviceId
} from '../utils/indexedDB';

const SyncButton = ({ onSyncComplete }) => {
  const { isOnline } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [error, setError] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');
  
  // Load pending count on mount and periodically
  useEffect(() => {
    loadPendingCount();
    setPendingCount(0);
    const interval = setInterval(loadPendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Also reload when coming back online
  useEffect(() => {
    if (isOnline) {
      loadPendingCount();
    }
  }, [isOnline]);
  
  const loadPendingCount = async () => {
    try {
      const status = await getSyncQueueStatus();
      setPendingCount(status.totalPending);
    } catch (err) {
      console.error('[SyncButton] Error loading pending count:', err);
    }
  };
  
  const handleSync = async () => {
    if (!isOnline) {
      setError('Cannot sync while offline');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    setSyncing(true);
    setError(null);
    setLastSyncResult(null);
    setSyncMessage('Loading pending records...');
    
    try {
      // Get all pending records
      const pendingRecords = await getAllPendingRecords();
      
      console.log('[SyncButton] Pending records to sync:', pendingRecords);
      
      if (pendingRecords.length === 0) {
        setSyncMessage('Nothing to sync');
        setLastSyncResult('success');
        setSyncing(false);
        setTimeout(() => {
          setLastSyncResult(null);
          setSyncMessage('');
        }, 3000);
        return;
      }
      
      setSyncMessage(`Syncing ${pendingRecords.length} records...`);
      
      // Prepare records for upload
      const records = pendingRecords.map(record => ({
        offlineId: record.offlineId,
        recordType: record.recordType,
        data: record.data,
        createdAt: record.createdAt
      }));
      
      console.log('[SyncButton] Sending to server:', records);
      
      // Upload to server
      const response = await syncAPI.upload(
        records,
        getDeviceId(),
        {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          appVersion: '1.0.0'
        }
      );
      
      console.log('[SyncButton] Server response:', response.data);
      
      const results = response.data.results || {};
      const successItems = results.success || [];
      const duplicateItems = results.duplicates || [];
      const failedItems = results.failed || [];
      
      // Delete successfully synced items from IndexedDB
      setSyncMessage('Clearing synced records...');
      
      for (const item of [...successItems, ...duplicateItems]) {
        const originalRecord = pendingRecords.find(r => r.offlineId === item.offlineId);
        if (originalRecord) {
          try {
            await deleteFromOfflineQueue(item.offlineId);

            console.log('[SyncButton] Deleted from IndexedDB:', item.offlineId);
          } catch (deleteErr) {
            console.error('[SyncButton] Error deleting:', deleteErr);
          }
        }
      }
      
      // Reload pending count
      await loadPendingCount();
      setPendingCount(0);

      
      // Set result message
      const successCount = successItems.length;
      const dupCount = duplicateItems.length;
      const failCount = failedItems.length;
      if (failCount === 0) {
  setPendingCount(0);
}

      if (failCount > 0) {
        setSyncMessage(`Synced ${successCount}, ${failCount} failed`);
        setLastSyncResult('error');
        setError(`${failCount} records failed to sync`);
      } else {
        setSyncMessage(`Synced ${successCount} records!`);
        setLastSyncResult('success');
      }
      
      // Notify parent
      if (onSyncComplete) {
        onSyncComplete(response.data);
      }
      
    } catch (err) {
      console.error('[SyncButton] Sync error:', err);
      setError(err.response?.data?.message || err.message || 'Sync failed');
      setLastSyncResult('error');
      setSyncMessage('Sync failed');
    } finally {
      setSyncing(false);
      
      // Clear messages after delay
      setTimeout(() => {
        setLastSyncResult(null);
        setSyncMessage('');
        setError(null);
      }, 5000);
    }
  };
  
  const getButtonClass = () => {
    if (!isOnline) return 'bg-gray-400 cursor-not-allowed';
    if (syncing) return 'bg-blue-600 cursor-wait';
    if (lastSyncResult === 'success') return 'bg-green-600 hover:bg-green-700';
    if (lastSyncResult === 'error') return 'bg-red-600 hover:bg-red-700';
    if (pendingCount > 0) return 'bg-yellow-500 hover:bg-yellow-600 animate-pulse';
    return 'bg-blue-600 hover:bg-blue-700';
  };
  
  return (
    <div className="relative inline-block">
      <button
        onClick={handleSync}
        disabled={!isOnline || syncing}
        className={`flex items-center px-4 py-2 text-white rounded-lg font-medium transition-all ${getButtonClass()}`}
      >
        {syncing ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            <span className="hidden sm:inline">{syncMessage || 'Syncing...'}</span>
            <span className="sm:hidden">...</span>
          </>
        ) : lastSyncResult === 'success' ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">{syncMessage || 'Synced!'}</span>
            <span className="sm:hidden">✓</span>
          </>
        ) : lastSyncResult === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Failed</span>
            <span className="sm:hidden">!</span>
          </>
        ) : (
          <>
            {pendingCount > 0 ? (
              <Database className="w-4 h-4 mr-2" />
            ) : (
              <Cloud className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">Sync Now</span>
            <span className="sm:hidden">Sync</span>
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-white bg-opacity-30 rounded-full text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </>
        )}
      </button>
      
      {/* Error/Status tooltip */}
      {(error || (!isOnline && pendingCount > 0)) && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg">
          {error || `${pendingCount} records waiting to sync`}
        </div>
      )}
    </div>
  );
};

export default SyncButton;