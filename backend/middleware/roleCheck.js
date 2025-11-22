/**
 * Role Check Middleware
 * 
 * Restricts access to routes based on user roles.
 * Must be used AFTER the protect middleware.
 * 
 * Available roles:
 * - field_worker: Field workers who register beneficiaries
 * - ngo: NGO staff who manage operations
 * - admin: System administrators with full access
 * - donor: Donors who track their contributions
 * 
 * Usage in routes:
 * router.get('/admin-only', protect, authorize('admin'), controllerFunction);
 * router.get('/multiple-roles', protect, authorize('admin', 'ngo'), controllerFunction);
 */

/**
 * Authorize middleware
 * Checks if user has one of the required roles
 * 
 * @param  {...string} roles - Allowed roles
 * @returns Express middleware function
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user exists (protect middleware should have set this)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - please login first'
      });
    }

    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized to access this resource`,
        requiredRoles: roles,
        yourRole: req.user.role
      });
    }

    // User has valid role, continue
    next();
  };
};

/**
 * Role hierarchy check
 * Allows access if user's role is at or above required level
 * 
 * Hierarchy (lowest to highest):
 * 1. donor
 * 2. field_worker
 * 3. ngo
 * 4. admin
 */
const roleHierarchy = {
  donor: 1,
  field_worker: 2,
  ngo: 3,
  admin: 4
};

exports.authorizeMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - please login first'
      });
    }

    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = roleHierarchy[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Minimum role required: '${minRole}'`,
        yourRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Check if user owns the resource or is admin
 * Useful for routes where users can only modify their own data
 */
exports.authorizeOwnerOrAdmin = (ownerIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - please login first'
      });
    }

    // Admins can access anything
    if (req.user.role === 'admin') {
      return next();
    }

    // Get owner ID from request body or params
    const ownerId = req.body[ownerIdField] || req.params[ownerIdField];

    // Check if user owns the resource
    if (ownerId && ownerId.toString() === req.user.id.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources.'
    });
  };
};

/**
 * Log access for audit purposes
 * Records who accessed what resource
 */
exports.auditLog = (action) => {
  return (req, res, next) => {
    console.log(
      `[AUDIT] ${new Date().toISOString()} | ` +
      `User: ${req.user?.email || 'anonymous'} | ` +
      `Role: ${req.user?.role || 'none'} | ` +
      `Action: ${action} | ` +
      `Path: ${req.originalUrl} | ` +
      `Method: ${req.method}`
    );
    next();
  };
};