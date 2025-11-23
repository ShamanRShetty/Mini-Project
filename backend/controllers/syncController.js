/**
 * Sync Controller (FINAL FIXED VERSION)
 * 
 * Directly processes records and creates them in database
 */

const Beneficiary = require('../models/Beneficiary');
const AidLog = require('../models/AidLog');
const Loss = require('../models/Loss');
const Ledger = require('../models/Ledger');

/**
 * @route   POST /api/sync/upload
 * @desc    Upload and process offline data immediately
 * @access  Private
 */
exports.upload = async (req, res) => {
  console.log('\n========== SYNC UPLOAD REQUEST ==========');
  
  try {
    const { records, deviceId, deviceInfo } = req.body;
    
    console.log('Received records:', JSON.stringify(records, null, 2));
    console.log('Device ID:', deviceId);
    console.log('User ID:', req.user.id);

    if (!records || !Array.isArray(records) || records.length === 0) {
      console.log('ERROR: No records provided');
      return res.status(400).json({
        success: false,
        message: 'Records array is required'
      });
    }

    const results = {
      success: [],
      failed: [],
      duplicates: []
    };

    // Process each record
    for (const record of records) {
      console.log(`\nProcessing record: ${record.offlineId} (${record.recordType})`);
      
      try {
        // Validate record
        if (!record.offlineId || !record.recordType || !record.data) {
          console.log('ERROR: Missing required fields');
          results.failed.push({
            offlineId: record.offlineId || 'unknown',
            error: 'Missing offlineId, recordType, or data'
          });
          continue;
        }

        // Check for duplicates
        let existingRecord = null;
        
        if (record.recordType === 'beneficiary') {
          existingRecord = await Beneficiary.findOne({ offlineId: record.offlineId });
        } else if (record.recordType === 'aid_log') {
          existingRecord = await AidLog.findOne({ offlineId: record.offlineId });
        } else if (record.recordType === 'loss') {
          existingRecord = await Loss.findOne({ offlineId: record.offlineId });
        }

        if (existingRecord) {
          console.log('DUPLICATE: Record already exists with ID:', existingRecord._id);
          results.duplicates.push({
            offlineId: record.offlineId,
            existingId: existingRecord._id,
            message: 'Already synced'
          });
          continue;
        }

        // Process based on type
        let createdRecord = null;

        if (record.recordType === 'beneficiary') {
          createdRecord = await createBeneficiary(record.data, record.offlineId, req.user.id);
        } else if (record.recordType === 'aid_log') {
          createdRecord = await createAidLog(record.data, record.offlineId, req.user.id);
        } else if (record.recordType === 'loss') {
          createdRecord = await createLoss(record.data, record.offlineId, req.user.id);
        } else {
          throw new Error(`Unknown record type: ${record.recordType}`);
        }

        console.log('SUCCESS: Created record with ID:', createdRecord._id);
        
        results.success.push({
          offlineId: record.offlineId,
          createdId: createdRecord._id,
          recordType: record.recordType
        });

      } catch (error) {
        console.error('ERROR processing record:', error.message);
        results.failed.push({
          offlineId: record.offlineId,
          error: error.message
        });
      }
    }

    console.log('\n========== SYNC RESULTS ==========');
    console.log('Success:', results.success.length);
    console.log('Failed:', results.failed.length);
    console.log('Duplicates:', results.duplicates.length);

    res.json({
      success: true,
      message: `Processed ${records.length} records: ${results.success.length} created, ${results.duplicates.length} duplicates, ${results.failed.length} failed`,
      results
    });

  } catch (error) {
    console.error('SYNC ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Sync failed',
      error: error.message
    });
  }
};

const { saveFaceImage } = require('../utils/saveFaceImage');

/**
 * Create a beneficiary in the database
 */
async function createBeneficiary(data, offlineId, userId) {

  // Accept BOTH online & offline formats
  const faceImageBase64 =
    data.biometric?.faceImageData ||
    data.faceImage ||
    null;

  console.log('Creating beneficiary with data:', JSON.stringify(data, null, 2));

  // Base Data
  const beneficiaryData = {
    name: data.name,
    age: data.age ? parseInt(data.age) : undefined,
    gender: data.gender || 'prefer_not_to_say',
    nationalId: data.nationalId,
    phone: data.phone,
    familySize: data.familySize ? parseInt(data.familySize) : 1,
    dependents: data.dependents ? parseInt(data.dependents) : 0,
    notes: data.notes,
    registeredBy: userId,
    offlineId: offlineId,
    lastSyncedAt: new Date(),
    registrationDate: new Date()
  };

  // Needs Mapping
  if (Array.isArray(data.needs)) {
    const allowed = [
      "food", "water", "shelter", "medicine",
      "clothing", "hygiene", "other"
    ];

    beneficiaryData.needs = data.needs.map(n => {
      const clean = n.toLowerCase().trim();

      if (allowed.includes(clean)) {
        return { type: clean, priority: "medium" };
      }

      if (clean.includes("sanitation")) {
        return { type: "hygiene", priority: "medium" };
      }

      if (clean.includes("baby")) {
        return { type: "other", description: n, priority: "medium" };
      }

      return { type: "other", description: n, priority: "medium" };
    });
  }

  // Address
  if (data.address) {
    beneficiaryData.address = data.address;
  } else if (data.village || data.district || data.region) {
    beneficiaryData.address = {
      village: data.village,
      district: data.district,
      region: data.region
    };
  }

  // GPS
  if (data.latitude && data.longitude) {
    beneficiaryData.location = {
      type: "Point",
      coordinates: [parseFloat(data.longitude), parseFloat(data.latitude)]
    };
  }

  // Save Beneficiary First
  const beneficiary = new Beneficiary(beneficiaryData);
  await beneficiary.save();

  console.log("Beneficiary created:", beneficiary._id, beneficiary.name);

  // -----------------------------------
  // BIOMETRIC SAVE — FIXED
  // -----------------------------------
  if (faceImageBase64) {
    const filePath = saveFaceImage(faceImageBase64, beneficiary._id);

    if (filePath) {
      beneficiary.biometric = {
        faceImagePath: filePath,
        capturedAt: new Date(),
        capturedBy: userId
      };

      await beneficiary.save();
    }
  }

  // Ledger Block
  try {
    await Ledger.addBlock(
      "beneficiary_registration",
      {
        beneficiaryId: beneficiary._id,
        name: beneficiary.name,
        registeredBy: userId,
        offlineId: offlineId,
        syncedAt: new Date()
      },
      userId,
      `Synced beneficiary: ${beneficiary.name}`
    );
  } catch (ledgerError) {
    console.log("Ledger error (non-critical):", ledgerError.message);
  }

  return beneficiary;
}




