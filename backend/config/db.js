/**
 * Database Connection Configuration
 * 
 * This file handles connecting to MongoDB.
 * It uses Mongoose, which makes working with MongoDB easier.
 */

const mongoose = require('mongoose');

/**
 * connectDB - Establishes connection to MongoDB
 * 
 * How it works:
 * 1. Reads MONGO_URI from .env file
 * 2. Tries to connect to MongoDB
 * 3. If successful, prints success message
 * 4. If fails, prints error and stops the app
 */
const connectDB = async () => {
  try {
    // Get MongoDB connection string from environment variables
    const mongoURI = process.env.MONGO_URI;

    // Check if MONGO_URI exists
    if (!mongoURI) {
      throw new Error('MONGO_URI is not defined in .env file');
    }

    // Mongoose connection options (configuration)
    const options = {
    };

    // Attempt to connect to MongoDB
    const conn = await mongoose.connect(mongoURI, options);

    // Success! Print confirmation with host name
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📁 Database Name: ${conn.connection.name}`);

  } catch (error) {
    // Connection failed - print error and exit
    console.error('❌ MongoDB Connection Error:', error.message);
    
    // Exit the application with failure code
    // Code 1 means "general error"
    process.exit(1);
  }
};

// Export the function so server.js can use it
module.exports = connectDB;