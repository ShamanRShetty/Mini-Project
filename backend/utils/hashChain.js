/**
 * Hash Chain Utilities
 * 
 * Provides cryptographic functions for blockchain-style ledger.
 * Uses SHA-256 hashing algorithm.
 * 
 * Key concepts:
 * - Hash: A unique fingerprint of data (always same length)
 * - Previous Hash: Links current block to previous block
 * - Data Hash: Hash of just the transaction data
 * - Block Hash: Hash of entire block (including previous hash)
 */

const crypto = require('crypto');

/**
 * Create SHA-256 hash of data
 * 
 * @param {string|object} data - Data to hash
 * @returns {string} 64-character hex hash
 * 
 * Example:
 * hashData('hello') => 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b5f...'
 */
exports.hashData = (data) => {
  // Convert object to string if needed
  const stringData = typeof data === 'object' 
    ? JSON.stringify(data) 
    : String(data);
  
  return crypto
    .createHash('sha256')
    .update(stringData)
    .digest('hex');
};

/**
 * Create block hash from block components
 * 
 * @param {number} blockNumber - Sequential block number
 * @param {number} timestamp - Unix timestamp
 * @param {string} dataHash - Hash of block data
 * @param {string} previousHash - Hash of previous block
 * @param {number} nonce - Random number
 * @returns {string} Block hash
 */
exports.createBlockHash = (blockNumber, timestamp, dataHash, previousHash, nonce = 0) => {
  const blockString = `${blockNumber}${timestamp}${dataHash}${previousHash}${nonce}`;
  
  return crypto
    .createHash('sha256')
    .update(blockString)
    .digest('hex');
};

/**
 * Generate random nonce (number used once)
 * Used for additional randomness in block generation
 * 
 * @param {number} max - Maximum value (default 1 million)
 * @returns {number} Random nonce
 */
exports.generateNonce = (max = 1000000) => {
  return Math.floor(Math.random() * max);
};

/**
 * Verify a block's hash is correct
 * 
 * @param {object} block - Block to verify
 * @returns {object} { valid: boolean, message: string }
 */
exports.verifyBlockHash = (block) => {
  // Recalculate hash
  const calculatedHash = exports.createBlockHash(
    block.blockNumber,
    block.timestamp instanceof Date 
      ? block.timestamp.getTime() 
      : block.timestamp,
    block.dataHash,
    block.previousHash,
    block.nonce
  );
  
  // Compare with stored hash
  if (calculatedHash !== block.hash) {
    return {
      valid: false,
      message: 'Block hash does not match calculated hash',
      expected: calculatedHash,
      actual: block.hash
    };
  }
  
  return {
    valid: true,
    message: 'Block hash is valid'
  };
};

/**
 * Verify data hash is correct
 * 
 * @param {object} data - Original data
 * @param {string} dataHash - Stored hash
 * @returns {boolean} True if hash matches
 */
exports.verifyDataHash = (data, dataHash) => {
  const calculatedHash = exports.hashData(data);
  return calculatedHash === dataHash;
};

/**
 * Verify chain integrity between two blocks
 * 
 * @param {object} currentBlock - Current block
 * @param {object} previousBlock - Previous block
 * @returns {object} { valid: boolean, message: string }
 */
exports.verifyChainLink = (currentBlock, previousBlock) => {
  // Genesis block check
  if (currentBlock.blockNumber === 1) {
    if (currentBlock.previousHash !== '0') {
      return {
        valid: false,
        message: 'Genesis block should have previousHash of "0"'
      };
    }
    return { valid: true, message: 'Genesis block is valid' };
  }
  
  // Check previousHash matches
  if (currentBlock.previousHash !== previousBlock.hash) {
    return {
      valid: false,
      message: 'Chain broken: previousHash does not match previous block hash',
      expected: previousBlock.hash,
      actual: currentBlock.previousHash
    };
  }
  
  // Check block numbers are sequential
  if (currentBlock.blockNumber !== previousBlock.blockNumber + 1) {
    return {
      valid: false,
      message: 'Block numbers are not sequential',
      expected: previousBlock.blockNumber + 1,
      actual: currentBlock.blockNumber
    };
  }
  
  return { valid: true, message: 'Chain link is valid' };
};

/**
 * Create a transaction hash (unique identifier for transactions)
 * 
 * @param {object} transactionData - Transaction data
 * @param {Date} timestamp - Transaction timestamp
 * @returns {string} Transaction hash
 */
exports.createTransactionHash = (transactionData, timestamp = new Date()) => {
  const txString = JSON.stringify({
    ...transactionData,
    timestamp: timestamp.getTime(),
    random: crypto.randomBytes(8).toString('hex')
  });
  
  return crypto
    .createHash('sha256')
    .update(txString)
    .digest('hex');
};

/**
 * Create a merkle root from array of hashes
 * (Used for efficiently summarizing many transactions)
 * 
 * @param {string[]} hashes - Array of hashes
 * @returns {string} Merkle root hash
 */
exports.createMerkleRoot = (hashes) => {
  if (hashes.length === 0) {
    return exports.hashData('empty');
  }
  
  if (hashes.length === 1) {
    return hashes[0];
  }
  
  // Create pairs and hash them together
  const nextLevel = [];
  
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = hashes[i + 1] || left; // Duplicate last if odd number
    
    nextLevel.push(exports.hashData(left + right));
  }
  
  // Recurse until we have single root
  return exports.createMerkleRoot(nextLevel);
};

/**
 * Generate a unique identifier
 * 
 * @param {number} length - Length of ID (default 32)
 * @returns {string} Random hex string
 */
exports.generateUniqueId = (length = 32) => {
  return crypto.randomBytes(length / 2).toString('hex');
};

/**
 * Compare two hashes securely (timing-safe)
 * 
 * @param {string} hash1 - First hash
 * @param {string} hash2 - Second hash
 * @returns {boolean} True if hashes match
 */
exports.secureCompare = (hash1, hash2) => {
  if (hash1.length !== hash2.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(hash1, 'hex'),
    Buffer.from(hash2, 'hex')
  );
};

// Export all functions
module.exports = exports;