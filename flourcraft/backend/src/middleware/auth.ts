import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../config/firebase';
import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    firebaseUid: string;
    phoneNumber: string;
    email?: string;
    role: UserRole;
    firstName?: string;
    lastName?: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify Firebase token
    const decodedToken = await verifyIdToken(idToken);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: {
        id: true,
        firebaseUid: true,
        phoneNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

export const authorize = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Middleware for admin only routes
export const adminOnly = authorize([UserRole.ADMIN]);

// Middleware for flour mill users
export const flourMillOnly = authorize([UserRole.FLOUR_MILL_USER, UserRole.ADMIN]);

// Middleware for delivery partners
export const deliveryPartnerOnly = authorize([UserRole.DELIVERY_PARTNER, UserRole.ADMIN]);

// Middleware for customers
export const customerOnly = authorize([UserRole.CUSTOMER, UserRole.ADMIN]);

// Optional authentication - doesn't fail if no token provided
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await verifyIdToken(idToken);
    
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: {
        id: true,
        firebaseUid: true,
        phoneNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    if (user && user.isActive) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Continue without authentication on error
    next();
  }
};