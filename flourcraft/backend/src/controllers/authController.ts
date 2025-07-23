import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { verifyIdToken } from '../config/firebase';
import firestoreService from '../services/firestoreService';
import { UserRole } from '@prisma/client';

// Register or login user with Firebase UID
export const registerOrLogin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { firebaseToken, phoneNumber, firstName, lastName, email, role = 'CUSTOMER' } = req.body;

  if (!firebaseToken || !phoneNumber) {
    throw createError('Firebase token and phone number are required', 400);
  }

  // Verify Firebase token
  const decodedToken = await verifyIdToken(firebaseToken);
  
  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { firebaseUid: decodedToken.uid },
    include: {
      addresses: true,
      flourMill: true,
      deliveryPartner: true
    }
  });

  if (user) {
    // Update last login
    user = await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
      include: {
        addresses: true,
        flourMill: true,
        deliveryPartner: true
      }
    });

    // Log activity
    await firestoreService.logActivity({
      userId: user.id,
      action: 'LOGIN',
      details: { phoneNumber },
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          firebaseUid: user.firebaseUid,
          phoneNumber: user.phoneNumber,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          addresses: user.addresses,
          flourMill: user.flourMill,
          deliveryPartner: user.deliveryPartner,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        isNewUser: false
      }
    });
  }

  // Create new user
  user = await prisma.user.create({
    data: {
      firebaseUid: decodedToken.uid,
      phoneNumber,
      firstName,
      lastName,
      email,
      role: role as UserRole
    },
    include: {
      addresses: true,
      flourMill: true,
      deliveryPartner: true
    }
  });

  // Log registration activity
  await firestoreService.logActivity({
    userId: user.id,
    action: 'REGISTER',
    details: { phoneNumber, role },
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send welcome notification
  await firestoreService.createNotification({
    userId: user.id,
    title: 'Welcome to FlourCraft! 🌾',
    body: 'Thank you for joining us. Start exploring fresh grains for your family.',
    type: 'GENERAL',
    read: false
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        phoneNumber: user.phoneNumber,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        addresses: user.addresses,
        flourMill: user.flourMill,
        deliveryPartner: user.deliveryPartner,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      isNewUser: true
    }
  });
});

// Get current user profile
export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      addresses: {
        where: { isActive: true },
        orderBy: { isDefault: 'desc' }
      },
      flourMill: true,
      deliveryPartner: true,
      _count: {
        select: {
          orders: true,
          subscriptions: { where: { isActive: true } }
        }
      }
    }
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        phoneNumber: user.phoneNumber,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        addresses: user.addresses,
        flourMill: user.flourMill,
        deliveryPartner: user.deliveryPartner,
        orderCount: user._count.orders,
        activeSubscriptions: user._count.subscriptions,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    }
  });
});

// Update user profile
export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { firstName, lastName, email } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      firstName,
      lastName,
      email,
      updatedAt: new Date()
    },
    include: {
      addresses: {
        where: { isActive: true },
        orderBy: { isDefault: 'desc' }
      }
    }
  });

  // Log activity
  await firestoreService.logActivity({
    userId: user.id,
    action: 'PROFILE_UPDATE',
    details: { firstName, lastName, email },
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user }
  });
});

// Delete user account
export const deleteAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  // Check for active orders or subscriptions
  const activeOrders = await prisma.order.count({
    where: {
      userId: req.user.id,
      status: {
        in: ['PENDING', 'CONFIRMED', 'GRINDING', 'DISPATCHED', 'OUT_FOR_DELIVERY']
      }
    }
  });

  const activeSubscriptions = await prisma.subscription.count({
    where: {
      userId: req.user.id,
      isActive: true
    }
  });

  if (activeOrders > 0 || activeSubscriptions > 0) {
    throw createError(
      'Cannot delete account with active orders or subscriptions. Please contact support.',
      400
    );
  }

  // Soft delete user
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      isActive: false,
      email: null, // Clear sensitive data
      firstName: null,
      lastName: null,
      updatedAt: new Date()
    }
  });

  // Log activity
  await firestoreService.logActivity({
    userId: req.user.id,
    action: 'ACCOUNT_DELETED',
    details: {},
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully'
  });
});

// Verify token endpoint (for client-side token validation)
export const verifyToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('Invalid token', 401);
  }

  res.status(200).json({
    success: true,
    message: 'Token is valid',
    data: {
      user: {
        id: req.user.id,
        firebaseUid: req.user.firebaseUid,
        phoneNumber: req.user.phoneNumber,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role
      }
    }
  });
});

// Get user statistics
export const getUserStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const [
    totalOrders,
    completedOrders,
    totalSpent,
    activeSubscriptions,
    totalRatings
  ] = await Promise.all([
    prisma.order.count({
      where: { userId: req.user.id }
    }),
    prisma.order.count({
      where: { 
        userId: req.user.id,
        status: 'DELIVERED'
      }
    }),
    prisma.order.aggregate({
      where: { 
        userId: req.user.id,
        status: 'DELIVERED'
      },
      _sum: { finalAmount: true }
    }),
    prisma.subscription.count({
      where: {
        userId: req.user.id,
        isActive: true
      }
    }),
    prisma.deliveryRating.count({
      where: { userId: req.user.id }
    })
  ]);

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalOrders,
        completedOrders,
        totalSpent: totalSpent._sum.finalAmount || 0,
        activeSubscriptions,
        totalRatings
      }
    }
  });
});