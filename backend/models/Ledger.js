/**
 * Ledger Model
 * 
 * Blockchain-style immutable ledger for transparency.
 * Each entry is cryptographically linked to the previous one.
 * 
 * How it works:
 * 1. Each record has a hash (unique fingerprint)
 * 2. Each record also stores the hash of the previous record
 * 3. If anyone tries to change an old record, all hashes break
 * 4. This creates an tamper-evident audit trail
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const LedgerSchema = new mongoose.Schema({
  // ========================================
  // BLOCKCHAIN FIELDS
  // ========================================
  
  // Sequential block number (starts at 1, increments)
  blockNumber: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Hash of THIS block
  // Generated from: blockNumber + timestamp + data + prevHash + nonce
  hash: { type: String, required: true },
  
  // Hash of the PREVIOUS block
  // Links this block to the chain
  previousHash: { type: String, required: true },
  
  // Nonce - random number for hash generation
  // (In real blockchain, this would be from proof-of-work)
  nonce: {
    type: Number,
    default: 0
  },
  
  // ========================================
  // TRANSACTION DATA
  // ========================================
  
  transactionType: {
    type: String,
    enum: [
      'aid_distribution',    // Aid given to beneficiary
      'resource_received',   // New supplies received
      'beneficiary_registration', // New beneficiary registered
      'resource_transfer',   // Transfer between locations
      'donation_received',   // Donation from donor
      'verification',        // Verification action
      'system_event'        // Other system events
    ],
    required: true
  },
  
  // Actual transaction data (stored as JSON)
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Hash of just the data (for quick verification)
  dataHash: {
    type: String,
    required: true
  },
  
  // ========================================
  // REFERENCES
  // ========================================
  
  // Link to the actual record (if applicable)
  relatedRecord: {
    model: String, // 'AidLog', 'Beneficiary', 'Resource', etc.
    id: mongoose.Schema.Types.ObjectId
  },
  
  // Who created this entry
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ========================================
  // METADATA
  // ========================================
  
  timestamp: { type: Date, default: Date.now, required: true },
  
  // IP address or device identifier (for audit)
  sourceIdentifier: String,
  
  // Additional verification info
  signature: String, // Digital signature (optional)
  
  // Human-readable description
  description: String,
  
  // Tags for searching
  tags: [String],
  
  // ========================================
  // VERIFICATION
  // ========================================
  
  // Has this block been verified?
  verified: {
    type: Boolean,
    default: false
  },
  
  // When verified
  verifiedAt: Date,
  
  // Who verified
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Number of confirmations (how many blocks after this one)
  confirmations: {
    type: Number,
    default: 0
  }
  
}, {
  timestamps: false // We use our own timestamp field
});

// ========================================
// INDEXES
// ========================================

LedgerSchema.index({ blockNumber: 1 },{unique : true });
LedgerSchema.index({ hash: 1 },{ unique: true });
LedgerSchema.index({ previousHash: 1 });
LedgerSchema.index({ timestamp: -1 });
LedgerSchema.index({ transactionType: 1 });
LedgerSchema.index({ 'relatedRecord.model': 1, 'relatedRecord.id': 1 });

// ========================================
// STATICS (Model-level methods)
// ========================================

/**
 * Get the genesis block (first block in chain)
 */
LedgerSchema.statics.getGenesisBlock = async function() {
  return await this.findOne({ blockNumber: 1 });
};

/**
 * Get the latest block
 */
LedgerSchema.statics.getLatestBlock = async function() {
  return await this.findOne().sort({ blockNumber: -1 });
};

/**
 * Get next block number
 */
LedgerSchema.statics.getNextBlockNumber = async function() {
  const latestBlock = await this.getLatestBlock();
  return latestBlock ? latestBlock.blockNumber + 1 : 1;
};

/**
 * Create genesis block (first block in chain)
 */
LedgerSchema.statics.createGenesisBlock = async function() {
  const existingGenesis = await this.getGenesisBlock();
  if (existingGenesis) {
    throw new Error('Genesis block already exists');
  }
  
  const genesisData = {
    message: 'ResilienceHub Ledger - Genesis Block',
    timestamp: new Date(),
    version: '1.0'
  };
  
  const dataHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(genesisData))
    .digest('hex');
  
  const genesisHash = crypto
    .createHash('sha256')
    .update('1' + Date.now() + dataHash + '0' + '0')
    .digest('hex');
  
  const genesis = new this({
    blockNumber: 1,
    hash: genesisHash,
    previousHash: '0', // Genesis has no previous block
    nonce: 0,
    transactionType: 'system_event',
    data: genesisData,
    dataHash: dataHash,
    timestamp: new Date(),
    description: 'Genesis Block - Start of ResilienceHub Ledger'
  });
  
  return await genesis.save();
};

/**
 * Add new block to chain
 */
