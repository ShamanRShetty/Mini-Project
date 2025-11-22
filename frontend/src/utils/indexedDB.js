/**
 * ResilienceHub IndexedDB Helper - Unified offlineQueue (Option B)
 *
 * - Single store: offlineQueue (autoIncrement id)
 * - Keeps compatibility with your original 3-queue API by providing wrapper functions:
 *     queueBeneficiary, getPendingBeneficiaries, deleteBeneficiaryFromQueue, ...
 * - Provides unified functions for Register page: saveToOfflineQueue, getOfflineQueue, syncOfflineData, etc.
 *
 * DB schema (each record):
 * {
 *   id: <auto increment>,
 *   offlineId: 'offline_<timestamp>_<rand>',
 *   recordType: 'beneficiary' | 'aid_log' | 'loss'  // compatibility
 *   type: 'beneficiary_registration' | 'aid_distribution' | 'loss_report' // register-style
 *   data: {...},                  // payload to send to server
 *   status: 'pending'|'synced',   // status for human reading (kept for compatibility)
 *   synced: false|true,
 *   createdAt: ISOString,
 *   syncedAt?: ISOString
 * }
 */

const DB_NAME = 'ResilienceHubDB';
const DB_VERSION = 3;
const STORE_NAME = 'offlineQueue';

