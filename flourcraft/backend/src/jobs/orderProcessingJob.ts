import cron from 'node-cron';
import { prisma } from '../config/database';
import { updateOrderStatus, sendNotification } from '../services/firestoreService';
import { OrderStatus, AlertType, AlertSeverity } from '@prisma/client';

// Run every 5 minutes to check for orders ready for processing
export const startOrderProcessingJob = () => {
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔄 Running order processing job...');
    
    try {
      await processScheduledOrders();
      await checkStockAlerts();
    } catch (error) {
      console.error('❌ Order processing job failed:', error);
    }
  });

  console.log('📅 Order processing job scheduled (every 5 minutes)');
};

// Process orders that are scheduled for status updates
async function processScheduledOrders(): Promise<void> {
  const now = new Date();
  
  // Get orders scheduled for processing
  const scheduledOrders = await prisma.orderProcessingQueue.findMany({
    where: {
      scheduledAt: {
        lte: now
      },
      processedAt: null,
      retryCount: {
        lt: prisma.orderProcessingQueue.fields.maxRetries
      }
    },
    include: {
      order: {
        include: {
          user: true,
          orderItems: {
            include: {
              product: true
            }
          },
          address: true
        }
      },
      flourMill: true
    },
    orderBy: {
      scheduledAt: 'asc'
    }
  });

  console.log(`📦 Found ${scheduledOrders.length} orders ready for processing`);

  for (const queueItem of scheduledOrders) {
    try {
      await processQueueItem(queueItem);
    } catch (error) {
      console.error(`❌ Failed to process order ${queueItem.orderId}:`, error);
      
      // Increment retry count
      await prisma.orderProcessingQueue.update({
        where: { id: queueItem.id },
        data: {
          retryCount: queueItem.retryCount + 1,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date()
        }
      });

      // If max retries reached, mark as failed
      if (queueItem.retryCount + 1 >= queueItem.maxRetries) {
        console.error(`🚨 Order ${queueItem.orderId} failed after ${queueItem.maxRetries} retries`);
        
        // Notify admin about the failure
        await sendNotification({
          userId: 'admin', // You might want to get actual admin user IDs
          title: 'Order Processing Failed',
          body: `Order ${queueItem.order.orderNumber} failed to process automatically`,
          data: {
            orderId: queueItem.orderId,
            orderNumber: queueItem.order.orderNumber,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }
  }
}

// Process individual queue item
async function processQueueItem(queueItem: any): Promise<void> {
  const { order, flourMill } = queueItem;
  
  console.log(`⚙️ Processing order ${order.orderNumber} from ${queueItem.currentStatus} to ${queueItem.targetStatus}`);

  // Handle different status transitions
  switch (queueItem.targetStatus) {
    case OrderStatus.DISPATCHED:
      await handleDispatch(queueItem);
      break;
      
    case OrderStatus.OUT_FOR_DELIVERY:
      await handleOutForDelivery(queueItem);
      break;
      
    default:
      throw new Error(`Unsupported target status: ${queueItem.targetStatus}`);
  }

  // Mark queue item as processed
  await prisma.orderProcessingQueue.update({
    where: { id: queueItem.id },
    data: {
      processedAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log(`✅ Successfully processed order ${order.orderNumber}`);
}

// Handle order dispatch
async function handleDispatch(queueItem: any): Promise<void> {
  const { order, flourMill } = queueItem;

  // Update order status to DISPATCHED
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.DISPATCHED,
      dispatchedAt: new Date()
    }
  });

  // Update Firestore order status
  await updateOrderStatus({
    orderId: order.id,
    status: 'DISPATCHED',
    timestamp: new Date(),
    message: `Your order has been dispatched from ${flourMill.name}! It will be assigned to a delivery partner shortly.`,
    metadata: {
      flourMillName: flourMill.name,
      flourMillId: flourMill.id,
      dispatchedAt: new Date().toISOString(),
      autoProcessed: true,
      grindingDuration: queueItem.metadata?.grindingCompletedAt ? 
        calculateDuration(new Date(queueItem.metadata.grindingCompletedAt), new Date()) : null
    }
  });

  // Send notification to customer
  await sendNotification({
    userId: order.userId,
    title: 'Order Dispatched! 🚀',
    body: `Your order #${order.orderNumber} has been dispatched from ${flourMill.name}`,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'DISPATCHED',
      flourMillName: flourMill.name
    }
  });

  // TODO: Create task for delivery partner assignment
  // This could be another background job or integration with delivery service
  
  console.log(`📦 Order ${order.orderNumber} dispatched from ${flourMill.name}`);
}

// Handle out for delivery status
async function handleOutForDelivery(queueItem: any): Promise<void> {
  const { order, flourMill } = queueItem;

  // Update order status to OUT_FOR_DELIVERY
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.OUT_FOR_DELIVERY
    }
  });

  // Update Firestore order status
  await updateOrderStatus({
    orderId: order.id,
    status: 'OUT_FOR_DELIVERY',
    timestamp: new Date(),
    message: 'Your order is out for delivery! The delivery partner is on the way.',
    metadata: {
      flourMillName: flourMill.name,
      autoProcessed: true,
      outForDeliveryAt: new Date().toISOString()
    }
  });

  // Send notification to customer
  await sendNotification({
    userId: order.userId,
    title: 'Out for Delivery! 🛵',
    body: `Your order #${order.orderNumber} is out for delivery`,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'OUT_FOR_DELIVERY'
    }
  });

  console.log(`🛵 Order ${order.orderNumber} is out for delivery`);
}

