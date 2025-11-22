/**
 * Authentication Middleware
 * 
 * Protects routes by verifying JWT tokens.
 * 
 * How it works:
 * 1. Extracts token from Authorization header or cookies
 * 2. Verifies token is valid and not expired
 * 3. Finds user associated with token
 * 4. Attaches user to request object (req.user)
 * 5. If invalid, returns 401 Unauthorized
 * 
 * Usage in routes:
 * router.get('/protected', protect, controllerFunction);
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect middleware
 * Ensures user is authenticated
 */
exports.protect = async (req, res, next) => {
  let token;

  try {
    // Check for token in Authorization header
    // Format: "Bearer <token>"
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Extract token from header
      token = req.headers.authorization.split(' ')[1];
    }
    // Alternatively, check for token in cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // If no token found, deny access
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - no token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by ID from token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - user not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    // Attach user to request object
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization
    };

    // Continue to next middleware/controller
    next();

  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - token expired'
      });
    }

    // Generic error
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

/**
 * Optional authentication
 * Attaches user if token present, but doesn't require it
 * Useful for routes that behave differently for logged-in users
 */
exports.optionalAuth = async (req, res, next) => {
  let token;

  try {
    // Check for token
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // If no token, continue without user
    if (!token) {
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id);

    if (user && user.isActive) {
      req.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization
      };
    }

    next();

  } catch (error) {
    // On any error, just continue without user
    // This is optional auth, so errors don't block the request
    next();
  }
};