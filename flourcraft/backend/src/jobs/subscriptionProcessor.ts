import { prisma } from '../config/database';
import firestoreService from '../services/firestoreService';
import { SubscriptionFrequency, OrderStatus, PaymentStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { generateUPILinks, generateTransactionReference } from '../utils/payment';

export const processSubscriptions = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`🔄 Processing subscriptions for date: ${today.toISOString()}`);

    // Find subscriptions due for delivery today or overdue
    const subscriptionsDue = await prisma.subscription.findMany({
      where: {
        isActive: true,
        nextDelivery: {
          lte: today
        }
      },
      include: {
        user: true,
        address: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (subscriptionsDue.length === 0) {
      console.log('🔄 No subscriptions due for processing');
      return;
    }

    console.log(`🔄 Processing ${subscriptionsDue.length} subscriptions...`);

    for (const subscription of subscriptionsDue) {
      try {
        await processSubscription(subscription);
      } catch (error) {
        console.error(`❌ Failed to process subscription ${subscription.id}:`, error);
        
        // Send error notification to user
        await firestoreService.createNotification({
          userId: subscription.userId,
          title: '⚠️ Subscription Processing Error',
          body: 'There was an issue processing your subscription order. Please contact support.',
          type: 'GENERAL',
          data: {
            subscriptionId: subscription.id,
            error: 'processing_failed'
          },
          read: false
        });
      }
    }

    console.log(`✅ Subscription processing completed. ${subscriptionsDue.length} subscriptions processed.`);
  } catch (error) {
    console.error('❌ Subscription processing job failed:', error);
    throw error;
  }
};

async function processSubscription(subscription: any) {
  console.log(`📦 Processing subscription ${subscription.id} for user ${subscription.user.phoneNumber}`);

  // Check if an order for this subscription already exists for today
  const existingOrder = await prisma.order.findFirst({
    where: {
      subscriptionId: subscription.id,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }
  });

  if (existingOrder) {
    console.log(`⏭️ Order already exists for subscription ${subscription.id}`);
    return;
  }

  // Validate all products are still available and active
  for (const item of subscription.items) {
    if (!item.product.isActive) {
      throw new Error(`Product ${item.product.name} is no longer available`);
    }
  }

  // Calculate order totals
  const totalAmount = subscription.items.reduce((sum, item) => {
    return sum + (item.quantity * item.pricePerKg);
  }, 0);

  const deliveryCharge = totalAmount < 500 ? 30 : 0; // Free delivery above ₹500
  const finalAmount = totalAmount + deliveryCharge;

  // Generate unique order number
  const orderNumber = `FC${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // Generate transaction reference for payment
  const transactionRef = generateTransactionReference(orderNumber);

  // Create order for the subscription
  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: subscription.userId,
      addressId: subscription.addressId,
      subscriptionId: subscription.id,
      status: OrderStatus.PENDING,
      totalAmount,
      deliveryCharge,
      finalAmount,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: 'UPI',
      orderItems: {
        create: subscription.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          pricePerKg: item.pricePerKg,
          totalPrice: item.quantity * item.pricePerKg
        }))
      }
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

  // Generate UPI payment links
  const paymentData = {
    recipientUPI: process.env.BUSINESS_UPI_ID || 'flourcraft@paytm',
    recipientName: 'FlourCraft',
    amount: finalAmount,
    transactionNote: `FlourCraft Order ${orderNumber}`,
    transactionRef
  };

  const paymentLinks = generateUPILinks(paymentData);

  // Calculate next delivery date
  const nextDelivery = calculateNextDeliveryDate(subscription.frequency, subscription.nextDelivery);

  // Update subscription next delivery date
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { nextDelivery }
  });

  // Update order status in Firestore
  await firestoreService.updateOrderStatus({
    orderId: order.id,
    status: OrderStatus.PENDING,
    timestamp: new Date(),
    message: 'Your subscription order has been created and is awaiting payment.'
  });

  // Send notification to customer with payment links
  await firestoreService.createNotification({
    userId: subscription.userId,
    title: '🔄 Subscription Order Created',
    body: `Your subscription order #${orderNumber} is ready! Total: ₹${finalAmount}. Complete payment to proceed.`,
    type: 'ORDER_UPDATE',
    data: {
      orderId: order.id,
      orderNumber,
      subscriptionId: subscription.id,
      amount: finalAmount,
      paymentLinks,
      transactionRef
    },
    read: false
  });

  // Send SMS/Email with payment link (if configured)
  await sendPaymentNotification(order, paymentLinks);

  // Set a reminder to check payment status after some time
  await schedulePaymentReminder(order.id, 2); // 2 hours reminder

  console.log(`✅ Subscription order created: ${orderNumber} for user ${subscription.user.phoneNumber}`);
  console.log(`📅 Next delivery scheduled for: ${nextDelivery.toDateString()}`);
}

