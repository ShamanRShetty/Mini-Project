/**
 * User Model
 * 
 * Defines the structure of user accounts in MongoDB.
 * Includes password hashing and JWT token generation.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Define the schema (structure) for User documents
const UserSchema = new mongoose.Schema({
  // Basic user info
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true, // Remove whitespace
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true, // No duplicate emails
    lowercase: true, // Convert to lowercase
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password in queries by default
  },
  
  // User role - determines what they can access
  role: {
    type: String,
    enum: ['field_worker', 'ngo', 'admin', 'donor'], // Only these values allowed
    default: 'field_worker'
  },
  
  // Contact info
  phone: {
    type: String,
    trim: true
  },
  
  // Organization they belong to
  organization: {
    type: String,
    trim: true
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Last time user logged in
  lastLogin: {
    type: Date
  },
  
  // Timestamps (createdAt, updatedAt) - Mongoose adds these automatically
}, {
  timestamps: true
});

// ========================================
// MIDDLEWARE - Runs before saving user
// ========================================

/**
 * Hash password before saving to database
 * This runs automatically before .save() or .create()
 */
UserSchema.pre('save', async function(next) {
  // Only hash if password was modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // Generate salt (random string added to password for security)
    const salt = await bcrypt.genSalt(10);
    
    // Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);
    
    next();
  } catch (error) {
    next(error);
  }
});

// ========================================
// METHODS - Custom functions for User
// ========================================

/**
 * Compare entered password with hashed password in database
 * Returns true if passwords match, false otherwise
 */
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Generate JWT token for authentication
 * Token contains user ID and role
 */
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      role: this.role 
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d' // Token expires in 7 days
    }
  );
};

/**
 * Get public user data (without sensitive info)
 * Used when returning user info to frontend
 */
UserSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    organization: this.organization,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

// Export the model so other files can use it
module.exports = mongoose.model('User', UserSchema);