// Check for critical stock alerts and notify admin
async function checkStockAlerts(): Promise<void> {
  // Get all critical and high severity unresolved alerts
  const criticalAlerts = await prisma.stockAlert.findMany({
    where: {
      isResolved: false,
      severity: {
        in: [AlertSeverity.CRITICAL, AlertSeverity.HIGH]
      },
      // Only alerts created more than 1 hour ago to avoid spam
      createdAt: {
        lte: new Date(Date.now() - 60 * 60 * 1000)
      }
    },
    include: {
      flourMill: true,
      product: true
    }
  });

  if (criticalAlerts.length === 0) {
    return;
  }

  console.log(`🚨 Found ${criticalAlerts.length} critical stock alerts`);

  // Group alerts by flour mill
  const alertsByMill = criticalAlerts.reduce((acc, alert) => {
    const millId = alert.flourMillId;
    if (!acc[millId]) {
      acc[millId] = {
        mill: alert.flourMill,
        alerts: []
      };
    }
    acc[millId].alerts.push(alert);
    return acc;
  }, {} as Record<string, { mill: any; alerts: any[] }>);

  // Send consolidated notifications for each mill
  for (const [millId, data] of Object.entries(alertsByMill)) {
    const { mill, alerts } = data;
    
    // Get admin users (you might want to filter by relevant admins)
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'ADMIN'
      },
      select: {
        id: true,
        firstName: true,
        email: true
      }
    });

    const criticalCount = alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length;
    const highCount = alerts.filter(a => a.severity === AlertSeverity.HIGH).length;

    const alertMessage = `${mill.name} has stock issues: ${criticalCount} critical, ${highCount} high priority alerts`;

    // Send notification to all admins
    for (const admin of adminUsers) {
      await sendNotification({
        userId: admin.id,
        title: '🚨 Critical Stock Alert',
        body: alertMessage,
        data: {
          type: 'STOCK_ALERT',
          flourMillId: millId,
          flourMillName: mill.name,
          criticalCount: criticalCount.toString(),
          highCount: highCount.toString(),
          alertIds: alerts.map(a => a.id)
        }
      });
    }

    console.log(`📧 Notified ${adminUsers.length} admins about stock alerts for ${mill.name}`);
  }
}

// Create stock alert for admin notification
export async function createStockAlertForAdmin(
  flourMillId: string,
  productId: string,
  currentStock: number,
  threshold: number,
  alertType: AlertType = AlertType.LOW_STOCK
): Promise<void> {
  // Check if recent alert already exists (within last 24 hours)
  const existingAlert = await prisma.stockAlert.findFirst({
    where: {
      flourMillId,
      productId,
      alertType,
      isResolved: false,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    }
  });

  if (existingAlert) {
    // Update existing alert
    await prisma.stockAlert.update({
      where: { id: existingAlert.id },
      data: {
        currentStock,
        threshold,
        updatedAt: new Date()
      }
    });
    return;
  }

  // Create new alert
  let severity = AlertSeverity.MEDIUM;
  
  if (currentStock <= 0) {
    severity = AlertSeverity.CRITICAL;
  } else if (currentStock <= threshold * 0.5) {
    severity = AlertSeverity.HIGH;
  } else if (currentStock <= threshold) {
    severity = AlertSeverity.MEDIUM;
  }

  await prisma.stockAlert.create({
    data: {
      flourMillId,
      productId,
      alertType,
      currentStock,
      threshold,
      severity
    }
  });

  console.log(`🚨 Created ${severity} stock alert for mill ${flourMillId}, product ${productId}`);
}

// Utility function to calculate duration
function calculateDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  }
  return `${diffMinutes}m`;
}

// Function to manually trigger order processing (for testing)
export async function triggerOrderProcessing(): Promise<void> {
  console.log('🔄 Manually triggering order processing...');
  await processScheduledOrders();
  await checkStockAlerts();
  console.log('✅ Manual order processing completed');
}