// Calculate next delivery date based on frequency
function calculateNextDeliveryDate(frequency: SubscriptionFrequency, currentDeliveryDate: Date): Date {
  const nextDelivery = new Date(currentDeliveryDate);

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

// Send payment notification via SMS/Email
async function sendPaymentNotification(order: any, paymentLinks: any) {
  try {
    // Here you would integrate with SMS/Email service
    // For now, we'll log the payment links
    console.log(`💳 Payment links for order ${order.orderNumber}:`);
    console.log(`GPay: ${paymentLinks.gpay}`);
    console.log(`PhonePe: ${paymentLinks.phonepe}`);
    console.log(`Generic UPI: ${paymentLinks.generic}`);

    // TODO: Implement SMS/Email service integration
    // await smsService.sendPaymentLink(order.user.phoneNumber, order.orderNumber, paymentLinks.generic);
    // await emailService.sendPaymentLink(order.user.email, order.orderNumber, paymentLinks);
  } catch (error) {
    console.error('Failed to send payment notification:', error);
  }
}

// Schedule payment reminder
async function schedulePaymentReminder(orderId: string, delayHours: number) {
  try {
    // In a production environment, you might use a job queue like Bull or Agenda
    // For now, we'll set a simple timeout
    setTimeout(async () => {
      await checkAndSendPaymentReminder(orderId);
    }, delayHours * 60 * 60 * 1000);
  } catch (error) {
    console.error('Failed to schedule payment reminder:', error);
  }
}

// Check payment status and send reminder if needed
async function checkAndSendPaymentReminder(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        subscription: true
      }
    });

    if (!order) {
      console.log(`Order ${orderId} not found for payment reminder`);
      return;
    }

    // If payment is still pending, send reminder
    if (order.paymentStatus === PaymentStatus.PENDING) {
      await firestoreService.createNotification({
        userId: order.userId,
        title: '💳 Payment Reminder',
        body: `Your subscription order #${order.orderNumber} is awaiting payment. Complete payment to avoid order cancellation.`,
        type: 'ORDER_UPDATE',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          reminder: true
        },
        read: false
      });

      console.log(`📨 Payment reminder sent for order ${order.orderNumber}`);

      // Schedule order cancellation if payment not received within 24 hours
      await scheduleOrderCancellation(orderId, 22); // 22 more hours (total 24)
    }
  } catch (error) {
    console.error('Failed to send payment reminder:', error);
  }
}

// Schedule automatic order cancellation for unpaid orders
async function scheduleOrderCancellation(orderId: string, delayHours: number) {
  try {
    setTimeout(async () => {
      await cancelUnpaidOrder(orderId);
    }, delayHours * 60 * 60 * 1000);
  } catch (error) {
    console.error('Failed to schedule order cancellation:', error);
  }
}

