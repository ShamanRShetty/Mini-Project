/**
 * Logger Utility
 * 
 * Provides consistent logging throughout the application.
 * Different log levels for different purposes:
 * - info: General information
 * - warn: Warning messages
 * - error: Error messages
 * - debug: Debugging info (only in development)
 * - audit: Security/audit trail
 * 
 * In production, you might replace this with:
 * - Winston
 * - Bunyan
 * - Pino
 */

const fs = require('fs');
const path = require('path');

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  AUDIT: 4
};

// Current log level (from environment or default to INFO)
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

// Colors for console output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Format log message with timestamp
 * 
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 * @returns {string} Formatted message
 */
function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaString = Object.keys(meta).length > 0 
    ? ` | ${JSON.stringify(meta)}`
    : '';
  
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
}

/**
 * Get color for log level
 * 
 * @param {string} level - Log level
 * @returns {string} ANSI color code
 */
function getColor(level) {
  switch (level.toUpperCase()) {
    case 'DEBUG': return COLORS.cyan;
    case 'INFO': return COLORS.green;
    case 'WARN': return COLORS.yellow;
    case 'ERROR': return COLORS.red;
    case 'AUDIT': return COLORS.magenta;
    default: return COLORS.reset;
  }
}

/**
 * Write to log file (optional)
 * 
 * @param {string} message - Message to write
 */
function writeToFile(message) {
  // Only write to file in production
  if (process.env.NODE_ENV !== 'production') return;
  
  try {
    const logsDir = path.join(__dirname, '..', 'logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Log file path (daily rotation)
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `app-${date}.log`);
    
    // Append to file
    fs.appendFileSync(logFile, message + '\n');
    
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
}

/**
 * Log message at specified level
 * 
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function log(level, message, meta = {}) {
  const levelNum = LOG_LEVELS[level.toUpperCase()];
  
  // Skip if below current log level
  if (levelNum < CURRENT_LEVEL) return;
  
  const formattedMessage = formatMessage(level, message, meta);
  const color = getColor(level);
  
  // Console output with color
  console.log(`${color}${formattedMessage}${COLORS.reset}`);
  
  // File output (no color)
  writeToFile(formattedMessage);
}

/**
 * Debug log - only in development
 * 
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
exports.debug = (message, meta = {}) => {
  log('DEBUG', message, meta);
};

/**
 * Info log - general information
 * 
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
exports.info = (message, meta = {}) => {
  log('INFO', message, meta);
};

/**
 * Warning log
 * 
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
exports.warn = (message, meta = {}) => {
  log('WARN', message, meta);
};

/**
 * Error log
 * 
 * @param {string} message - Log message
 * @param {object|Error} meta - Error object or metadata
 */
exports.error = (message, meta = {}) => {
  // Handle Error objects
  if (meta instanceof Error) {
    meta = {
      message: meta.message,
      stack: meta.stack,
      name: meta.name
    };
  }
  log('ERROR', message, meta);
};

/**
 * Audit log - for security/compliance
 * 
 * @param {string} action - Action performed
 * @param {object} details - Action details
 */
exports.audit = (action, details = {}) => {
  log('AUDIT', action, {
    ...details,
    auditTimestamp: new Date().toISOString()
  });
};

/**
 * Log HTTP request
 * 
 * @param {object} req - Express request object
 * @param {number} statusCode - Response status code
 * @param {number} responseTime - Response time in ms
 */
exports.httpRequest = (req, statusCode, responseTime) => {
  const meta = {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userId: req.user?.id || 'anonymous'
  };
  
  // Use different log level based on status code
  if (statusCode >= 500) {
    log('ERROR', 'HTTP Request', meta);
  } else if (statusCode >= 400) {
    log('WARN', 'HTTP Request', meta);
  } else {
    log('INFO', 'HTTP Request', meta);
  }
};

/**
 * Log sync operation
 * 
 * @param {string} operation - Sync operation
 * @param {object} details - Operation details
 */
exports.sync = (operation, details = {}) => {
  log('INFO', `[SYNC] ${operation}`, details);
};

/**
 * Log blockchain operation
 * 
 * @param {string} operation - Blockchain operation
 * @param {object} details - Operation details
 */
exports.blockchain = (operation, details = {}) => {
  log('INFO', `[BLOCKCHAIN] ${operation}`, details);
};

/**
 * Express middleware for request logging
 */
exports.requestLogger = () => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Log when response finishes
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      exports.httpRequest(req, res.statusCode, responseTime);
    });
    
    next();
  };
};

// Export all
module.exports = exports;