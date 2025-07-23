import { prisma } from '../config/database';
import firestoreService from '../services/firestoreService';
import { SubscriptionFrequency } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export const processSubscriptions = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find subscriptions due for delivery today
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
        // Calculate total amount
        const totalAmount = subscription.items.reduce((sum, item) => {
          return sum + (item.quantity * item.pricePerKg);
        }, 0);

        const deliveryCharge = totalAmount < 500 ? 30 : 0; // Free delivery above ₹500
        const finalAmount = totalAmount + deliveryCharge;

        // Generate unique order number
        const orderNumber = `FC${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        // Create order for the subscription
        const order = await prisma.order.create({
          data: {
            orderNumber,
            userId: subscription.userId,
            addressId: subscription.addressId,
            subscriptionId: subscription.id,
            status: 'PENDING',
            totalAmount,
            deliveryCharge,
            finalAmount,
            paymentStatus: 'PENDING',
            orderItems: {
              create: subscription.items.map(item => ({
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
            }
          }
        });

        // Calculate next delivery date
        const nextDelivery = new Date(subscription.nextDelivery);
        switch (subscription.frequency) {
          case SubscriptionFrequency.WEEKLY:
            nextDelivery.setDate(nextDelivery.getDate() + 7);
            break;
          case SubscriptionFrequency.BI_WEEKLY:
            nextDelivery.setDate(nextDelivery.getDate() + 14);
            break;
          case SubscriptionFrequency.MONTHLY:
            nextDelivery.setMonth(nextDelivery.getMonth() + 1);
            break;
        }

        // Update subscription next delivery date
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { nextDelivery }
        });

        // Update order status in Firestore
        await firestoreService.updateOrderStatus({
          orderId: order.id,
          status: 'PENDING',
          timestamp: new Date(),
          message: 'Your subscription order has been created and is being processed.'
        });

        // Send notification to customer
        await firestoreService.createNotification({
          userId: subscription.userId,
          title: '🔄 Subscription Order Created',
          body: `Your subscription order #${orderNumber} has been created for ₹${finalAmount}. Payment link will be sent shortly.`,
          type: 'ORDER_UPDATE',
          data: {
            orderId: order.id,
            orderNumber,
            subscriptionId: subscription.id,
            amount: finalAmount
          },
          read: false
        });

        console.log(`✅ Subscription order created: ${orderNumber} for user ${subscription.user.phoneNumber}`);
      } catch (error) {
        console.error(`❌ Failed to process subscription ${subscription.id}:`, error);
      }
    }

    console.log(`✅ Subscription processing completed. ${subscriptionsDue.length} subscriptions processed.`);
  } catch (error) {
    console.error('❌ Subscription processing job failed:', error);
    throw error;
  }
};