// Utility: generate offlineId (keeps same style as old main file)
const generateOfflineId = () =>
  `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

export const getDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

// Open DB and create store/indexes if needed
const openDatabase = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('offlineId', 'offlineId', { unique: true });
        store.createIndex('recordType', 'recordType', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('[IndexedDB] Created offlineQueue store and indexes');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error('[IndexedDB] openDatabase error', request.error);
      reject(request.error);
    };
  });

/* ---------------------------
   Core unified queue functions
   --------------------------- */

/**
 * Save generic item to offline queue
 * item: { type?, recordType?, data, timestamp? }
 * returns: inserted record's auto id (number)
 */
export const saveToOfflineQueue = async (item) => {
  try {
    const db = await openDatabase();

    const record = {
      offlineId: item.offlineId || generateOfflineId(),
      // support both naming conventions
      recordType: item.recordType || (item.type === 'beneficiary_registration' ? 'beneficiary' : item.recordType) || undefined,
      type: item.type || (item.recordType === 'beneficiary' ? 'beneficiary_registration' : item.type) || undefined,
      data: item.data || item, // allow passing full payload directly
      status: item.status || 'pending',
      synced: !!item.synced || false,
      createdAt: item.createdAt || new Date().toISOString()
    };

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(record);

      req.onsuccess = () => {
        console.log('[IndexedDB] Saved to offlineQueue id=', req.result, record);
        resolve(req.result);
      };
      req.onerror = () => {
        console.error('[IndexedDB] saveToOfflineQueue error', req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.error('[IndexedDB] saveToOfflineQueue failed', err);
    throw err;
  }
};

/**
 * Get all items (or only unsynced if unSyncedOnly === true)
 * returns array of records
 */
export const getOfflineQueue = async (unSyncedOnly = false) => {
  try {
    const db = await openDatabase();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        let results = req.result || [];
        if (unSyncedOnly) results = results.filter((r) => !r.synced && (r.status === 'pending' || r.status === undefined));
        resolve(results);
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[IndexedDB] getOfflineQueue failed', err);
    throw err;
  }
};

/**
 * Mark a record as synced by auto id OR offlineId
 * Accepts either numeric id or offlineId string
 */
export const markAsSynced = async (identifier) => {
  try {
    const db = await openDatabase();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const handleUpdate = (record) => {
        if (!record) return reject(new Error('Record not found'));
        record.synced = true;
        record.status = 'synced';
        record.syncedAt = new Date().toISOString();
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };

      if (typeof identifier === 'number') {
        const getReq = store.get(identifier);
        getReq.onsuccess = () => handleUpdate(getReq.result);
        getReq.onerror = () => reject(getReq.error);
      } else {
        // search by offlineId
        const index = store.index('offlineId');
        const getReq = index.get(identifier);
        getReq.onsuccess = () => handleUpdate(getReq.result);
        getReq.onerror = () => reject(getReq.error);
      }
    });
  } catch (err) {
    console.error('[IndexedDB] markAsSynced failed', err);
    throw err;
  }
};

/**
 * Delete a record by auto id OR offlineId
 */
export const deleteFromOfflineQueue = async (identifier) => {
  try {
    const db = await openDatabase();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      if (typeof identifier === 'number') {
        const req = store.delete(identifier);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } else {
        // find by offlineId, then delete by id
        const idx = store.index('offlineId');
        const getReq = idx.get(identifier);
        getReq.onsuccess = () => {
          const rec = getReq.result;
          if (!rec) return resolve(false);
          const delReq = store.delete(rec.id);
          delReq.onsuccess = () => resolve(true);
          delReq.onerror = () => reject(delReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      }
    });
  } catch (err) {
    console.error('[IndexedDB] deleteFromOfflineQueue failed', err);
    throw err;
  }
};

/**
 * Clear all synced items from the store
 * returns number deleted
 */
export const clearSyncedItems = async () => {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        let deleted = 0;
        all.forEach((r) => {
          if (r.synced) {
            store.delete(r.id);
            deleted++;
          }
        });
        resolve(deleted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[IndexedDB] clearSyncedItems failed', err);
    throw err;
  }
};

/**
 * Clear all data (for testing) - deletes entire store contents
 */
export const clearAllData = async () => {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => {
        console.log('[IndexedDB] All data cleared');
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[IndexedDB] clearAllData failed', err);
    throw err;
  }
};

/* ---------------------------
   High-level sync function
   --------------------------- */

/**
 * Sync offline items to server.
 * Returns { success: n, failed: m, errors: [...] }
 *
 * The function determines endpoint by:
 * - record.type (like 'beneficiary_registration') OR
 * - record.recordType (like 'beneficiary' / 'aid_log' / 'loss')
 */
export const syncOfflineData = async () => {
  const results = { success: 0, failed: 0, errors: [] };

  try {
    const token = localStorage.getItem('token'); // adjust if your auth is different
    if (!token) {
      throw new Error('No authentication token found');
    }

    // fetch unsynced items
    const queue = await getOfflineQueue(true);
    console.log('[IndexedDB] Starting sync of', queue.length, 'items');

    for (const record of queue) {
      try {
        // Determine endpoint
        let endpoint = '';
        const t = record.type || '';
        const rt = record.recordType || '';

        // Priority: explicit type, then recordType
        if (t === 'beneficiary_registration' || rt === 'beneficiary') {
          endpoint = 'http://localhost:5000/api/beneficiaries/register';
        } else if (t === 'aid_distribution' || rt === 'aid_log') {
          endpoint = 'http://localhost:5000/api/distribution/record';
        } else if (t === 'loss_report' || rt === 'loss') {
          endpoint = 'http://localhost:5000/api/reports/loss';
        } else {
          console.warn('[IndexedDB] Unknown record type for syncing', record);
          results.failed++;
          results.errors.push({ id: record.id, reason: 'unknown type' });
          continue;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(record.data)
        });

        if (res.ok) {
          await markAsSynced(record.id);
          results.success++;
        } else {
          let errMsg = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            errMsg = body.message || JSON.stringify(body);
          } catch (_e) {}
          results.failed++;
          results.errors.push({ id: record.id, status: res.status, message: errMsg });
          console.error('[IndexedDB] Sync failed for', record.id, errMsg);
        }
      } catch (itemErr) {
        results.failed++;
        results.errors.push({ id: record.id, message: itemErr.message || String(itemErr) });
        console.error('[IndexedDB] Sync item error', record.id, itemErr);
      }
    }

    // remove synced items
    await clearSyncedItems();

    console.log('[IndexedDB] Sync completed', results);
    return results;
  } catch (err) {
    console.error('[IndexedDB] syncOfflineData failed', err);
    throw err;
  }
};

/* ---------------------------
   Helpers that mirror original main file API
   (these call the unified store under the hood)
   --------------------------- */

export const STORES = {
  OFFLINE_QUEUE: STORE_NAME
};

// --- Beneficiary helpers (compat) ---
export const queueBeneficiary = async (beneficiaryData) => {
  // keep original shape: recordType 'beneficiary'
  return await saveToOfflineQueue({
    recordType: 'beneficiary',
    type: 'beneficiary_registration',
    data: beneficiaryData
  });
};

export const getPendingBeneficiaries = async () => {
  const all = await getOfflineQueue(true);
  return all.filter((r) => (r.recordType === 'beneficiary' || r.type === 'beneficiary_registration'));
};

export const getAllQueuedBeneficiaries = async () => {
  const all = await getOfflineQueue(false);
  return all.filter((r) => (r.recordType === 'beneficiary' || r.type === 'beneficiary_registration'));
};

export const deleteBeneficiaryFromQueue = async (offlineIdOrId) => {
  return await deleteFromOfflineQueue(offlineIdOrId);
};

// --- Aid helpers (compat) ---
export const queueAidDistribution = async (aidData) => {
  return await saveToOfflineQueue({
    recordType: 'aid_log',
    type: 'aid_distribution',
    data: aidData
  });
};

export const getPendingAidDistributions = async () => {
  const all = await getOfflineQueue(true);
  return all.filter((r) => (r.recordType === 'aid_log' || r.type === 'aid_distribution'));
};

export const deleteAidFromQueue = async (offlineIdOrId) => {
  return await deleteFromOfflineQueue(offlineIdOrId);
};

// --- Loss helpers (compat) ---
export const queueLossReport = async (lossData) => {
  return await saveToOfflineQueue({
    recordType: 'loss',
    type: 'loss_report',
    data: lossData
  });
};

export const getPendingLossReports = async () => {
  const all = await getOfflineQueue(true);
  return all.filter((r) => (r.recordType === 'loss' || r.type === 'loss_report'));
};

export const deleteLossFromQueue = async (offlineIdOrId) => {
  return await deleteFromOfflineQueue(offlineIdOrId);
};

// --- Aggregation helpers ---
export const getAllPendingRecords = async () => {
  // returns all pending (unsynced) records across types
  return await getOfflineQueue(true);
};

export const getSyncQueueStatus = async () => {
  // returns counts similar to your previous main file
  const allQueued = await getOfflineQueue(false);
  const beneficiaries = allQueued.filter(r => r.recordType === 'beneficiary' || r.type === 'beneficiary_registration');
  const aid = allQueued.filter(r => r.recordType === 'aid_log' || r.type === 'aid_distribution');
  const losses = allQueued.filter(r => r.recordType === 'loss' || r.type === 'loss_report');

  const pendingBeneficiaries = beneficiaries.filter(r => !r.synced && (r.status === 'pending' || r.status === undefined)).length;
  const pendingAid = aid.filter(r => !r.synced && (r.status === 'pending' || r.status === undefined)).length;
  const pendingLoss = losses.filter(r => !r.synced && (r.status === 'pending' || r.status === undefined)).length;

  return {
    beneficiaries: { pending: pendingBeneficiaries, total: beneficiaries.length },
    aidLogs: { pending: pendingAid, total: aid.length },
    losses: { pending: pendingLoss, total: losses.length },
    totalPending: pendingBeneficiaries + pendingAid + pendingLoss
  };
};

/**
 * clearSyncedRecords(offlineIds, recordType)
 * Accepts array of offlineIds (string) OR numeric ids
 */
export const clearSyncedRecords = async (offlineIds = [], recordType = undefined) => {
  if (!Array.isArray(offlineIds) || offlineIds.length === 0) return;
  for (const idOrOfflineId of offlineIds) {
    try {
      // find record and delete by id
      // if provided a number -> delete directly
      // if provided string -> assume offlineId
      await deleteFromOfflineQueue(idOrOfflineId);
    } catch (err) {
      console.error('[IndexedDB] clearSyncedRecords failed for', idOrOfflineId, err);
    }
  }
};

/* ---------------------------
   Utility / monitoring
   --------------------------- */

export const getPendingCount = async () => {
  return await getOfflineQueue(true).then(arr => arr.length);
};

/* ---------------------------
   Default export (convenience)
   --------------------------- */
export default {
  STORES,
  openDatabase,
  generateOfflineId,
  getDeviceId,
  saveToOfflineQueue,
  getOfflineQueue,
  markAsSynced,
  deleteFromOfflineQueue,
  clearSyncedItems,
  clearAllData,
  syncOfflineData,
  getPendingCount,
  // compatibility wrappers
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
  clearSyncedRecords
};