LedgerSchema.statics.addBlock = async function(transactionType, data, createdBy, description) {
  // Get latest block
  const latestBlock = await this.getLatestBlock();
  
  // If no blocks exist, create genesis block first
  if (!latestBlock) {
    await this.createGenesisBlock();
    return await this.addBlock(transactionType, data, createdBy, description);
  }
  
  // Calculate next block number
  const blockNumber = latestBlock.blockNumber + 1;
  
  // Hash the data
  const dataHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
  
  // Generate random nonce
  const nonce = Math.floor(Math.random() * 1000000);
  
  // Calculate block hash
  const timestamp = Date.now();
  const hash = crypto
    .createHash('sha256')
    .update(`${blockNumber}${timestamp}${dataHash}${latestBlock.hash}${nonce}`)
    .digest('hex');
  
  // Create new block
  const newBlock = new this({
    blockNumber,
    hash,
    previousHash: latestBlock.hash,
    nonce,
    transactionType,
    data,
    dataHash,
    timestamp: new Date(timestamp),
    createdBy,
    description
  });
  
  return await newBlock.save();
};

/**
 * Verify integrity of entire chain
 */
LedgerSchema.statics.verifyChain = async function() {
  const blocks = await this.find().sort({ blockNumber: 1 });
  
  if (blocks.length === 0) {
    return { valid: true, message: 'Chain is empty' };
  }
  
  // Check genesis block
  if (blocks[0].blockNumber !== 1 || blocks[0].previousHash !== '0') {
    return { valid: false, message: 'Invalid genesis block', blockNumber: 1 };
  }
  
  // Verify each block
  for (let i = 1; i < blocks.length; i++) {
    const currentBlock = blocks[i];
    const previousBlock = blocks[i - 1];
    
    // Check if previousHash matches
    if (currentBlock.previousHash !== previousBlock.hash) {
      return {
        valid: false,
        message: 'Chain broken: previousHash mismatch',
        blockNumber: currentBlock.blockNumber
      };
    }
    
    // Verify current block's hash
    const calculatedHash = crypto
      .createHash('sha256')
      .update(
        `${currentBlock.blockNumber}${currentBlock.timestamp.getTime()}${currentBlock.dataHash}${currentBlock.previousHash}${currentBlock.nonce}`
      )
      .digest('hex');
    
    if (calculatedHash !== currentBlock.hash) {
      return {
        valid: false,
        message: 'Block hash invalid - data may be tampered',
        blockNumber: currentBlock.blockNumber
      };
    }
    
    // Verify data hash
    const calculatedDataHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(currentBlock.data))
      .digest('hex');
    
    if (calculatedDataHash !== currentBlock.dataHash) {
      return {
        valid: false,
        message: 'Data hash invalid - data has been modified',
        blockNumber: currentBlock.blockNumber
      };
    }
  }
  
  return {
    valid: true,
    message: 'Chain is valid',
    totalBlocks: blocks.length
  };
};

/**
 * Get blocks by transaction type
 */
LedgerSchema.statics.getByType = async function(transactionType, limit = 50) {
  return await this.find({ transactionType })
    .sort({ blockNumber: -1 })
    .limit(limit)
    .populate('createdBy', 'name email');
};

/**
 * Search ledger
 */
LedgerSchema.statics.search = async function(query, limit = 50) {
  return await this.find({
    $or: [
      { description: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  })
  .sort({ blockNumber: -1 })
  .limit(limit);
};

// ========================================
// METHODS (Instance methods)
// ========================================

/**
 * Verify this specific block
 */
LedgerSchema.methods.verify = async function() {
  // Recalculate hash
  const calculatedHash = crypto
    .createHash('sha256')
    .update(
      `${this.blockNumber}${this.timestamp.getTime()}${this.dataHash}${this.previousHash}${this.nonce}`
    )
    .digest('hex');
  
  // Check if hash matches
  if (calculatedHash !== this.hash) {
    return { valid: false, message: 'Block hash invalid' };
  }
  
  // Verify data hash
  const calculatedDataHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(this.data))
    .digest('hex');
  
  if (calculatedDataHash !== this.dataHash) {
    return { valid: false, message: 'Data hash invalid' };
  }
  
  // If not genesis, verify previous block exists
  if (this.blockNumber > 1) {
    const previousBlock = await this.constructor.findOne({
      blockNumber: this.blockNumber - 1
    });
    
    if (!previousBlock) {
      return { valid: false, message: 'Previous block not found' };
    }
    
    if (this.previousHash !== previousBlock.hash) {
      return { valid: false, message: 'Previous hash mismatch' };
    }
  }
  
  return { valid: true, message: 'Block is valid' };
};

/**
 * Get human-readable summary
 */
LedgerSchema.methods.getSummary = function() {
  return {
    blockNumber: this.blockNumber,
    hash: this.hash.substring(0, 16) + '...',
    type: this.transactionType,
    timestamp: this.timestamp,
    description: this.description,
    verified: this.verified
  };
};

module.exports = mongoose.model('Ledger', LedgerSchema);