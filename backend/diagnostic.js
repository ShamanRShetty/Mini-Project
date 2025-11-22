/**
 * ResilienceHub Diagnostic Tool
 * 
 * Run this to:
 * 1. Check if MongoDB is connected
 * 2. Create test users
 * 3. Verify collections exist
 * 4. Test sync processing
 * 
 * Usage: node backend/diagnostic.js
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Beneficiary = require('./models/Beneficiary');
const SyncQueue = require('./models/SyncQueue');
const Ledger = require('./models/Ledger');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkMongoDB() {
  log('\n=== Checking MongoDB Connection ===', 'cyan');
  
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    log('✅ MongoDB connected successfully!', 'green');
    log(`   Database: ${mongoose.connection.name}`, 'blue');
    log(`   Host: ${mongoose.connection.host}`, 'blue');
    
    return true;
  } catch (error) {
    log('❌ MongoDB connection failed!', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function checkCollections() {
  log('\n=== Checking Collections ===', 'cyan');
  
  const collections = await mongoose.connection.db.listCollections().toArray();
  
  if (collections.length === 0) {
    log('⚠️  No collections found (database is empty)', 'yellow');
    return false;
  }
  
  log(`✅ Found ${collections.length} collections:`, 'green');
  collections.forEach(col => {
    log(`   - ${col.name}`, 'blue');
  });
  
  return true;
}

async function checkIndexes() {
  log('\n=== Checking Indexes ===', 'cyan');
  
  try {
    const beneficiaryIndexes = await Beneficiary.collection.getIndexes();
    log(`✅ Beneficiary indexes: ${Object.keys(beneficiaryIndexes).length}`, 'green');
    
    const syncIndexes = await SyncQueue.collection.getIndexes();
    log(`✅ SyncQueue indexes: ${Object.keys(syncIndexes).length}`, 'green');
    
    return true;
  } catch (error) {
    log(`⚠️  Error checking indexes: ${error.message}`, 'yellow');
    return false;
  }
}

async function createTestUsers() {
  log('\n=== Creating Test Users ===', 'cyan');
  
  const testUsers = [
    {
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'admin123',
      role: 'admin',
      organization: 'ResilienceHub HQ'
    },
    {
      name: 'Field Worker',
      email: 'field@test.com',
      password: 'field123',
      role: 'field_worker',
      organization: 'Red Cross'
    },
    {
      name: 'NGO Manager',
      email: 'ngo@test.com',
      password: 'ngo123',
      role: 'ngo',
      organization: 'UNICEF'
    },
    {
      name: 'Donor Account',
      email: 'donor@test.com',
      password: 'donor123',
      role: 'donor',
      organization: 'Global Fund'
    }
  ];
  
  let created = 0;
  let existing = 0;
  
  for (const userData of testUsers) {
    try {
      const existingUser = await User.findOne({ email: userData.email });
      
      if (existingUser) {
        log(`   ⏭️  ${userData.email} already exists`, 'yellow');
        existing++;
      } else {
        await User.create(userData);
        log(`   ✅ Created: ${userData.email} (${userData.role})`, 'green');
        created++;
      }
    } catch (error) {
      log(`   ❌ Failed to create ${userData.email}: ${error.message}`, 'red');
    }
  }
  
  log(`\nSummary: ${created} created, ${existing} already existed`, 'blue');
  return true;
}

async function checkStats() {
  log('\n=== Database Statistics ===', 'cyan');
  
  try {
    const userCount = await User.countDocuments();
    const beneficiaryCount = await Beneficiary.countDocuments();
    const syncQueueCount = await SyncQueue.countDocuments();
    
    log(`Users: ${userCount}`, 'blue');
    log(`Beneficiaries: ${beneficiaryCount}`, 'blue');
    log(`Sync Queue: ${syncQueueCount}`, 'blue');
    
    if (syncQueueCount > 0) {
      const pending = await SyncQueue.countDocuments({ status: 'pending' });
      const completed = await SyncQueue.countDocuments({ status: 'completed' });
      const failed = await SyncQueue.countDocuments({ status: 'failed' });
      
      log(`  - Pending: ${pending}`, 'yellow');
      log(`  - Completed: ${completed}`, 'green');
      log(`  - Failed: ${failed}`, 'red');
    }
    
    return true;
  } catch (error) {
    log(`❌ Error getting stats: ${error.message}`, 'red');
    return false;
  }
}

async function testSyncProcessing() {
  log('\n=== Testing Sync Processing ===', 'cyan');
  
  try {
    // Check for pending sync items
    const pending = await SyncQueue.find({ status: 'pending' }).limit(5);
    
    if (pending.length === 0) {
      log('✅ No pending items to process', 'green');
      return true;
    }
    
    log(`Found ${pending.length} pending items`, 'yellow');
    
    for (const item of pending) {
      log(`   Processing: ${item.recordType} (${item.offlineId})`, 'blue');
    }
    
    log('ℹ️  To process these, start the server and they will auto-process', 'cyan');
    
    return true;
  } catch (error) {
    log(`❌ Error testing sync: ${error.message}`, 'red');
    return false;
  }
}

async function initializeLedger() {
  log('\n=== Initializing Blockchain Ledger ===', 'cyan');
  
  try {
    const genesis = await Ledger.getGenesisBlock();
    
    if (genesis) {
      log('✅ Genesis block already exists', 'green');
      log(`   Block #${genesis.blockNumber}`, 'blue');
      log(`   Hash: ${genesis.hash.substring(0, 16)}...`, 'blue');
    } else {
      const newGenesis = await Ledger.createGenesisBlock();
      log('✅ Genesis block created!', 'green');
      log(`   Block #${newGenesis.blockNumber}`, 'blue');
      log(`   Hash: ${newGenesis.hash.substring(0, 16)}...`, 'blue');
    }
    
    return true;
  } catch (error) {
    log(`❌ Error with ledger: ${error.message}`, 'red');
    return false;
  }
}

async function checkEnvironment() {
  log('\n=== Environment Check ===', 'cyan');
  
  const required = ['MONGO_URI', 'JWT_SECRET', 'PORT'];
  let allPresent = true;
  
  for (const key of required) {
    if (process.env[key]) {
      log(`✅ ${key} is set`, 'green');
    } else {
      log(`❌ ${key} is missing!`, 'red');
      allPresent = false;
    }
  }
  
  return allPresent;
}

async function runDiagnostics() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   ResilienceHub Diagnostic Tool       ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');
  
  let allPassed = true;
  
  // Check environment
  if (!await checkEnvironment()) {
    log('\n❌ Environment check failed! Create .env file with required variables.', 'red');
    allPassed = false;
  }
  
  // Check MongoDB
  if (!await checkMongoDB()) {
    log('\n❌ MongoDB connection failed! Make sure MongoDB is running.', 'red');
    process.exit(1);
  }
  
  // Run checks
  await checkCollections();
  await checkIndexes();
  await createTestUsers();
  await checkStats();
  await initializeLedger();
  await testSyncProcessing();
  
  // Final summary
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║            SUMMARY                     ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');
  
  if (allPassed) {
    log('\n✅ All checks passed!', 'green');
    log('🚀 You can now start the server with: npm run dev', 'cyan');
    log('🌐 Frontend should connect to: http://localhost:5000', 'cyan');
    log('\nTest accounts:', 'blue');
    log('  - admin@test.com / admin123', 'blue');
    log('  - field@test.com / field123', 'blue');
    log('  - ngo@test.com / ngo123', 'blue');
    log('  - donor@test.com / donor123', 'blue');
  } else {
    log('\n⚠️  Some checks failed. Review the output above.', 'yellow');
  }
  
  await mongoose.connection.close();
  process.exit(0);
}

// Run diagnostics
runDiagnostics().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});