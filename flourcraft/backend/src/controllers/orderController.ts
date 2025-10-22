import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { generateUPILinks, generateTransactionReference, verifyPayment } from '../utils/payment';
import { initializeOrderStatus, updateOrderStatus } from '../services/firestoreService';
import { OrderStatus, PaymentStatus, UserRole } from '@prisma/client';

// Create new order
export const createOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { addressId, items, deliverySlot, paymentMethod, notes, discountCode } = req.body;

  // Validate address
  const address = await prisma.address.findFirst({
    where: { 
      id: addressId,
      userId: req.user.id,
      isActive: true
    }
  });

  if (!address) {
    throw createError('Invalid delivery address', 400);
  }

  // Validate and calculate order items
  let totalAmount = 0;
  const orderItems = [];

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

    orderItems.push({
      productId: product.id,
      quantity: item.quantity,
      pricePerKg: product.pricePerKg,
      totalPrice: itemTotal
    });
  }

  // Apply discount if provided
  let discount = 0;
  if (discountCode) {
    const discountResult = await applyDiscountCode(discountCode, totalAmount);
    if (discountResult.isValid) {
      discount = discountResult.discount;
    }
  }

  // Calculate delivery charge
  const deliveryCharge = totalAmount >= 500 ? 0 : 30;
  const finalAmount = totalAmount + deliveryCharge - discount;

  // Generate order number
  const orderNumber = `FC${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // Create order in database
  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: req.user.id,
      addressId,
      status: OrderStatus.PENDING,
      totalAmount,
      deliveryCharge,
      discount,
      finalAmount,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod,
      deliverySlot,
      notes,
      orderItems: {
        create: orderItems
      }
    },
    include: {
      orderItems: {
        include: {
          product: true
        }
      },
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true
        }
      },
      address: true
    }
  });

  // Initialize Firestore order status tracking
  await initializeOrderStatus({
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: req.user.id,
    totalAmount: order.totalAmount,
    items: order.orderItems.map(item => ({
      productName: item.product.name,
      quantity: item.quantity
    })),
    deliveryAddress: `${address.line1}, ${address.city}, ${address.state} - ${address.pincode}`,
    customerName: `${req.user.firstName} ${req.user.lastName}`,
    customerPhone: req.user.phoneNumber
  });

  // Generate payment links
  const transactionRef = generateTransactionReference(orderNumber);
  const paymentData = {
    recipientUPI: process.env.BUSINESS_UPI_ID || 'flourcraft@paytm',
    recipientName: 'FlourCraft',
    amount: finalAmount,
    transactionNote: `FlourCraft Order ${orderNumber}`,
    transactionRef
  };

  const paymentLinks = generateUPILinks(paymentData);

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: {
      order,
      paymentLinks,
      transactionRef
    }
  });
});

// Verify payment and update order status
export const verifyOrderPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id: orderId } = req.params;
  const { transactionId, paymentMethod } = req.body;

  // Find order
  const order = await prisma.order.findFirst({
    where: { 
      id: orderId,
      userId: req.user.id
    },
    include: {
      orderItems: {
        include: {
          product: true
        }
      },
      user: true,
      address: true
    }
  });

  if (!order) {
    throw createError('Order not found', 404);
  }

  if (order.paymentStatus !== PaymentStatus.PENDING) {
    throw createError('Payment already processed for this order', 400);
  }

  // Verify payment (mock verification for now)
  const paymentVerification = await verifyPayment(transactionId, order.finalAmount, order.orderNumber);

  if (!paymentVerification.isValid) {
    throw createError('Payment verification failed', 400);
  }

  // Update order payment status
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: PaymentStatus.COMPLETED,
      transactionId,
      paymentMethod,
      status: OrderStatus.CONFIRMED
    },
    include: {
      orderItems: {
        include: {
          product: true
        }
      },
      user: true,
      address: true
    }
  });

  // Update Firestore order status
  await updateOrderStatus({
    orderId: order.id,
    status: 'CONFIRMED',
    timestamp: new Date(),
    message: 'Payment received! Your order is confirmed and will be processed soon.'
  });

  res.status(200).json({
    success: true,
    message: 'Payment verified and order confirmed',
    data: { order: updatedOrder }
  });
});

// Update order status (for admin/flour mill users)
export const updateOrderStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id: orderId } = req.params;
  const { status, message, location, estimatedDelivery } = req.body;

  // Check permissions
  if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.FLOUR_MILL) {
    throw createError('Insufficient permissions', 403);
  }

  // Find order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      orderItems: {
        include: {
          product: true
        }
      }
    }
  });

  if (!order) {
    throw createError('Order not found', 404);
  }

  // Validate status transition
  const validTransitions = getValidStatusTransitions(order.status);
  if (!validTransitions.includes(status)) {
    throw createError(`Invalid status transition from ${order.status} to ${status}`, 400);
  }

  // Update order in database
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(estimatedDelivery && { estimatedDelivery: new Date(estimatedDelivery) })
    }
  });

  // Update Firestore order status
  await updateOrderStatus({
    orderId: order.id,
    status: mapOrderStatusToFirestore(status),
    timestamp: new Date(),
    message: message || getDefaultStatusMessage(status),
    ...(location && { location }),
    ...(estimatedDelivery && { estimatedDelivery: new Date(estimatedDelivery) })
  });

  res.status(200).json({
    success: true,
    message: 'Order status updated successfully',
    data: { order: updatedOrder }
  });
});

// Get user orders
export const getMyOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { page = 1, limit = 10, status } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const where: any = { userId: req.user.id };
  if (status) {
    where.status = status;
  }

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        orderItems: {
          include: {
            product: true
          }
        },
        address: true
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: Number(limit)
    }),
    prisma.order.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders,
      totalCount,
      currentPage: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit))
    }
  });
});

// Get order by ID
export const getOrderById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id } = req.params;

  const order = await prisma.order.findFirst({
    where: { 
      id,
      userId: req.user.id
    },
    include: {
      orderItems: {
        include: {
          product: true
        }
      },
      address: true,
      subscription: true
    }
  });

  if (!order) {
    throw createError('Order not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { order }
  });
});

// Cancel order
export const cancelOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id: orderId } = req.params;
  const { reason } = req.body;

  const order = await prisma.order.findFirst({
    where: { 
      id: orderId,
      userId: req.user.id
    }
  });

  if (!order) {
    throw createError('Order not found', 404);
  }

  // Check if order can be cancelled
  const cancellableStatuses = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
  if (!cancellableStatuses.includes(order.status)) {
    throw createError('Order cannot be cancelled at this stage', 400);
  }

  // Update order status
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CANCELLED,
      notes: reason ? `${order.notes || ''}\nCancellation reason: ${reason}` : order.notes
    }
  });

  // Update Firestore order status
  await updateOrderStatus({
    orderId: order.id,
    status: 'CANCELLED',
    timestamp: new Date(),
    message: reason ? `Order cancelled by customer. Reason: ${reason}` : 'Order cancelled by customer.'
  });

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: { order: updatedOrder }
  });
});

// Rate order
export const rateOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id: orderId } = req.params;
  const { rating, feedback } = req.body;

  const order = await prisma.order.findFirst({
    where: { 
      id: orderId,
      userId: req.user.id,
      status: OrderStatus.DELIVERED
    }
  });

  if (!order) {
    throw createError('Order not found or not delivered yet', 404);
  }

  // Check if already rated
  const existingRating = await prisma.rating.findFirst({
    where: { orderId }
  });

  if (existingRating) {
    throw createError('Order already rated', 400);
  }

  // Create rating
  await prisma.rating.create({
    data: {
      orderId,
      userId: req.user.id,
      rating,
      feedback
    }
  });

  res.status(201).json({
    success: true,
    message: 'Order rated successfully'
  });
});

// Get order tracking info with Firestore timeline
export const trackOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  const { id: orderId } = req.params;

  const order = await prisma.order.findFirst({
    where: { 
      id: orderId,
      userId: req.user.id
    },
    include: {
      orderItems: {
        include: {
          product: true
        }
      },
      address: true
    }
  });

  if (!order) {
    throw createError('Order not found', 404);
  }

  // Get Firestore timeline
  const { getOrderStatusTimeline } = await import('../services/firestoreService');
  const statusTimeline = await getOrderStatusTimeline(orderId);

  res.status(200).json({
    success: true,
    data: {
      order,
      statusTimeline
    }
  });
});

// Admin: Get all orders
export const getAllOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    throw createError('Admin access required', 403);
  }

  const { page = 1, limit = 20, status, startDate, endDate } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const where: any = {};
  
  if (status) {
    where.status = status;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate as string);
    if (endDate) where.createdAt.lte = new Date(endDate as string);
  }

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true
          }
        },
        orderItems: {
          include: {
            product: true
          }
        },
        address: true
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: Number(limit)
    }),
    prisma.order.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders,
      totalCount,
      currentPage: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit))
    }
  });
});

// Helper functions
function getValidStatusTransitions(currentStatus: OrderStatus): OrderStatus[] {
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.GRINDING, OrderStatus.CANCELLED],
    [OrderStatus.GRINDING]: [OrderStatus.DISPATCHED],
    [OrderStatus.DISPATCHED]: [OrderStatus.OUT_FOR_DELIVERY],
    [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: []
  };

  return transitions[currentStatus] || [];
}

function mapOrderStatusToFirestore(status: OrderStatus): string {
  const mapping: Record<OrderStatus, string> = {
    [OrderStatus.PENDING]: 'ORDER_RECEIVED',
    [OrderStatus.CONFIRMED]: 'CONFIRMED',
    [OrderStatus.GRINDING]: 'GRINDING',
    [OrderStatus.DISPATCHED]: 'DISPATCHED',
    [OrderStatus.OUT_FOR_DELIVERY]: 'OUT_FOR_DELIVERY',
    [OrderStatus.DELIVERED]: 'DELIVERED',
    [OrderStatus.CANCELLED]: 'CANCELLED'
  };

  return mapping[status] || status;
}

function getDefaultStatusMessage(status: OrderStatus): string {
  const messages: Record<OrderStatus, string> = {
    [OrderStatus.PENDING]: 'Order is being processed.',
    [OrderStatus.CONFIRMED]: 'Order confirmed and will be processed soon.',
    [OrderStatus.GRINDING]: 'Your flour is being freshly ground.',
    [OrderStatus.DISPATCHED]: 'Order has been dispatched.',
    [OrderStatus.OUT_FOR_DELIVERY]: 'Order is out for delivery.',
    [OrderStatus.DELIVERED]: 'Order has been delivered successfully.',
    [OrderStatus.CANCELLED]: 'Order has been cancelled.'
  };

  return messages[status] || 'Order status updated.';
}

async function applyDiscountCode(code: string, orderTotal: number): Promise<{
  isValid: boolean;
  discount: number;
  message: string;
}> {
  // Mock discount validation - replace with actual logic
  const validDiscounts: Record<string, { percentage: number; minOrder: number }> = {
    'WELCOME10': { percentage: 10, minOrder: 300 },
    'SAVE20': { percentage: 20, minOrder: 500 },
    'FIRSTORDER': { percentage: 15, minOrder: 200 }
  };

  const discountConfig = validDiscounts[code];
  
  if (!discountConfig) {
    return { isValid: false, discount: 0, message: 'Invalid discount code' };
  }

  if (orderTotal < discountConfig.minOrder) {
    return { 
      isValid: false, 
      discount: 0, 
      message: `Minimum order amount for this code is ₹${discountConfig.minOrder}` 
    };
  }

  const discount = Math.round(orderTotal * discountConfig.percentage / 100);
  
  return {
    isValid: true,
    discount,
    message: `${discountConfig.percentage}% discount applied`
  };
}