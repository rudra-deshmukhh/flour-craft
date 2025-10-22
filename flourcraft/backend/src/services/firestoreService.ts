import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

let db: FirebaseFirestore.Firestore;
let messaging: any;

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  };

  initializeApp({
    credential: cert(serviceAccount as any),
    projectId: process.env.FIREBASE_PROJECT_ID
  });

  db = getFirestore();
  messaging = getMessaging();
  console.log('✅ Firebase Admin initialized');
} else {
  db = getFirestore();
  messaging = getMessaging();
}

// Order Status Types
export interface OrderStatusUpdate {
  orderId: string;
  status: 'ORDER_RECEIVED' | 'CONFIRMED' | 'GRINDING' | 'DISPATCHED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  timestamp: Date;
  message?: string;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  estimatedDelivery?: Date;
  deliveryPartnerId?: string;
  flourMillId?: string;
  metadata?: Record<string, any>;
}

export interface OrderStatusTimeline {
  orderId: string;
  currentStatus: string;
  updates: Array<{
    status: string;
    timestamp: Date;
    message?: string;
    location?: {
      latitude: number;
      longitude: number;
      address: string;
    };
    metadata?: Record<string, any>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// Initialize order status tracking
export const initializeOrderStatus = async (orderData: {
  orderId: string;
  orderNumber: string;
  userId: string;
  totalAmount: number;
  items: Array<{
    productName: string;
    quantity: number;
  }>;
  deliveryAddress: string;
  customerName: string;
  customerPhone: string;
}): Promise<void> => {
  try {
    const orderStatusDoc: OrderStatusTimeline = {
      orderId: orderData.orderId,
      currentStatus: 'ORDER_RECEIVED',
      updates: [{
        status: 'ORDER_RECEIVED',
        timestamp: new Date(),
        message: `Order #${orderData.orderNumber} has been received and is being processed.`
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create order status document
    await db.collection('order_status_updates').doc(orderData.orderId).set(orderStatusDoc);

    // Create user-specific order tracking
    await db.collection('user_orders').doc(orderData.userId).collection('orders').doc(orderData.orderId).set({
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      status: 'ORDER_RECEIVED',
      totalAmount: orderData.totalAmount,
      itemCount: orderData.items.length,
      createdAt: new Date(),
      lastUpdated: new Date()
    });

    // Send initial notification
    await sendOrderStatusNotification(orderData.userId, {
      orderId: orderData.orderId,
      status: 'ORDER_RECEIVED',
      timestamp: new Date(),
      message: `Your order #${orderData.orderNumber} has been received! We're preparing your fresh flour.`
    }, {
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName,
      totalAmount: orderData.totalAmount
    });

    console.log(`✅ Order status initialized for order: ${orderData.orderId}`);
  } catch (error) {
    console.error('❌ Failed to initialize order status:', error);
    throw error;
  }
};

// Update order status with real-time notifications
export const updateOrderStatus = async (statusUpdate: OrderStatusUpdate): Promise<void> => {
  try {
    const { orderId, status, timestamp, message, location, estimatedDelivery, deliveryPartnerId, flourMillId, metadata } = statusUpdate;

    // Get existing order status document
    const orderStatusRef = db.collection('order_status_updates').doc(orderId);
    const orderStatusDoc = await orderStatusRef.get();

    if (!orderStatusDoc.exists) {
      throw new Error(`Order status document not found for order: ${orderId}`);
    }

    const currentData = orderStatusDoc.data() as OrderStatusTimeline;

    // Create new status update
    const newUpdate = {
      status,
      timestamp,
      message: message || getDefaultStatusMessage(status),
      ...(location && { location }),
      ...(metadata && { metadata })
    };

    // Update the document
    const updatedData: Partial<OrderStatusTimeline> = {
      currentStatus: status,
      updates: [...currentData.updates, newUpdate],
      updatedAt: new Date()
    };

    await orderStatusRef.update(updatedData);

    // Update user-specific order tracking
    const userOrderQuery = await db.collectionGroup('orders').where('orderId', '==', orderId).get();
    
    if (!userOrderQuery.empty) {
      const userOrderDoc = userOrderQuery.docs[0];
      await userOrderDoc.ref.update({
        status,
        lastUpdated: new Date(),
        ...(estimatedDelivery && { estimatedDelivery }),
        ...(deliveryPartnerId && { deliveryPartnerId }),
        ...(flourMillId && { flourMillId })
      });

      // Get user ID from the document path
      const userId = userOrderDoc.ref.parent.parent?.id;
      
      if (userId) {
        // Send push notification
        await sendOrderStatusNotification(userId, statusUpdate, {
          orderNumber: currentData.orderId // You might want to store order number in the status document
        });
      }
    }

    // Log status change activity
    await logActivity({
      userId: '', // Will be filled from user order doc
      action: 'ORDER_STATUS_UPDATED',
      details: {
        orderId,
        status,
        previousStatus: currentData.currentStatus,
        message
      },
      timestamp,
      ipAddress: '',
      userAgent: 'system'
    });

    console.log(`✅ Order status updated: ${orderId} -> ${status}`);
  } catch (error) {
    console.error('❌ Failed to update order status:', error);
    throw error;
  }
};

// Get order status timeline
export const getOrderStatusTimeline = async (orderId: string): Promise<OrderStatusTimeline | null> => {
  try {
    const orderStatusDoc = await db.collection('order_status_updates').doc(orderId).get();
    
    if (!orderStatusDoc.exists) {
      return null;
    }

    return orderStatusDoc.data() as OrderStatusTimeline;
  } catch (error) {
    console.error('❌ Failed to get order status timeline:', error);
    throw error;
  }
};

// Listen to order status changes (for server-side operations)
export const listenToOrderStatus = (orderId: string, callback: (statusTimeline: OrderStatusTimeline) => void): (() => void) => {
  const unsubscribe = db.collection('order_status_updates').doc(orderId)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data() as OrderStatusTimeline;
        callback(data);
      }
    }, (error) => {
      console.error('❌ Error listening to order status:', error);
    });

  return unsubscribe;
};

// Send push notification for order status updates
export const sendOrderStatusNotification = async (
  userId: string, 
  statusUpdate: OrderStatusUpdate,
  orderDetails?: {
    orderNumber?: string;
    customerName?: string;
    totalAmount?: number;
    estimatedDelivery?: Date;
  }
): Promise<void> => {
  try {
    // Get user's FCM tokens
    const userTokensDoc = await db.collection('user_fcm_tokens').doc(userId).get();
    
    if (!userTokensDoc.exists) {
      console.log(`No FCM tokens found for user: ${userId}`);
      return;
    }

    const tokensData = userTokensDoc.data();
    const tokens = tokensData?.tokens || [];

    if (tokens.length === 0) {
      console.log(`No active FCM tokens for user: ${userId}`);
      return;
    }

    // Create notification payload
    const notification = createOrderStatusNotification(statusUpdate, orderDetails);

    // Send to all user devices
    const promises = tokens.map(async (tokenData: any) => {
      try {
        const message = {
          token: tokenData.token,
          notification: notification.notification,
          data: notification.data,
          android: {
            notification: {
              icon: 'ic_notification',
              color: '#FF6B35',
              sound: 'default',
              priority: 'high' as const,
              channelId: 'order_updates'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1
              }
            }
          },
          webpush: {
            notification: {
              icon: '/assets/icons/icon-192x192.png',
              badge: '/assets/icons/badge-72x72.png',
              vibrate: [200, 100, 200],
              requireInteraction: true,
              actions: [
                {
                  action: 'view_order',
                  title: 'View Order',
                  icon: '/assets/icons/view-icon.png'
                }
              ]
            }
          }
        };

        await messaging.send(message);
        console.log(`✅ Notification sent to token: ${tokenData.token.substring(0, 20)}...`);
      } catch (error: any) {
        console.error(`❌ Failed to send notification to token: ${tokenData.token.substring(0, 20)}...`, error);
        
        // Remove invalid tokens
        if (error.code === 'messaging/registration-token-not-registered') {
          await removeInvalidFCMToken(userId, tokenData.token);
        }
      }
    });

    await Promise.allSettled(promises);

    // Store notification in Firestore for in-app display
    await createNotification({
      userId,
      title: notification.notification.title,
      body: notification.notification.body,
      type: 'ORDER_UPDATE',
      data: {
        orderId: statusUpdate.orderId,
        status: statusUpdate.status,
        timestamp: statusUpdate.timestamp.toISOString(),
        ...orderDetails
      },
      read: false
    });

  } catch (error) {
    console.error('❌ Failed to send order status notification:', error);
  }
};

// Create notification payload based on status
const createOrderStatusNotification = (
  statusUpdate: OrderStatusUpdate,
  orderDetails?: any
) => {
  const { status, message, orderId } = statusUpdate;
  const orderNumber = orderDetails?.orderNumber || `Order ${orderId.substring(0, 8)}`;

  let title = '';
  let body = '';
  let icon = '';

  switch (status) {
    case 'ORDER_RECEIVED':
      title = '📋 Order Received!';
      body = `${orderNumber} has been received and is being processed.`;
      icon = '📋';
      break;
    case 'CONFIRMED':
      title = '✅ Order Confirmed!';
      body = `${orderNumber} is confirmed and will be processed soon.`;
      icon = '✅';
      break;
    case 'GRINDING':
      title = '⚙️ Grinding Started!';
      body = `Your fresh flour is being ground for ${orderNumber}.`;
      icon = '⚙️';
      break;
    case 'DISPATCHED':
      title = '🚚 Order Dispatched!';
      body = `${orderNumber} has been dispatched and is on the way!`;
      icon = '🚚';
      break;
    case 'OUT_FOR_DELIVERY':
      title = '🏍️ Out for Delivery!';
      body = `${orderNumber} is out for delivery. Your fresh flour will arrive soon!`;
      icon = '🏍️';
      break;
    case 'DELIVERED':
      title = '🎉 Order Delivered!';
      body = `${orderNumber} has been delivered successfully. Enjoy your fresh flour!`;
      icon = '🎉';
      break;
    case 'CANCELLED':
      title = '❌ Order Cancelled';
      body = `${orderNumber} has been cancelled. Contact support if you have questions.`;
      icon = '❌';
      break;
    default:
      title = '📦 Order Update';
      body = message || `${orderNumber} status updated.`;
      icon = '📦';
  }

  return {
    notification: {
      title,
      body
    },
    data: {
      orderId,
      status,
      timestamp: statusUpdate.timestamp.toISOString(),
      type: 'order_status_update',
      icon,
      orderNumber: orderNumber,
      click_action: `/orders/${orderId}`
    }
  };
};

// Get default status message
const getDefaultStatusMessage = (status: string): string => {
  const messages: Record<string, string> = {
    'ORDER_RECEIVED': 'Your order has been received and is being processed.',
    'CONFIRMED': 'Your order has been confirmed and will be processed soon.',
    'GRINDING': 'Your flour is being freshly ground.',
    'DISPATCHED': 'Your order has been dispatched and is on the way.',
    'OUT_FOR_DELIVERY': 'Your order is out for delivery.',
    'DELIVERED': 'Your order has been delivered successfully.',
    'CANCELLED': 'Your order has been cancelled.'
  };

  return messages[status] || 'Order status updated.';
};

// FCM Token Management
export const saveFCMToken = async (userId: string, token: string, deviceInfo?: {
  platform: string;
  browser?: string;
  os?: string;
}): Promise<void> => {
  try {
    const userTokensRef = db.collection('user_fcm_tokens').doc(userId);
    const userTokensDoc = await userTokensRef.get();

    const tokenData = {
      token,
      platform: deviceInfo?.platform || 'web',
      browser: deviceInfo?.browser,
      os: deviceInfo?.os,
      createdAt: new Date(),
      lastUsed: new Date(),
      isActive: true
    };

    if (userTokensDoc.exists) {
      const existingData = userTokensDoc.data();
      const tokens = existingData?.tokens || [];
      
      // Check if token already exists
      const existingTokenIndex = tokens.findIndex((t: any) => t.token === token);
      
      if (existingTokenIndex >= 0) {
        // Update existing token
        tokens[existingTokenIndex] = { ...tokens[existingTokenIndex], ...tokenData };
      } else {
        // Add new token
        tokens.push(tokenData);
      }

      await userTokensRef.update({
        tokens,
        updatedAt: new Date()
      });
    } else {
      // Create new document
      await userTokensRef.set({
        userId,
        tokens: [tokenData],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    console.log(`✅ FCM token saved for user: ${userId}`);
  } catch (error) {
    console.error('❌ Failed to save FCM token:', error);
    throw error;
  }
};

// Remove invalid FCM token
const removeInvalidFCMToken = async (userId: string, token: string): Promise<void> => {
  try {
    const userTokensRef = db.collection('user_fcm_tokens').doc(userId);
    const userTokensDoc = await userTokensRef.get();

    if (userTokensDoc.exists) {
      const existingData = userTokensDoc.data();
      const tokens = existingData?.tokens || [];
      
      const updatedTokens = tokens.filter((t: any) => t.token !== token);
      
      await userTokensRef.update({
        tokens: updatedTokens,
        updatedAt: new Date()
      });

      console.log(`🗑️ Removed invalid FCM token for user: ${userId}`);
    }
  } catch (error) {
    console.error('❌ Failed to remove invalid FCM token:', error);
  }
};

// Bulk update order statuses (for testing/admin purposes)
export const bulkUpdateOrderStatus = async (updates: OrderStatusUpdate[]): Promise<void> => {
  try {
    const batch = db.batch();

    for (const update of updates) {
      const orderStatusRef = db.collection('order_status_updates').doc(update.orderId);
      const orderStatusDoc = await orderStatusRef.get();

      if (orderStatusDoc.exists) {
        const currentData = orderStatusDoc.data() as OrderStatusTimeline;
        
        const newUpdate = {
          status: update.status,
          timestamp: update.timestamp,
          message: update.message || getDefaultStatusMessage(update.status),
          ...(update.location && { location: update.location }),
          ...(update.metadata && { metadata: update.metadata })
        };

        const updatedData: Partial<OrderStatusTimeline> = {
          currentStatus: update.status,
          updates: [...currentData.updates, newUpdate],
          updatedAt: new Date()
        };

        batch.update(orderStatusRef, updatedData);
      }
    }

    await batch.commit();
    console.log(`✅ Bulk updated ${updates.length} order statuses`);
  } catch (error) {
    console.error('❌ Failed to bulk update order statuses:', error);
    throw error;
  }
};

// Get order statistics for dashboard
export const getOrderStatusStatistics = async (dateRange?: {
  startDate: Date;
  endDate: Date;
}): Promise<{
  totalOrders: number;
  statusCounts: Record<string, number>;
  averageProcessingTime: number;
  recentUpdates: Array<{
    orderId: string;
    status: string;
    timestamp: Date;
  }>;
}> => {
  try {
    let query = db.collection('order_status_updates');

    if (dateRange) {
      query = query.where('createdAt', '>=', dateRange.startDate)
                  .where('createdAt', '<=', dateRange.endDate);
    }

    const snapshot = await query.get();
    const orders = snapshot.docs.map(doc => doc.data() as OrderStatusTimeline);

    const statusCounts: Record<string, number> = {};
    let totalProcessingTime = 0;
    let completedOrders = 0;

    const recentUpdates: Array<{
      orderId: string;
      status: string;
      timestamp: Date;
    }> = [];

    orders.forEach(order => {
      // Count current statuses
      statusCounts[order.currentStatus] = (statusCounts[order.currentStatus] || 0) + 1;

      // Calculate processing time for delivered orders
      if (order.currentStatus === 'DELIVERED') {
        const startTime = order.updates[0]?.timestamp;
        const endTime = order.updates[order.updates.length - 1]?.timestamp;
        
        if (startTime && endTime) {
          const processingTime = endTime.getTime() - startTime.getTime();
          totalProcessingTime += processingTime;
          completedOrders++;
        }
      }

      // Collect recent updates
      const latestUpdate = order.updates[order.updates.length - 1];
      if (latestUpdate) {
        recentUpdates.push({
          orderId: order.orderId,
          status: latestUpdate.status,
          timestamp: latestUpdate.timestamp
        });
      }
    });

    // Sort recent updates by timestamp
    recentUpdates.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      totalOrders: orders.length,
      statusCounts,
      averageProcessingTime: completedOrders > 0 ? totalProcessingTime / completedOrders : 0,
      recentUpdates: recentUpdates.slice(0, 10) // Latest 10 updates
    };
  } catch (error) {
    console.error('❌ Failed to get order status statistics:', error);
    throw error;
  }
};

// Existing functions (keeping them for backward compatibility)
export const createNotification = async (notification: {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  read: boolean;
}): Promise<void> => {
  try {
    await db.collection('notifications').add({
      ...notification,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
    throw error;
  }
};

export const logActivity = async (activity: {
  userId: string;
  action: string;
  details: any;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}): Promise<void> => {
  try {
    await db.collection('activity_logs').add(activity);
  } catch (error) {
    console.error('❌ Failed to log activity:', error);
    throw error;
  }
};

export default {
  initializeOrderStatus,
  updateOrderStatus,
  getOrderStatusTimeline,
  listenToOrderStatus,
  sendOrderStatusNotification,
  saveFCMToken,
  bulkUpdateOrderStatus,
  getOrderStatusStatistics,
  createNotification,
  logActivity
};