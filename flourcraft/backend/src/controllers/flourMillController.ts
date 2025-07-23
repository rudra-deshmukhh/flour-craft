import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { updateOrderStatus } from '../services/firestoreService';
import { OrderStatus, UserRole, AlertType, AlertSeverity } from '@prisma/client';

// Get flour mill dashboard data
export const getDashboard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.FLOUR_MILL_USER) {
    throw createError('Flour mill access required', 403);
  }

  // Get flour mill for the user
  const flourMill = await prisma.flourMill.findUnique({
    where: { userId: req.user.id },
    include: {
      millInventory: {
        include: {
          product: true
        }
      },
      stockAlerts: {
        where: { isResolved: false },
        include: {
          product: true
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!flourMill) {
    throw createError('Flour mill not found for user', 404);
  }

  // Get order statistics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    pendingOrders,
    grindingOrders,
    completedTodayOrders,
    totalOrdersCount,
    lowStockItems
  ] = await Promise.all([
    prisma.order.count({
      where: {
        flourMillId: flourMill.id,
        status: { in: [OrderStatus.CONFIRMED, OrderStatus.GRINDING] }
      }
    }),
    prisma.order.count({
      where: {
        flourMillId: flourMill.id,
        status: OrderStatus.GRINDING
      }
    }),
    prisma.order.count({
      where: {
        flourMillId: flourMill.id,
        status: { in: [OrderStatus.DISPATCHED, OrderStatus.DELIVERED] },
        updatedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    }),
    prisma.order.count({
      where: { flourMillId: flourMill.id }
    }),
    prisma.millInventory.count({
      where: {
        flourMillId: flourMill.id,
        currentStock: {
          lte: prisma.millInventory.fields.minThreshold
        }
      }
    })
  ]);

  res.status(200).json({
    success: true,
    data: {
      flourMill: {
        id: flourMill.id,
        name: flourMill.name,
        address: flourMill.address,
        capacity: flourMill.capacity
      },
      stats: {
        pendingOrders,
        grindingOrders,
        completedTodayOrders,
        totalOrdersCount,
        lowStockItems,
        activeAlerts: flourMill.stockAlerts.length
      },
      inventory: flourMill.millInventory,
      alerts: flourMill.stockAlerts
    }
  });
});

// Get assigned orders for flour mill
export const getAssignedOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.FLOUR_MILL_USER) {
    throw createError('Flour mill access required', 403);
  }

  const { page = 1, limit = 20, status } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  // Get flour mill for the user
  const flourMill = await prisma.flourMill.findUnique({
    where: { userId: req.user.id }
  });

  if (!flourMill) {
    throw createError('Flour mill not found for user', 404);
  }

  const where: any = { flourMillId: flourMill.id };
  
  if (status) {
    where.status = status;
  } else {
    // Default to active orders
    where.status = {
      in: [OrderStatus.CONFIRMED, OrderStatus.GRINDING, OrderStatus.DISPATCHED]
    };
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
        address: true,
        processingQueue: true
      },
      orderBy: { createdAt: 'asc' },
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

// Start grinding process for an order
export const startGrinding = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.FLOUR_MILL_USER) {
    throw createError('Flour mill access required', 403);
  }

  const { orderId } = req.params;

  // Get flour mill for the user
  const flourMill = await prisma.flourMill.findUnique({
    where: { userId: req.user.id }
  });

  if (!flourMill) {
    throw createError('Flour mill not found for user', 404);
  }

  // Get order with items
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      flourMillId: flourMill.id,
      status: OrderStatus.CONFIRMED
    },
    include: {
      orderItems: {
        include: {
          product: true
        }
      }
    }
  });

  if (!order) {
    throw createError('Order not found or not in confirmable state', 404);
  }

  // Check stock availability and reserve stock
  for (const item of order.orderItems) {
    const inventory = await prisma.millInventory.findUnique({
      where: {
        flourMillId_productId: {
          flourMillId: flourMill.id,
          productId: item.productId
        }
      }
    });

    if (!inventory || inventory.currentStock < item.quantity) {
      throw createError(
        `Insufficient stock for ${item.product.name}. Required: ${item.quantity}kg, Available: ${inventory?.currentStock || 0}kg`,
        400
      );
    }

    // Reserve stock by reducing it
    await prisma.millInventory.update({
      where: {
        flourMillId_productId: {
          flourMillId: flourMill.id,
          productId: item.productId
        }
      },
      data: {
        currentStock: {
          decrement: item.quantity
        }
      }
    });

    // Check if stock is below threshold and create alert
    const updatedInventory = await prisma.millInventory.findUnique({
      where: {
        flourMillId_productId: {
          flourMillId: flourMill.id,
          productId: item.productId
        }
      }
    });

    if (updatedInventory && updatedInventory.currentStock <= updatedInventory.minThreshold) {
      await createStockAlert(
        flourMill.id,
        item.productId,
        updatedInventory.currentStock,
        updatedInventory.minThreshold
      );
    }
  }

  // Update order status to GRINDING
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.GRINDING,
      grindingStarted: new Date()
    }
  });

  // Update Firestore order status
  await updateOrderStatus({
    orderId: order.id,
    status: 'GRINDING',
    timestamp: new Date(),
    message: `Grinding started at ${flourMill.name}. Your fresh flour is being prepared.`,
    metadata: {
      flourMillName: flourMill.name,
      flourMillId: flourMill.id,
      grindingStarted: new Date().toISOString()
    }
  });

  res.status(200).json({
    success: true,
    message: 'Grinding process started',
    data: { order: updatedOrder }
  });
});

