/**
 * IndexedDB Utility (FIXED VERSION)
 * 
 * Simplified and bulletproof offline storage
 */

const DB_NAME = 'ResilienceHubDB';
const DB_VERSION = 2; // Increment version to force upgrade

// Store names
const STORES = {
  BENEFICIARY_QUEUE: 'beneficiaryQueue',
  AID_QUEUE: 'aidQueue',
  LOSS_QUEUE: 'lossQueue'
};

let db = null;

/**
 * Open database connection
 */
const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Error opening database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('[IndexedDB] Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      console.log('[IndexedDB] Upgrading database...');
      const database = event.target.result;

      // Create stores if they don't exist
      if (!database.objectStoreNames.contains(STORES.BENEFICIARY_QUEUE)) {
        database.createObjectStore(STORES.BENEFICIARY_QUEUE, { keyPath: 'offlineId' });
        console.log('[IndexedDB] Created beneficiaryQueue store');
      }

      if (!database.objectStoreNames.contains(STORES.AID_QUEUE)) {
        database.createObjectStore(STORES.AID_QUEUE, { keyPath: 'offlineId' });
        console.log('[IndexedDB] Created aidQueue store');
      }

      if (!database.objectStoreNames.contains(STORES.LOSS_QUEUE)) {
        database.createObjectStore(STORES.LOSS_QUEUE, { keyPath: 'offlineId' });
        console.log('[IndexedDB] Created lossQueue store');
      }
    };
  });
};

/**
 * Generate unique offline ID
 */