/**
 * Create an aid log in the database
 */
async function createAidLog(data, offlineId, userId) {
  console.log('Creating aid log with data:', JSON.stringify(data, null, 2));

  const aidLogData = {
    beneficiary: data.beneficiaryId || data.beneficiary,
    items: data.items || [],
    distributedBy: userId,
    distributionDate: data.distributionDate ? new Date(data.distributionDate) : new Date(),
    distributionSite: data.distributionSite || 'Field Distribution',
    verificationMethod: data.verificationMethod || 'manual',
    notes: data.notes,
    offlineId: offlineId,
    createdOffline: true,
    syncedAt: new Date(),
    status: 'completed'
  };

  // Handle location
  if (data.distributionLocation?.latitude && data.distributionLocation?.longitude) {
    aidLogData.distributionLocation = {
      type: 'Point',
      coordinates: [
        parseFloat(data.distributionLocation.longitude),
        parseFloat(data.distributionLocation.latitude)
      ]
    };
  }

  const aidLog = new AidLog(aidLogData);
  await aidLog.save();

  console.log('Aid log created:', aidLog._id);

  // Update beneficiary aid tracking
  if (data.beneficiaryId || data.beneficiary) {
    try {
      await Beneficiary.findByIdAndUpdate(
        data.beneficiaryId || data.beneficiary,
        {
          $set: {
            aidReceived: true,
            lastAidDate: new Date()
          },
          $inc: { aidCount: 1 }
        }
      );
    } catch (updateErr) {
      console.log('Beneficiary update failed (non-critical):', updateErr.message);
    }
  }

  return aidLog;
}

/**
 * Create a loss report in the database
 */
async function createLoss(data, offlineId, userId) {
  console.log('Creating loss with data:', JSON.stringify(data, null, 2));

  const lossData = {
    type: data.type,
    severity: data.severity || 'moderate',
    beneficiary: data.beneficiaryId || data.beneficiary,
    description: data.description,
    incidentDate: data.incidentDate ? new Date(data.incidentDate) : new Date(),
    reportedBy: userId,
    offlineId: offlineId,
    syncedAt: new Date(),
    status: 'reported'
  };

  if (data.latitude && data.longitude) {
    lossData.location = {
      type: 'Point',
      coordinates: [parseFloat(data.longitude), parseFloat(data.latitude)]
    };
  }

  const loss = new Loss(lossData);
  await loss.save();

  console.log('Loss created:', loss._id);

  return loss;
}

/**
 * @route   GET /api/sync/status
 * @desc    Get sync status
 * @access  Private
 */
exports.getStatus = async (req, res) => {
  try {
    const syncedBeneficiaries = await Beneficiary.countDocuments({
      registeredBy: req.user.id,
      offlineId: { $exists: true, $ne: null }
    });

    const syncedAidLogs = await AidLog.countDocuments({
      distributedBy: req.user.id,
      offlineId: { $exists: true, $ne: null }
    });

    res.json({
      success: true,
      stats: {
        syncedBeneficiaries,
        syncedAidLogs,
        totalSynced: syncedBeneficiaries + syncedAidLogs
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting sync status',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/sync/process
 * @desc    Manual process (not needed with direct processing)
 * @access  Private (Admin)
 */
exports.processQueue = async (req, res) => {
  res.json({
    success: true,
    message: 'Records are now processed directly on upload'
  });
};

/**
 * @route   GET /api/sync/pending
 * @desc    Get pending items
 * @access  Private (Admin)
 */
exports.getPending = async (req, res) => {
  res.json({
    success: true,
    count: 0,
    message: 'Records are processed directly - no pending queue',
    items: []
  });
};

/**
 * @route   POST /api/sync/retry-failed
 * @desc    Retry failed items
 * @access  Private (Admin)
 */
exports.retryFailed = async (req, res) => {
  res.json({
    success: true,
    message: 'No retry queue - records are processed directly'
  });
};

module.exports = exports;