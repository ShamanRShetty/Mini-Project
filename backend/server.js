/**
 * ResilienceHub Server - FIXED VERSION
 * 
 * Main server file that starts the Express application
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Initialize Express
const app = express();
const path = require('path');
// ========================================
// MIDDLEWARE
// ========================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// CORS - Allow frontend to connect
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ========================================
// ROUTES
// ========================================

// Import route files
const authRoutes = require('./routes/auth');
const beneficiaryRoutes = require('./routes/beneficiaries');
const aidRoutes = require('./routes/aid');
const syncRoutes = require('./routes/sync');
const logisticsRoutes = require('./routes/logistics');
const ledgerRoutes = require('./routes/ledger');
const donorRoutes = require('./routes/donor');
const priorityRoutes = require('./routes/priority');
const trackingRoutes = require('./routes/tracking');


// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
app.use('/api/aid', aidRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/donor', donorRoutes);
app.use('/api/priority', priorityRoutes);
app.use('/api/tracking', trackingRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'ResilienceHub API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start listening
    app.listen(PORT, () => {
      console.log('========================================');
      console.log(`🚀 ResilienceHub Server Running`);
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log('========================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;