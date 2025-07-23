import { prisma } from '../config/database';
import firestoreService from '../services/firestoreService';
import { sendNotification } from '../config/firebase';

export const dispatchOrders = async () => {
  try {
    const delayHours = parseInt(process.env.DISPATCH_DELAY_HOURS || '1');
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - delayHours);

    // Find orders that completed grinding and are ready for dispatch
    const ordersToDispatch = await prisma.order.findMany({
      where: {
        status: 'GRINDING',
        grindingCompleted: {
          not: null,
          lte: cutoffTime
        }
      },
      include: {
        user: true,
        address: true,
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    if (ordersToDispatch.length === 0) {
      console.log('📦 No orders ready for dispatch');
      return;
    }

    console.log(`📦 Dispatching ${ordersToDispatch.length} orders...`);

    for (const order of ordersToDispatch) {
      try {
        // Update order status to DISPATCHED
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'DISPATCHED',
            dispatchedAt: new Date()
          }
        });

        // Update order status in Firestore for real-time updates
        await firestoreService.updateOrderStatus({
          orderId: order.id,
          status: 'DISPATCHED',
          timestamp: new Date(),
          message: 'Your order has been dispatched and is on its way!'
        });

        // Send notification to customer
        await firestoreService.createNotification({
          userId: order.user.id,
          title: '🚚 Order Dispatched!',
          body: `Your order #${order.orderNumber} has been dispatched and will be delivered soon.`,
          type: 'ORDER_UPDATE',
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: 'DISPATCHED'
          },
          read: false
        });

        console.log(`✅ Order ${order.orderNumber} dispatched successfully`);
      } catch (error) {
        console.error(`❌ Failed to dispatch order ${order.orderNumber}:`, error);
      }
    }

    console.log(`✅ Dispatch job completed. ${ordersToDispatch.length} orders processed.`);
  } catch (error) {
    console.error('❌ Order dispatch job failed:', error);
    throw error;
  }
};