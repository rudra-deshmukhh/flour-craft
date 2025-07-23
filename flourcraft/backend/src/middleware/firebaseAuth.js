const { getAuth } = require('firebase-admin/auth');
const firestoreService = require('../services/FirestoreService');

/**
 * Firebase Authentication Middleware
 * Verifies Firebase ID tokens and sets user context
 */
class FirebaseAuthMiddleware {
  constructor() {
    this.auth = getAuth();
  }

  /**
   * Verify Firebase token and set user context
   */
  verifyToken = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'No token provided or invalid format'
        });
      }

      const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify the Firebase ID token
      const decodedToken = await this.auth.verifyIdToken(idToken);
      
      // Set user context
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        name: decodedToken.name || null,
        picture: decodedToken.picture || null,
        role: decodedToken.role || 'CUSTOMER', // Default role
        firebaseUser: decodedToken
      };

      // Log user activity
      await this.logUserActivity(req);

      next();
    } catch (error) {
      console.error('Firebase token verification failed:', error);
      
      let message = 'Invalid token';
      let statusCode = 401;

      if (error.code === 'auth/id-token-expired') {
        message = 'Token has expired';
      } else if (error.code === 'auth/id-token-revoked') {
        message = 'Token has been revoked';
      } else if (error.code === 'auth/invalid-id-token') {
        message = 'Invalid token format';
      }

      return res.status(statusCode).json({
        success: false,
        message,
        code: error.code
      });
    }
  };

  /**
   * Optional authentication - sets user if token is valid, continues if not
   */
  optionalAuth = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // Continue without user context
      }

      const idToken = authHeader.substring(7);
      const decodedToken = await this.auth.verifyIdToken(idToken);
      
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        name: decodedToken.name || null,
        picture: decodedToken.picture || null,
        role: decodedToken.role || 'CUSTOMER',
        firebaseUser: decodedToken
      };

      await this.logUserActivity(req);
    } catch (error) {
      console.warn('Optional auth failed:', error.message);
      // Continue without user context
    }
    
    next();
  };

  /**
   * Role-based authorization middleware
   */
  requireRole = (allowedRoles) => {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Get user role from database (more secure than token claims)
        const userRole = await this.getUserRole(req.user.uid);
        
        if (!allowedRoles.includes(userRole)) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions',
            requiredRoles: allowedRoles,
            userRole
          });
        }

        // Update user role in request context
        req.user.role = userRole;
        next();
      } catch (error) {
        console.error('Role verification failed:', error);
        return res.status(500).json({
          success: false,
          message: 'Role verification failed'
        });
      }
    };
  };

  /**
   * Admin only middleware
   */
  requireAdmin = async (req, res, next) => {
    return this.requireRole(['ADMIN'])(req, res, next);
  };

  /**
   * Customer or admin middleware
   */
  requireCustomerOrAdmin = async (req, res, next) => {
    return this.requireRole(['CUSTOMER', 'ADMIN'])(req, res, next);
  };

  /**
   * Delivery partner or admin middleware
   */
  requireDeliveryPartnerOrAdmin = async (req, res, next) => {
    return this.requireRole(['DELIVERY_PARTNER', 'ADMIN'])(req, res, next);
  };

  /**
   * Flour mill user or admin middleware
   */
  requireFlourMillUserOrAdmin = async (req, res, next) => {
    return this.requireRole(['FLOUR_MILL_USER', 'ADMIN'])(req, res, next);
  };

  /**
   * Ownership validation for resources
   */
  requireOwnership = (resourceField = 'userId') => {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Admin can access any resource
        if (req.user.role === 'ADMIN') {
          return next();
        }

        // Extract resource ID from params or body
        const resourceId = req.params.id || req.body.id;
        const resourceUserId = req.params[resourceField] || req.body[resourceField];

        // Check if user owns the resource
        if (resourceUserId && resourceUserId !== req.user.uid) {
          return res.status(403).json({
            success: false,
            message: 'Access denied - resource not owned by user'
          });
        }

        next();
      } catch (error) {
        console.error('Ownership validation failed:', error);
        return res.status(500).json({
          success: false,
          message: 'Ownership validation failed'
        });
      }
    };
  };

  /**
   * Email verification middleware
   */
  requireEmailVerified = async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!req.user.emailVerified) {
        return res.status(403).json({
          success: false,
          message: 'Email verification required',
          action: 'VERIFY_EMAIL'
        });
      }

      next();
    } catch (error) {
      console.error('Email verification check failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Email verification check failed'
      });
    }
  };

  /**
   * Rate limiting per user
   */
  rateLimitPerUser = (maxRequests = 100, windowMs = 900000) => {
    const requests = new Map();
    
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return next(); // Skip rate limiting for unauthenticated requests
        }

        const userId = req.user.uid;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean up old entries
        if (requests.has(userId)) {
          const userRequests = requests.get(userId);
          const validRequests = userRequests.filter(time => time > windowStart);
          requests.set(userId, validRequests);
        }

        // Check current request count
        const userRequests = requests.get(userId) || [];
        
        if (userRequests.length >= maxRequests) {
          return res.status(429).json({
            success: false,
            message: 'Too many requests',
            retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000)
          });
        }

        // Add current request
        userRequests.push(now);
        requests.set(userId, userRequests);

        next();
      } catch (error) {
        console.error('Rate limiting failed:', error);
        next(); // Continue on rate limiting failure
      }
    };
  };

  /**
   * Custom claims validation
   */
  requireCustomClaim = (claimName, allowedValues) => {
    return async (req, res, next) => {
      try {
        if (!req.user || !req.user.firebaseUser) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const claimValue = req.user.firebaseUser[claimName];
        
        if (!claimValue || !allowedValues.includes(claimValue)) {
          return res.status(403).json({
            success: false,
            message: `Invalid ${claimName} claim`,
            allowedValues
          });
        }

        next();
      } catch (error) {
        console.error('Custom claim validation failed:', error);
        return res.status(500).json({
          success: false,
          message: 'Claim validation failed'
        });
      }
    };
  };

  /**
   * Log user activity for security and analytics
   */
  async logUserActivity(req) {
    try {
      if (!req.user) return;

      const activityData = {
        action: `${req.method} ${req.path}`,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      };

      // Log to Firestore (async, don't wait)
      firestoreService.logActivity(req.user.uid, 'API_REQUEST', activityData)
        .catch(error => console.error('Failed to log activity:', error));
    } catch (error) {
      console.error('Activity logging failed:', error);
    }
  }

  /**
   * Get user role from database
   * This is more secure than relying on token claims
   */
  async getUserRole(uid) {
    try {
      // This should query your user database
      // For now, returning a default role
      // In production, implement based on your user model
      return 'CUSTOMER';
    } catch (error) {
      console.error('Failed to get user role:', error);
      return 'CUSTOMER';
    }
  }

  /**
   * Refresh user custom claims
   */
  async refreshUserClaims(uid, customClaims) {
    try {
      await this.auth.setCustomUserClaims(uid, customClaims);
      console.log(`Custom claims updated for user ${uid}`);
      return true;
    } catch (error) {
      console.error('Failed to update custom claims:', error);
      throw error;
    }
  }

  /**
   * Revoke user tokens (sign out all sessions)
   */
  async revokeUserTokens(uid) {
    try {
      await this.auth.revokeRefreshTokens(uid);
      console.log(`Tokens revoked for user ${uid}`);
      return true;
    } catch (error) {
      console.error('Failed to revoke tokens:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    try {
      const userRecord = await this.auth.getUserByEmail(email);
      return userRecord;
    } catch (error) {
      console.error('Failed to get user by email:', error);
      return null;
    }
  }

  /**
   * Create custom token for server-side authentication
   */
  async createCustomToken(uid, additionalClaims = {}) {
    try {
      const customToken = await this.auth.createCustomToken(uid, additionalClaims);
      return customToken;
    } catch (error) {
      console.error('Failed to create custom token:', error);
      throw error;
    }
  }

  /**
   * Middleware to handle CORS preflight for authenticated routes
   */
  handleCors = (req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
      return res.status(200).end();
    }
    
    next();
  };
}