// Mark grinding as complete
export const completeGrinding = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.FLOUR_MILL_USER) {
    throw createError('Flour mill access required', 403);
  }

  const { orderId } = req.params;
  const { dispatchDelay = 60 } = req.body; // Default 1 hour delay

  // Get flour mill for the user
  const flourMill = await prisma.flourMill.findUnique({
    where: { userId: req.user.id }
  });

  if (!flourMill) {
    throw createError('Flour mill not found for user', 404);
  }

  // Get order
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      flourMillId: flourMill.id,
      status: OrderStatus.GRINDING
    }
  });

  if (!order) {
    throw createError('Order not found or not in grinding state', 404);
  }

  // Update order with grinding completion
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      grindingCompleted: new Date()
    }
  });

  // Schedule automatic dispatch
  const scheduledDispatchTime = new Date();
  scheduledDispatchTime.setMinutes(scheduledDispatchTime.getMinutes() + dispatchDelay);

  await prisma.orderProcessingQueue.create({
    data: {
      orderId: order.id,
      flourMillId: flourMill.id,
      currentStatus: OrderStatus.GRINDING,
      targetStatus: OrderStatus.DISPATCHED,
      scheduledAt: scheduledDispatchTime,
      metadata: {
        dispatchDelay,
        grindingCompletedAt: new Date().toISOString(),
        processedBy: req.user.id
      }
    }
  });

  // Update Firestore order status
  await updateOrderStatus({
    orderId: order.id,
    status: 'GRINDING',
    timestamp: new Date(),
    message: `Grinding completed! Your order will be dispatched in ${dispatchDelay} minutes.`,
    metadata: {
      flourMillName: flourMill.name,
      grindingCompleted: true,
      scheduledDispatch: scheduledDispatchTime.toISOString(),
      dispatchDelay
    }
  });

  res.status(200).json({
    success: true,
    message: 'Grinding completed. Order scheduled for automatic dispatch.',
    data: { 
      order: updatedOrder,
      scheduledDispatchTime
    }
  });
});

// Get mill inventory
export const getInventory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.FLOUR_MILL_USER) {
    throw createError('Flour mill access required', 403);
  }

  // Get flour mill for the user
  const flourMill = await prisma.flourMill.findUnique({
    where: { userId: req.user.id }
  });

  if (!flourMill) {
    throw createError('Flour mill not found for user', 404);
  }

  const inventory = await prisma.millInventory.findMany({
    where: { flourMillId: flourMill.id },
    include: {
      product: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  // Calculate stock levels and warnings
  const inventoryWithAnalysis = inventory.map(item => {
    const stockPercentage = (item.currentStock / item.maxCapacity) * 100;
    const thresholdPercentage = (item.minThreshold / item.maxCapacity) * 100;
    
    let status = 'normal';
    let severity = 'low';
    
    if (item.currentStock <= 0) {
      status = 'out_of_stock';
      severity = 'critical';
    } else if (item.currentStock <= item.minThreshold) {
      status = 'low_stock';
      severity = 'high';
    } else if (stockPercentage < 25) {
      status = 'warning';
      severity = 'medium';
    }

    return {
      ...item,
      analysis: {
        stockPercentage: Number(stockPercentage.toFixed(2)),
        thresholdPercentage: Number(thresholdPercentage.toFixed(2)),
        status,
        severity,
        daysUntilEmpty: item.currentStock > 0 ? calculateDaysUntilEmpty(item.currentStock, flourMill.capacity) : 0
      }
    };
  });

  res.status(200).json({
    success: true,
    data: { inventory: inventoryWithAnalysis }
  });
});

// Update inventory stock
export const updateStock = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.FLOUR_MILL_USER) {
    throw createError('Flour mill access required', 403);
  }

  const { productId } = req.params;
  const { quantity, operation, batchNumber, expiryDate, unitCost } = req.body; // operation: 'add' | 'set'

  // Get flour mill for the user
  const flourMill = await prisma.flourMill.findUnique({
    where: { userId: req.user.id }
  });

  if (!flourMill) {
    throw createError('Flour mill not found for user', 404);
  }

  const inventory = await prisma.millInventory.findUnique({
    where: {
      flourMillId_productId: {
        flourMillId: flourMill.id,
        productId
      }
    }
  });

  if (!inventory) {
    throw createError('Inventory item not found', 404);
  }

  let newStock = inventory.currentStock;
  
  if (operation === 'add') {
    newStock += quantity;
  } else if (operation === 'set') {
    newStock = quantity;
  } else {
    throw createError('Invalid operation. Use "add" or "set"', 400);
  }

  // Ensure stock doesn't exceed capacity
  if (newStock > inventory.maxCapacity) {
    throw createError(`Stock cannot exceed maximum capacity of ${inventory.maxCapacity}kg`, 400);
  }

  // Update inventory
  const updatedInventory = await prisma.millInventory.update({
    where: {
      flourMillId_productId: {
        flourMillId: flourMill.id,
        productId
      }
    },
    data: {
      currentStock: newStock,
      lastRestocked: operation === 'add' ? new Date() : inventory.lastRestocked,
      restockQuantity: operation === 'add' ? quantity : inventory.restockQuantity,
      batchNumber: batchNumber || inventory.batchNumber,
      expiryDate: expiryDate ? new Date(expiryDate) : inventory.expiryDate,
      unitCost: unitCost || inventory.unitCost
    },
    include: {
      product: true
    }
  });

  // Resolve any existing low stock alerts if stock is now above threshold
  if (newStock > inventory.minThreshold) {
    await prisma.stockAlert.updateMany({
      where: {
        flourMillId: flourMill.id,
        productId,
        alertType: AlertType.LOW_STOCK,
        isResolved: false
      },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user.id,
        notes: `Stock replenished to ${newStock}kg`
      }
    });
  }

  res.status(200).json({
    success: true,
    message: 'Inventory updated successfully',
    data: { inventory: updatedInventory }
  });
});

