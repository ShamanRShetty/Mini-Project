/**
 * Deduplication Utilities
 * 
 * Prevents duplicate beneficiary registrations.
 * Uses multiple strategies to find potential duplicates:
 * 1. Exact national ID match
 * 2. Name similarity
 * 3. Location + name combination
 * 4. Biometric match (if available)
 * 
 * Important for:
 * - Preventing fraud
 * - Ensuring fair aid distribution
 * - Maintaining data quality
 */

const Beneficiary = require('../models/Beneficiary');

/**
 * Check if a beneficiary might be a duplicate
 * 
 * @param {object} newBeneficiary - New beneficiary data
 * @returns {object|null} Potential duplicate or null if none found
 */
exports.deduplicateBeneficiary = async (newBeneficiary) => {
  try {
    // 1. Check for exact national ID match
    if (newBeneficiary.nationalId) {
      const idMatch = await Beneficiary.findOne({
        nationalId: newBeneficiary.nationalId,
        status: { $ne: 'duplicate' }
      });
      
      if (idMatch) {
        console.log(`[DEDUPE] National ID match found: ${newBeneficiary.nationalId}`);
        return idMatch;
      }
    }

    // 2. Check for offline ID match (from sync)
    if (newBeneficiary.offlineId) {
      const offlineMatch = await Beneficiary.findOne({
        offlineId: newBeneficiary.offlineId,
        status: { $ne: 'duplicate' }
      });
      
      if (offlineMatch) {
        console.log(`[DEDUPE] Offline ID match found: ${newBeneficiary.offlineId}`);
        return offlineMatch;
      }
    }

    // 3. Check for name similarity in same district
    if (newBeneficiary.name && newBeneficiary.address?.district) {
      const similarNames = await findSimilarNames(
        newBeneficiary.name,
        newBeneficiary.address.district
      );
      
      if (similarNames.length > 0) {
        // Return first potential duplicate
        console.log(`[DEDUPE] Similar name found: ${similarNames[0].name}`);
        return similarNames[0];
      }
    }

    // 4. Check for nearby location with similar name
    if (newBeneficiary.location?.coordinates) {
      const nearbyMatch = await findNearbyWithSimilarName(
        newBeneficiary.name,
        newBeneficiary.location.coordinates
      );
      
      if (nearbyMatch) {
        console.log(`[DEDUPE] Nearby location match found: ${nearbyMatch.name}`);
        return nearbyMatch;
      }
    }

    // No duplicates found
    return null;

  } catch (error) {
    console.error('Deduplication error:', error);
    // On error, return null to allow registration (fail-safe)
    return null;
  }
};

/**
 * Find beneficiaries with similar names in district
 * 
 * @param {string} name - Name to search
 * @param {string} district - District to search in
 * @returns {array} Array of potential duplicates
 */
async function findSimilarNames(name, district) {
  // Normalize name for comparison
  const normalizedName = normalizeName(name);
  
  // Find beneficiaries in same district
  const candidates = await Beneficiary.find({
    'address.district': district,
    status: { $ne: 'duplicate' }
  }).limit(100);
  
  // Filter by name similarity
  const similar = candidates.filter(candidate => {
    const candidateName = normalizeName(candidate.name);
    const similarity = calculateSimilarity(normalizedName, candidateName);
    return similarity >= 0.8; // 80% similarity threshold
  });
  
  return similar;
}

/**
 * Find nearby beneficiaries with similar names
 * 
 * @param {string} name - Name to search
 * @param {array} coordinates - [longitude, latitude]
 * @returns {object|null} Potential duplicate or null
 */
async function findNearbyWithSimilarName(name, coordinates) {
  // Find beneficiaries within 100 meters
  const nearby = await Beneficiary.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: 100 // meters
      }
    },
    status: { $ne: 'duplicate' }
  }).limit(10);
  
  // Check for similar names
  const normalizedName = normalizeName(name);
  
  for (const candidate of nearby) {
    const candidateName = normalizeName(candidate.name);
    const similarity = calculateSimilarity(normalizedName, candidateName);
    
    if (similarity >= 0.7) { // 70% threshold for nearby matches
      return candidate;
    }
  }
  
  return null;
}

/**
 * Normalize name for comparison
 * - Convert to lowercase
 * - Remove extra spaces
 * - Remove special characters
 * 
 * @param {string} name - Name to normalize
 * @returns {string} Normalized name
 */
function normalizeName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')        // Multiple spaces to single
    .replace(/[^a-z\s]/g, '');   // Remove non-letters
}

/**
 * Calculate string similarity (Levenshtein distance based)
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score 0-1
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings
 * (Minimum edits needed to transform one string to another)
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  // Create matrix
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // Deletion
          dp[i][j - 1],     // Insertion
          dp[i - 1][j - 1]  // Substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Mark beneficiary as duplicate
 * 
 * @param {string} duplicateId - ID of duplicate beneficiary
 * @param {string} originalId - ID of original beneficiary
 * @returns {object} Updated beneficiary
 */
exports.markAsDuplicate = async (duplicateId, originalId) => {
  const duplicate = await Beneficiary.findByIdAndUpdate(
    duplicateId,
    {
      status: 'duplicate',
      notes: `Duplicate of ${originalId}. Marked on ${new Date().toISOString()}`
    },
    { new: true }
  );
  
  return duplicate;
};

/**
 * Get duplicate statistics
 * 
 * @returns {object} Duplicate stats
 */
exports.getDuplicateStats = async () => {
  const stats = await Beneficiary.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const duplicates = await Beneficiary.countDocuments({ status: 'duplicate' });
  const total = await Beneficiary.countDocuments();
  
  return {
    total,
    duplicates,
    duplicateRate: total > 0 ? ((duplicates / total) * 100).toFixed(2) + '%' : '0%',
    byStatus: stats
  };
};

// Export functions
module.exports = exports;