import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import firestoreService from '../services/firestoreService';
import { SubscriptionFrequency, UserRole } from '@prisma/client';
import { generateUPILinks, generateTransactionReference } from '../utils/payment';

// Get user subscriptions
export const getMySubscriptions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: req.user.id },
    include: {
      address: true,
      items: {
        include: {
          product: true
        }
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          orderItems: {
            include: {
              product: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({
    success: true,
    data: { subscriptions }
  });
});

// Get subscription by ID
export const getSubscriptionById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id } = req.params;

  const subscription = await prisma.subscription.findFirst({
    where: { 
      id,
      userId: req.user.id
    },
    include: {
      address: true,
      items: {
        include: {
          product: true
        }
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          orderItems: {
            include: {
              product: true
            }
          }
        }
      }
    }
  });

  if (!subscription) {
    throw createError('Subscription not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { subscription }
  });
});

// Create new subscription
export const createSubscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { addressId, frequency, items, startDate } = req.body;

  // Validate address belongs to user
  const address = await prisma.address.findFirst({
    where: { 
      id: addressId,
      userId: req.user.id,
      isActive: true
    }
  });

  if (!address) {
    throw createError('Invalid address', 400);
  }

  // Validate items and calculate total
  let totalAmount = 0;
  const validatedItems = [];

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId }
    });

    if (!product || !product.isActive) {
      throw createError(`Product ${item.productId} not found or inactive`, 400);
    }

    if (item.quantity < product.minQuantity || item.quantity > product.maxQuantity) {
      throw createError(
        `Invalid quantity for ${product.name}. Must be between ${product.minQuantity} and ${product.maxQuantity} kg`,
        400
      );
    }

    const itemTotal = item.quantity * product.pricePerKg;
    totalAmount += itemTotal;

    validatedItems.push({
      productId: product.id,
      quantity: item.quantity,
      pricePerKg: product.pricePerKg
    });
  }

  // Calculate next delivery date
  const nextDelivery = calculateNextDeliveryDate(frequency, startDate);

  // Create subscription
  const subscription = await prisma.subscription.create({
    data: {
      userId: req.user.id,
      addressId,
      frequency,
      nextDelivery,
      totalAmount,
      startDate: startDate ? new Date(startDate) : new Date(),
      items: {
        create: validatedItems
      }
    },
    include: {
      address: true,
      items: {
        include: {
          product: true
        }
      }
    }
  });

  // Log activity
  await firestoreService.logActivity({
    userId: req.user.id,
    action: 'SUBSCRIPTION_CREATED',
    details: { subscriptionId: subscription.id, frequency, totalAmount },
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send notification
  await firestoreService.createNotification({
    userId: req.user.id,
    title: '🔄 Subscription Created!',
    body: `Your ${frequency.toLowerCase()} subscription has been set up. Next delivery: ${nextDelivery.toDateString()}`,
    type: 'GENERAL',
    data: {
      subscriptionId: subscription.id,
      nextDelivery: nextDelivery.toISOString()
    },
    read: false
  });

  res.status(201).json({
    success: true,
    message: 'Subscription created successfully',
    data: { subscription }
  });
});

// Update subscription
export const updateSubscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id } = req.params;
  const { addressId, frequency, items } = req.body;

  // Find subscription
  const existingSubscription = await prisma.subscription.findFirst({
    where: { 
      id,
      userId: req.user.id
    }
  });

  if (!existingSubscription) {
    throw createError('Subscription not found', 404);
  }

  if (!existingSubscription.isActive) {
    throw createError('Cannot update inactive subscription', 400);
  }

  const updateData: any = {};

  // Update address if provided
  if (addressId) {
    const address = await prisma.address.findFirst({
      where: { 
        id: addressId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!address) {
      throw createError('Invalid address', 400);
    }

    updateData.addressId = addressId;
  }

  // Update frequency and recalculate next delivery
  if (frequency) {
    updateData.frequency = frequency;
    updateData.nextDelivery = calculateNextDeliveryDate(frequency, existingSubscription.nextDelivery);
  }

  // Update items if provided
  if (items && items.length > 0) {
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product || !product.isActive) {
        throw createError(`Product ${item.productId} not found or inactive`, 400);
      }

      if (item.quantity < product.minQuantity || item.quantity > product.maxQuantity) {
        throw createError(
          `Invalid quantity for ${product.name}. Must be between ${product.minQuantity} and ${product.maxQuantity} kg`,
          400
        );
      }

      const itemTotal = item.quantity * product.pricePerKg;
      totalAmount += itemTotal;

      validatedItems.push({
        productId: product.id,
        quantity: item.quantity,
        pricePerKg: product.pricePerKg
      });
    }

    updateData.totalAmount = totalAmount;

    // Delete existing items and create new ones
    await prisma.subscriptionItem.deleteMany({
      where: { subscriptionId: id }
    });
  }

  // Update subscription
  const subscription = await prisma.subscription.update({
    where: { id },
    data: updateData,
    include: {
      address: true,
      items: {
        include: {
          product: true
        }
      }
    }
  });

  // Create new items if provided
  if (items && items.length > 0) {
    const validatedItems = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });
      
      validatedItems.push({
        subscriptionId: id,
        productId: product!.id,
        quantity: item.quantity,
        pricePerKg: product!.pricePerKg
      });
    }

    await prisma.subscriptionItem.createMany({
      data: validatedItems
    });
  }

  // Fetch updated subscription with items
  const updatedSubscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      address: true,
      items: {
        include: {
          product: true
        }
      }
    }
  });

  // Log activity
  await firestoreService.logActivity({
    userId: req.user.id,
    action: 'SUBSCRIPTION_UPDATED',
    details: { subscriptionId: id },
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(200).json({
    success: true,
    message: 'Subscription updated successfully',
    data: { subscription: updatedSubscription }
  });
});

