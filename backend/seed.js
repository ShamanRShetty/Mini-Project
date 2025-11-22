/**
 * Database Seed Script
 * 
 * Populates MongoDB with test data for development.
 * 
 * Run with: node seed.js
 * 
 * Creates:
 * - 4 test users (admin, field_worker, ngo, donor)
 * - 10 sample beneficiaries
 * - 5 resources (supplies)
 * - 3 aid logs
 * - Genesis block for ledger
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const User = require('./models/User');
const Beneficiary = require('./models/Beneficiary');
const Resource = require('./models/Resource');
const AidLog = require('./models/AidLog');
const Ledger = require('./models/Ledger');
const Loss = require('./models/Loss');
const randomLocation = () => ({
  type: "Point",
  coordinates: [
    -73.9857 + (Math.random() * 0.1 - 0.05),  // longitude
    40.7484 + (Math.random() * 0.1 - 0.05)   // latitude
  ]
});


// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Clear existing data
const clearData = async () => {
  console.log('🧹 Clearing existing data...');
  
  await User.deleteMany({});
  await Beneficiary.deleteMany({});
  await Resource.deleteMany({});
  await AidLog.deleteMany({});
  await Ledger.deleteMany({});
  await Loss.deleteMany({});
  
  console.log('✅ Existing data cleared');
};

// Create test users
const createUsers = async () => {
  console.log('👤 Creating test users...');
  
  const users = [
    {
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'admin123',
      role: 'admin',
      phone: '+1234567890',
      organization: 'ResilienceHub HQ'
    },
    {
      name: 'Field Worker',
      email: 'field@test.com',
      password: 'field123',
      role: 'field_worker',
      phone: '+1234567891',
      organization: 'Relief Team Alpha'
    },
    {
      name: 'NGO Manager',
      email: 'ngo@test.com',
      password: 'ngo123',
      role: 'ngo',
      phone: '+1234567892',
      organization: 'Global Relief Organization'
    },
    {
      name: 'Donor User',
      email: 'donor@test.com',
      password: 'donor123',
      role: 'donor',
      phone: '+1234567893',
      organization: 'Charitable Foundation'
    }
  ];
  
  const createdUsers = await User.create(users);
  console.log(`✅ Created ${createdUsers.length} users`);
  
  return createdUsers;
};

// Create test beneficiaries
const createBeneficiaries = async (fieldWorkerId) => {
  console.log('🏠 Creating test beneficiaries...');
  
  const districts = ['District A', 'District B', 'District C'];
  const needTypes = ['food', 'water', 'shelter', 'medicine', 'clothing'];
  const priorities = ['critical', 'high', 'medium', 'low'];
  
  const beneficiaries = [];
  
  for (let i = 1; i <= 10; i++) {
    beneficiaries.push({
      name: `Beneficiary ${i}`,
      age: 20 + Math.floor(Math.random() * 50),
      gender: i % 2 === 0 ? 'male' : 'female',
      nationalId: `ID${String(i).padStart(6, '0')}`,
      phone: `+123456${String(i).padStart(4, '0')}`,
      familySize: 1 + Math.floor(Math.random() * 6),
      dependents: Math.floor(Math.random() * 3),
      address: {
        village: `Village ${i}`,
        district: districts[i % 3],
        region: 'Central Region'
      },
      location: {
        type: 'Point',
        coordinates: [
          -73.9857 + (Math.random() * 0.1 - 0.05), // Longitude (NYC area)
          40.7484 + (Math.random() * 0.1 - 0.05)   // Latitude
        ]
      },
      needs: [
        {
          type: needTypes[i % 5],
          priority: priorities[i % 4],
          quantity: 1 + Math.floor(Math.random() * 10),
          description: `Urgent need for ${needTypes[i % 5]}`
        }
      ],
      registeredBy: fieldWorkerId,
      verified: i <= 5, // First 5 are verified
      aidReceived: i <= 3, // First 3 have received aid
      aidCount: i <= 3 ? 1 : 0,
      lastAidDate: i <= 3 ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) : null // 10 days ago
    });
  }
  
  const created = await Beneficiary.insertMany(beneficiaries);
  console.log(`✅ Created ${created.length} beneficiaries`);
  
  return created;
};

// Create test resources
// Create test resources
const createResources = async (donorId, adminId) => {
  console.log('📦 Creating test resources...');

  // Use a realistic warehouse longitude/latitude (example coords)
  const warehouseCoordinates = [75.1234, 12.9123]; // [longitude, latitude]

  const resources = [
    {
      name: 'Rice Bags',
      type: 'food',
      subType: 'Dry Food',
      description: '10kg bags of rice',
      quantity: 500,
      unit: 'bags',
      unitValue: 15,
      minimumStock: 50,
      donor: donorId,
      donorName: 'Charitable Foundation',
      storageLocation: {
        warehouseId: 'WH001',
        warehouseName: 'Central Warehouse',
        section: 'A',
        shelf: '1'
      },
      location: {
        type: 'Point',
        coordinates: warehouseCoordinates
      },
      addedBy: adminId,
      status: 'available'
    },
    {
      name: 'Bottled Water',
      type: 'water',
      subType: 'Drinking Water',
      description: '1L bottles of clean water',
      quantity: 1000,
      unit: 'bottles',
      unitValue: 1,
      minimumStock: 100,
      donor: donorId,
      storageLocation: {
        warehouseId: 'WH001',
        warehouseName: 'Central Warehouse',
        section: 'B',
        shelf: '2'
      },
      location: {
        type: 'Point',
        coordinates: warehouseCoordinates
      },
      addedBy: adminId,
      status: 'available'
    },
    {
      name: 'Emergency Tents',
      type: 'shelter',
      subType: 'Family Tent',
      description: '4-person emergency tents',
      quantity: 50,
      unit: 'pieces',
      unitValue: 150,
      minimumStock: 10,
      donor: donorId,
      storageLocation: {
        warehouseId: 'WH001',
        warehouseName: 'Central Warehouse',
        section: 'C',
        shelf: '1'
      },
      location: {
        type: 'Point',
        coordinates: warehouseCoordinates
      },
      addedBy: adminId,
      status: 'available'
    },
    {
      name: 'First Aid Kits',
      type: 'medicine',
      subType: 'Basic Medical',
      description: 'Standard first aid kits',
      quantity: 200,
      unit: 'kits',
      unitValue: 25,
      minimumStock: 20,
      donor: donorId,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      storageLocation: {
        warehouseId: 'WH001',
        warehouseName: 'Central Warehouse',
        section: 'D',
        shelf: '1'
      },
      location: {
        type: 'Point',
        coordinates: warehouseCoordinates
      },
      addedBy: adminId,
      status: 'available'
    },
    {
      name: 'Blankets',
      type: 'clothing',
      subType: 'Bedding',
      description: 'Warm fleece blankets',
      quantity: 300,
      unit: 'pieces',
      unitValue: 10,
      minimumStock: 30,
      donor: donorId,
      storageLocation: {
        warehouseId: 'WH001',
        warehouseName: 'Central Warehouse',
        section: 'E',
        shelf: '1'
      },
      location: {
        type: 'Point',
        coordinates: warehouseCoordinates
      },
      addedBy: adminId,
      status: 'available'
    }
  ];

  const created = await Resource.insertMany(resources);
  console.log(`✅ Created ${created.length} resources`);

  return created;
};


// Create sample aid logs
const createAidLogs = async (beneficiaries, resources, fieldWorkerId, donorId) => {
  console.log('📝 Creating test aid logs...');
  
  const aidLogs = [];
  
  for (let i = 0; i < 3; i++) {
    const beneficiary = beneficiaries[i];
    const resource = resources[i];
    
    aidLogs.push({
      beneficiary: beneficiary._id,
      beneficiarySnapshot: {
        name: beneficiary.name,
        nationalId: beneficiary.nationalId
      },
      items: [
        {
          resourceId: resource._id,
          itemType: resource.type,
          itemName: resource.name,
          quantity: 2,
          unit: resource.unit,
          estimatedValue: resource.unitValue * 2
        }
      ],
      totalValue: resource.unitValue * 2,
      distributedBy: fieldWorkerId,
      distributionDate: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000), // Spread over past 10 days
      distributionSite: 'Central Relief Camp',
      verificationMethod: 'manual',
      donor: donorId,
      status: 'completed'
    });
  }
  
  const created = await AidLog.insertMany(aidLogs);
  console.log(`✅ Created ${created.length} aid logs`);
  
  return created;
};

// Create genesis block
const createGenesisBlock = async () => {
  console.log('⛓️ Creating genesis block...');
  
  try {
    const genesis = await Ledger.createGenesisBlock();
    console.log(`✅ Genesis block created: ${genesis.hash.substring(0, 16)}...`);
    return genesis;
  } catch (error) {
    if (error.message === 'Genesis block already exists') {
      console.log('ℹ️ Genesis block already exists');
      return await Ledger.getGenesisBlock();
    }
    throw error;
  }
};

// Create sample losses
// Create sample losses
const createLosses = async (beneficiaries, fieldWorkerId) => {
  console.log('📋 Creating sample loss reports...');

  const warehouseCoordinates = [75.1234, 12.9123]; // or any valid lon/lat

  const losses = [
    {
      type: 'home_damaged',
      severity: 'severe',
      beneficiary: beneficiaries[0]._id,
      affectedPerson: { name: beneficiaries[0].name },
      propertyDetails: {
        propertyType: 'residential',
        description: 'House partially collapsed',
        estimatedValue: 15000
      },
      description: 'House suffered severe structural damage during the disaster',
      location: {
        type: 'Point',
        coordinates: warehouseCoordinates
      },
      reportedBy: fieldWorkerId,
      incidentDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      verified: true
    },
    {
      type: 'livelihood_lost',
      severity: 'moderate',
      beneficiary: beneficiaries[1]._id,
      affectedPerson: { name: beneficiaries[1].name },
      propertyDetails: {
        propertyType: 'commercial',
        description: 'Small shop destroyed',
        estimatedValue: 5000
      },
      description: 'Family business destroyed in the disaster',
      location: {
        type: 'Point',
        coordinates: warehouseCoordinates
      },
      reportedBy: fieldWorkerId,
      incidentDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      verified: false
    }
  ];

  const created = await Loss.insertMany(losses);
  console.log(`✅ Created ${created.length} loss reports`);

  return created;
};


// Main seed function
const seedDatabase = async () => {
  try {
    console.log('\n🌱 Starting database seeding...\n');
    
    await connectDB();
    await clearData();
    
    // Create users
    const users = await createUsers();
    const admin = users.find(u => u.role === 'admin');
    const fieldWorker = users.find(u => u.role === 'field_worker');
    const donor = users.find(u => u.role === 'donor');
    
    // Create beneficiaries
    const beneficiaries = await createBeneficiaries(fieldWorker._id);
    
    // Create resources
    const resources = await createResources(donor._id, admin._id);
    
    // Create aid logs
    await createAidLogs(beneficiaries, resources, fieldWorker._id, donor._id);
    
    // Create genesis block
    await createGenesisBlock();
    
    // Create losses
    await createLosses(beneficiaries, fieldWorker._id);
    
    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('📋 Test Accounts:');
    console.log('   Admin:        admin@test.com / admin123');
    console.log('   Field Worker: field@test.com / field123');
    console.log('   NGO Manager:  ngo@test.com / ngo123');
    console.log('   Donor:        donor@test.com / donor123');
    console.log('');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Seeding error:', error);
    process.exit(1);
  }
};

// Run seeding
seedDatabase();