const generateOfflineId = () => {
  return `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Get device ID
 */
const getDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

// ========================================
// BENEFICIARY OPERATIONS
// ========================================

/**
 * Queue a beneficiary for sync
 */
const queueBeneficiary = async (beneficiaryData) => {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const record = {
      offlineId: generateOfflineId(),
      recordType: 'beneficiary',
      data: beneficiaryData,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const transaction = database.transaction([STORES.BENEFICIARY_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.BENEFICIARY_QUEUE);
    const request = store.add(record);

    request.onsuccess = () => {
      console.log('[IndexedDB] Beneficiary queued:', record.offlineId);
      resolve(record);
    };

    request.onerror = () => {
      console.error('[IndexedDB] Error queuing beneficiary:', request.error);
      reject(request.error);
    };
  });
};

/**
 * Get all pending beneficiaries
 */
const getPendingBeneficiaries = async () => {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.BENEFICIARY_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.BENEFICIARY_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => {
      const pending = request.result.filter(r => r.status === 'pending');
      console.log('[IndexedDB] Found pending beneficiaries:', pending.length);
      resolve(pending);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Get all queued beneficiaries
 */
const getAllQueuedBeneficiaries = async () => {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.BENEFICIARY_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.BENEFICIARY_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Delete a beneficiary from queue
 */
const deleteBeneficiaryFromQueue = async (offlineId) => {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.BENEFICIARY_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.BENEFICIARY_QUEUE);
    const request = store.delete(offlineId);

    request.onsuccess = () => {
      console.log('[IndexedDB] Deleted beneficiary:', offlineId);
      resolve(true);
    };

    request.onerror = () => reject(request.error);
  });
};

// ========================================
// AID LOG OPERATIONS
// ========================================

const queueAidDistribution = async (aidData) => {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const record = {
      offlineId: generateOfflineId(),
      recordType: 'aid_log',
      data: aidData,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const transaction = database.transaction([STORES.AID_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.AID_QUEUE);
    const request = store.add(record);

    request.onsuccess = () => {
      console.log('[IndexedDB] Aid distribution queued:', record.offlineId);
      resolve(record);
    };

    request.onerror = () => reject(request.error);
  });
};

const getPendingAidDistributions = async () => {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.AID_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.AID_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => {
      const pending = request.result.filter(r => r.status === 'pending');
      resolve(pending);
    };

    request.onerror = () => reject(request.error);
  });
};

const deleteAidFromQueue = async (offlineId) => {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.AID_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.AID_QUEUE);
    const request = store.delete(offlineId);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// ========================================
// LOSS OPERATIONS
// ========================================

const queueLossReport = async (lossData) => {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const record = {
      offlineId: generateOfflineId(),
      recordType: 'loss',
      data: lossData,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const transaction = database.transaction([STORES.LOSS_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.LOSS_QUEUE);
    const request = store.add(record);

    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
};

const getPendingLossReports = async () => {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.LOSS_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.LOSS_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => {
      const pending = request.result.filter(r => r.status === 'pending');
      resolve(pending);
    };

    request.onerror = () => reject(request.error);
  });
};

const deleteLossFromQueue = async (offlineId) => {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.LOSS_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.LOSS_QUEUE);
    const request = store.delete(offlineId);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// ========================================
// SYNC HELPERS
// ========================================

/**
 * Get ALL pending records from all queues
 */
const getAllPendingRecords = async () => {
  const [beneficiaries, aidLogs, losses] = await Promise.all([
    getPendingBeneficiaries(),
    getPendingAidDistributions(),
    getPendingLossReports()
  ]);
  
  const all = [...beneficiaries, ...aidLogs, ...losses];
  console.log('[IndexedDB] Total pending records:', all.length);
  return all;
};

/**
 * Get sync queue status
 */
const getSyncQueueStatus = async () => {
  const [beneficiaries, aidLogs, losses] = await Promise.all([
    getAllQueuedBeneficiaries(),
    getPendingAidDistributions(),
    getPendingLossReports()
  ]);

  const pendingBeneficiaries = beneficiaries.filter(r => r.status === 'pending').length;
  const pendingAid = aidLogs.length;
  const pendingLoss = losses.length;

  return {
    beneficiaries: { pending: pendingBeneficiaries, total: beneficiaries.length },
    aidLogs: { pending: pendingAid },
    losses: { pending: pendingLoss },
    totalPending: pendingBeneficiaries + pendingAid + pendingLoss
  };
};

/**
 * Clear synced records by offlineId
 */
const clearSyncedRecords = async (offlineIds, recordType) => {
  for (const offlineId of offlineIds) {
    try {
      if (recordType === 'beneficiary') {
        await deleteBeneficiaryFromQueue(offlineId);
      } else if (recordType === 'aid_log') {
        await deleteAidFromQueue(offlineId);
      } else if (recordType === 'loss') {
        await deleteLossFromQueue(offlineId);
      }
    } catch (error) {
      console.error(`[IndexedDB] Error deleting ${offlineId}:`, error);
    }
  }
};

/**
 * Clear all data (for testing)
 */
const clearAllData = async () => {
  const database = await openDatabase();
  
  const stores = [STORES.BENEFICIARY_QUEUE, STORES.AID_QUEUE, STORES.LOSS_QUEUE];
  
  for (const storeName of stores) {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  console.log('[IndexedDB] All data cleared');
};

// Export everything
export {
  STORES,
  openDatabase,
  generateOfflineId,
  getDeviceId,
  queueBeneficiary,
  getPendingBeneficiaries,
  getAllQueuedBeneficiaries,
  deleteBeneficiaryFromQueue,
  queueAidDistribution,
  getPendingAidDistributions,
  deleteAidFromQueue,
  queueLossReport,
  getPendingLossReports,
  deleteLossFromQueue,
  getAllPendingRecords,
  getSyncQueueStatus,
  clearSyncedRecords,
  clearAllData
};

export default {
  queueBeneficiary,
  getPendingBeneficiaries,
  getAllQueuedBeneficiaries,
  queueAidDistribution,
  getPendingAidDistributions,
  queueLossReport,
  getPendingLossReports,
  getAllPendingRecords,
  getSyncQueueStatus,
  getDeviceId,
  clearAllData
};