// Pause subscription
export const pauseSubscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id } = req.params;

  const subscription = await prisma.subscription.findFirst({
    where: { 
      id,
      userId: req.user.id
    }
  });

  if (!subscription) {
    throw createError('Subscription not found', 404);
  }

  if (!subscription.isActive) {
    throw createError('Subscription is already inactive', 400);
  }

  const updatedSubscription = await prisma.subscription.update({
    where: { id },
    data: { isActive: false },
    include: {
      address: true,
      items: {
        include: {
          product: true
        }
      }
    }
  });

  // Log activity
  await firestoreService.logActivity({
    userId: req.user.id,
    action: 'SUBSCRIPTION_PAUSED',
    details: { subscriptionId: id },
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send notification
  await firestoreService.createNotification({
    userId: req.user.id,
    title: '⏸️ Subscription Paused',
    body: 'Your subscription has been paused. You can resume it anytime.',
    type: 'GENERAL',
    data: {
      subscriptionId: id
    },
    read: false
  });

  res.status(200).json({
    success: true,
    message: 'Subscription paused successfully',
    data: { subscription: updatedSubscription }
  });
});

// Resume subscription
export const resumeSubscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id } = req.params;

  const subscription = await prisma.subscription.findFirst({
    where: { 
      id,
      userId: req.user.id
    }
  });

  if (!subscription) {
    throw createError('Subscription not found', 404);
  }

  if (subscription.isActive) {
    throw createError('Subscription is already active', 400);
  }

  // Calculate new next delivery date from today
  const nextDelivery = calculateNextDeliveryDate(subscription.frequency);

  const updatedSubscription = await prisma.subscription.update({
    where: { id },
    data: { 
      isActive: true,
      nextDelivery
    },
    include: {
      address: true,
      items: {
        include: {
          product: true
        }
      }
    }
  });

  // Log activity
  await firestoreService.logActivity({
    userId: req.user.id,
    action: 'SUBSCRIPTION_RESUMED',
    details: { subscriptionId: id, nextDelivery },
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send notification
  await firestoreService.createNotification({
    userId: req.user.id,
    title: '▶️ Subscription Resumed',
    body: `Your subscription has been resumed. Next delivery: ${nextDelivery.toDateString()}`,
    type: 'GENERAL',
    data: {
      subscriptionId: id,
      nextDelivery: nextDelivery.toISOString()
    },
    read: false
  });

  res.status(200).json({
    success: true,
    message: 'Subscription resumed successfully',
    data: { subscription: updatedSubscription }
  });
});

// Cancel subscription
export const cancelSubscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id } = req.params;

  const subscription = await prisma.subscription.findFirst({
    where: { 
      id,
      userId: req.user.id
    }
  });

  if (!subscription) {
    throw createError('Subscription not found', 404);
  }

  // Set end date to today and deactivate
  await prisma.subscription.update({
    where: { id },
    data: { 
      isActive: false,
      endDate: new Date()
    }
  });

  // Log activity
  await firestoreService.logActivity({
    userId: req.user.id,
    action: 'SUBSCRIPTION_CANCELLED',
    details: { subscriptionId: id },
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send notification
  await firestoreService.createNotification({
    userId: req.user.id,
    title: '❌ Subscription Cancelled',
    body: 'Your subscription has been cancelled. We hope to serve you again soon!',
    type: 'GENERAL',
    data: {
      subscriptionId: id
    },
    read: false
  });

  res.status(200).json({
    success: true,
    message: 'Subscription cancelled successfully'
  });
});

// Get upcoming subscription deliveries
export const getUpcomingDeliveries = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { 
      userId: req.user.id,
      isActive: true
    },
    include: {
      address: true,
      items: {
        include: {
          product: true
        }
      }
    },
    orderBy: { nextDelivery: 'asc' }
  });

  const upcomingDeliveries = subscriptions.map(subscription => ({
    subscriptionId: subscription.id,
    nextDelivery: subscription.nextDelivery,
    frequency: subscription.frequency,
    totalAmount: subscription.totalAmount,
    address: subscription.address,
    items: subscription.items
  }));

  res.status(200).json({
    success: true,
    data: { upcomingDeliveries }
  });
});

// Admin: Get all subscriptions
export const getAllSubscriptions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    throw createError('Admin access required', 403);
  }

  const { page = 1, limit = 20, status, frequency } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const where: any = {};
  
  if (status === 'active') {
    where.isActive = true;
  } else if (status === 'inactive') {
    where.isActive = false;
  }

  if (frequency) {
    where.frequency = frequency;
  }

  const [subscriptions, totalCount] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            phoneNumber: true,
            firstName: true,
            lastName: true
          }
        },
        address: true,
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: Number(limit)
    }),
    prisma.subscription.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: {
      subscriptions,
      totalCount,
      currentPage: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit))
    }
  });
});

// Helper function to calculate next delivery date
function calculateNextDeliveryDate(frequency: SubscriptionFrequency, startDate?: Date): Date {
  const baseDate = startDate || new Date();
  const nextDelivery = new Date(baseDate);

  switch (frequency) {
    case SubscriptionFrequency.WEEKLY:
      nextDelivery.setDate(nextDelivery.getDate() + 7);
      break;
    case SubscriptionFrequency.BI_WEEKLY:
      nextDelivery.setDate(nextDelivery.getDate() + 14);
      break;
    case SubscriptionFrequency.MONTHLY:
      nextDelivery.setMonth(nextDelivery.getMonth() + 1);
      break;
    default:
      nextDelivery.setDate(nextDelivery.getDate() + 7);
  }

  return nextDelivery;
}