// Export singleton instance
const firebaseAuth = new FirebaseAuthMiddleware();

module.exports = {
  verifyToken: firebaseAuth.verifyToken,
  optionalAuth: firebaseAuth.optionalAuth,
  requireRole: firebaseAuth.requireRole,
  requireAdmin: firebaseAuth.requireAdmin,
  requireCustomerOrAdmin: firebaseAuth.requireCustomerOrAdmin,
  requireDeliveryPartnerOrAdmin: firebaseAuth.requireDeliveryPartnerOrAdmin,
  requireFlourMillUserOrAdmin: firebaseAuth.requireFlourMillUserOrAdmin,
  requireOwnership: firebaseAuth.requireOwnership,
  requireEmailVerified: firebaseAuth.requireEmailVerified,
  rateLimitPerUser: firebaseAuth.rateLimitPerUser,
  requireCustomClaim: firebaseAuth.requireCustomClaim,
  handleCors: firebaseAuth.handleCors,
  
  // Instance methods
  refreshUserClaims: firebaseAuth.refreshUserClaims.bind(firebaseAuth),
  revokeUserTokens: firebaseAuth.revokeUserTokens.bind(firebaseAuth),
  getUserByEmail: firebaseAuth.getUserByEmail.bind(firebaseAuth),
  createCustomToken: firebaseAuth.createCustomToken.bind(firebaseAuth)
};