// Get stock alerts
export const getStockAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.FLOUR_MILL_USER) {
    throw createError('Flour mill access required', 403);
  }

  const { resolved = false } = req.query;

  // Get flour mill for the user
  const flourMill = await prisma.flourMill.findUnique({
    where: { userId: req.user.id }
  });

  if (!flourMill) {
    throw createError('Flour mill not found for user', 404);
  }

  const alerts = await prisma.stockAlert.findMany({
    where: {
      flourMillId: flourMill.id,
      isResolved: resolved === 'true'
    },
    include: {
      product: true
    },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({
    success: true,
    data: { alerts }
  });
});

// Resolve stock alert
export const resolveAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.FLOUR_MILL_USER) {
    throw createError('Flour mill access required', 403);
  }

  const { alertId } = req.params;
  const { notes } = req.body;

  // Get flour mill for the user
  const flourMill = await prisma.flourMill.findUnique({
    where: { userId: req.user.id }
  });

  if (!flourMill) {
    throw createError('Flour mill not found for user', 404);
  }

  const alert = await prisma.stockAlert.findFirst({
    where: {
      id: alertId,
      flourMillId: flourMill.id,
      isResolved: false
    }
  });

  if (!alert) {
    throw createError('Alert not found or already resolved', 404);
  }

  const updatedAlert = await prisma.stockAlert.update({
    where: { id: alertId },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy: req.user.id,
      notes
    },
    include: {
      product: true
    }
  });

  res.status(200).json({
    success: true,
    message: 'Alert resolved successfully',
    data: { alert: updatedAlert }
  });
});

// Initialize inventory for all products
export const initializeInventory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== UserRole.FLOUR_MILL_USER) {
    throw createError('Flour mill access required', 403);
  }

  // Get flour mill for the user
  const flourMill = await prisma.flourMill.findUnique({
    where: { userId: req.user.id }
  });

  if (!flourMill) {
    throw createError('Flour mill not found for user', 404);
  }

  // Get all products
  const products = await prisma.product.findMany({
    where: { isActive: true }
  });

  // Create inventory entries for products that don't exist
  const inventoryPromises = products.map(async (product) => {
    const existingInventory = await prisma.millInventory.findUnique({
      where: {
        flourMillId_productId: {
          flourMillId: flourMill.id,
          productId: product.id
        }
      }
    });

    if (!existingInventory) {
      return prisma.millInventory.create({
        data: {
          flourMillId: flourMill.id,
          productId: product.id,
          currentStock: 0,
          minThreshold: 50, // Default threshold
          maxCapacity: 1000 // Default capacity
        }
      });
    }

    return existingInventory;
  });

  await Promise.all(inventoryPromises);

  res.status(200).json({
    success: true,
    message: 'Inventory initialized for all products'
  });
});

// Helper functions
async function createStockAlert(
  flourMillId: string,
  productId: string,
  currentStock: number,
  threshold: number
): Promise<void> {
  // Check if alert already exists for this product
  const existingAlert = await prisma.stockAlert.findFirst({
    where: {
      flourMillId,
      productId,
      alertType: AlertType.LOW_STOCK,
      isResolved: false
    }
  });

  if (existingAlert) {
    // Update existing alert with new stock level
    await prisma.stockAlert.update({
      where: { id: existingAlert.id },
      data: {
        currentStock,
        threshold,
        updatedAt: new Date()
      }
    });
  } else {
    // Create new alert
    await prisma.stockAlert.create({
      data: {
        flourMillId,
        productId,
        alertType: AlertType.LOW_STOCK,
        currentStock,
        threshold,
        severity: currentStock <= 0 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH
      }
    });
  }
}

function calculateDaysUntilEmpty(currentStock: number, dailyConsumption: number): number {
  if (dailyConsumption <= 0) return 999; // If no consumption data, return high number
  return Math.floor(currentStock / dailyConsumption);
}