// Cancel unpaid subscription orders
async function cancelUnpaidOrder(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        subscription: true
      }
    });

    if (!order) {
      console.log(`Order ${orderId} not found for cancellation`);
      return;
    }

    // If payment is still pending after 24 hours, cancel the order
    if (order.paymentStatus === PaymentStatus.PENDING) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED
        }
      });

      // Update order status in Firestore
      await firestoreService.updateOrderStatus({
        orderId: order.id,
        status: OrderStatus.CANCELLED,
        timestamp: new Date(),
        message: 'Order cancelled due to non-payment within 24 hours.'
      });

      // Notify user about cancellation
      await firestoreService.createNotification({
        userId: order.userId,
        title: '❌ Order Cancelled',
        body: `Your subscription order #${order.orderNumber} was cancelled due to non-payment. Your next scheduled delivery remains active.`,
        type: 'ORDER_UPDATE',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          cancelled: true,
          reason: 'non-payment'
        },
        read: false
      });

      console.log(`❌ Cancelled unpaid order ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('Failed to cancel unpaid order:', error);
  }
}

// Handle subscription order payment completion
export const handleSubscriptionPayment = async (orderId: string, transactionId: string) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        subscription: true,
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.paymentStatus !== PaymentStatus.PENDING) {
      throw new Error('Order payment already processed');
    }

    // Update order payment status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.COMPLETED,
        transactionId,
        status: OrderStatus.CONFIRMED
      }
    });

    // Update order status in Firestore
    await firestoreService.updateOrderStatus({
      orderId: order.id,
      status: OrderStatus.CONFIRMED,
      timestamp: new Date(),
      message: 'Payment received! Your order is confirmed and will be processed soon.'
    });

    // Send confirmation notification
    await firestoreService.createNotification({
      userId: order.userId,
      title: '✅ Payment Successful!',
      body: `Payment received for your subscription order #${order.orderNumber}. Your flour will be freshly ground and delivered soon!`,
      type: 'ORDER_UPDATE',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        transactionId,
        status: 'confirmed'
      },
      read: false
    });

    // Assign to nearest flour mill (simplified logic)
    await assignOrderToFlourMill(order);

    console.log(`✅ Subscription order payment processed: ${order.orderNumber}`);
  } catch (error) {
    console.error('Failed to handle subscription payment:', error);
    throw error;
  }
};

// Assign order to the nearest flour mill
async function assignOrderToFlourMill(order: any) {
  try {
    // Simple assignment logic - in production, you'd use geolocation
    const flourMill = await prisma.flourMill.findFirst({
      where: {
        isActive: true,
        // You could add location-based filtering here
      }
    });

    if (flourMill) {
      await prisma.order.update({
        where: { id: order.id },
        data: { flourMillId: flourMill.id }
      });

      console.log(`📍 Order ${order.orderNumber} assigned to flour mill ${flourMill.name}`);
    }
  } catch (error) {
    console.error('Failed to assign order to flour mill:', error);
  }
}

// Get subscription analytics for admin
export const getSubscriptionAnalytics = async () => {
  try {
    const [
      totalSubscriptions,
      activeSubscriptions,
      pausedSubscriptions,
      weeklySubscriptions,
      monthlySubscriptions,
      recentOrders
    ] = await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({ where: { isActive: true } }),
      prisma.subscription.count({ where: { isActive: false } }),
      prisma.subscription.count({ where: { frequency: SubscriptionFrequency.WEEKLY } }),
      prisma.subscription.count({ where: { frequency: SubscriptionFrequency.MONTHLY } }),
      prisma.order.count({
        where: {
          subscriptionId: { not: null },
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 30))
          }
        }
      })
    ]);

    return {
      totalSubscriptions,
      activeSubscriptions,
      pausedSubscriptions,
      weeklySubscriptions,
      monthlySubscriptions,
      recentOrders,
      activePercentage: totalSubscriptions > 0 ? (activeSubscriptions / totalSubscriptions * 100).toFixed(1) : 0
    };
  } catch (error) {
    console.error('Failed to get subscription analytics:', error);
    throw error;
  }
};