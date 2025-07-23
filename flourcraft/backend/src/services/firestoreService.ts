import { getFirestore } from '../config/firebase';
import { OrderStatus } from '@prisma/client';

interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  timestamp: Date;
  message?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

interface NotificationData {
  userId: string;
  title: string;
  body: string;
  type: 'ORDER_UPDATE' | 'OFFER' | 'GENERAL';
  data?: Record<string, any>;
  read: boolean;
}

interface DeliveryLocation {
  partnerId: string;
  lat: number;
  lng: number;
  timestamp: Date;
  orderId?: string;
}

interface ActivityLog {
  userId: string;
  action: string;
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

class FirestoreService {
  private db = getFirestore();

  // Order status updates
  async updateOrderStatus(data: OrderStatusUpdate): Promise<void> {
    try {
      const docRef = this.db
        .collection('order_status_updates')
        .doc(data.orderId);

      await docRef.set({
        ...data,
        timestamp: data.timestamp.toISOString()
      }, { merge: true });

      console.log(`✅ Order status updated in Firestore: ${data.orderId} -> ${data.status}`);
    } catch (error) {
      console.error('❌ Failed to update order status in Firestore:', error);
      throw error;
    }
  }

  async getOrderStatusUpdates(orderId: string): Promise<OrderStatusUpdate[]> {
    try {
      const doc = await this.db
        .collection('order_status_updates')
        .doc(orderId)
        .get();

      if (!doc.exists) {
        return [];
      }

      return [doc.data() as OrderStatusUpdate];
    } catch (error) {
      console.error('❌ Failed to get order status updates:', error);
      return [];
    }
  }

  // Notifications
  async createNotification(data: NotificationData): Promise<string> {
    try {
      const docRef = await this.db
        .collection('notifications')
        .add({
          ...data,
          timestamp: new Date().toISOString(),
          read: false
        });

      console.log(`✅ Notification created: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Failed to create notification:', error);
      throw error;
    }
  }

  async getUserNotifications(
    userId: string,
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<NotificationData[]> {
    try {
      let query = this.db
        .collection('notifications')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (unreadOnly) {
        query = query.where('read', '==', false);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NotificationData[];
    } catch (error) {
      console.error('❌ Failed to get user notifications:', error);
      return [];
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await this.db
        .collection('notifications')
        .doc(notificationId)
        .update({ read: true });

      console.log(`✅ Notification marked as read: ${notificationId}`);
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
      throw error;
    }
  }

  // Delivery partner location tracking
  async updateDeliveryPartnerLocation(data: DeliveryLocation): Promise<void> {
    try {
      await this.db
        .collection('delivery_locations')
        .doc(data.partnerId)
        .set({
          ...data,
          timestamp: data.timestamp.toISOString()
        }, { merge: true });

      console.log(`✅ Delivery partner location updated: ${data.partnerId}`);
    } catch (error) {
      console.error('❌ Failed to update delivery partner location:', error);
      throw error;
    }
  }

  async getDeliveryPartnerLocation(partnerId: string): Promise<DeliveryLocation | null> {
    try {
      const doc = await this.db
        .collection('delivery_locations')
        .doc(partnerId)
        .get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as DeliveryLocation;
    } catch (error) {
      console.error('❌ Failed to get delivery partner location:', error);
      return null;
    }
  }

  // Activity logging
  async logActivity(data: ActivityLog): Promise<void> {
    try {
      await this.db
        .collection('activity_logs')
        .add({
          ...data,
          timestamp: data.timestamp.toISOString()
        });

      console.log(`✅ Activity logged for user: ${data.userId}`);
    } catch (error) {
      console.error('❌ Failed to log activity:', error);
      // Don't throw error for logging failures
    }
  }

  async getUserActivityLogs(
    userId: string,
    limit: number = 50
  ): Promise<ActivityLog[]> {
    try {
      const snapshot = await this.db
        .collection('activity_logs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => doc.data()) as ActivityLog[];
    } catch (error) {
      console.error('❌ Failed to get user activity logs:', error);
      return [];
    }
  }

  // Real-time order tracking for customers
  async subscribeToOrderUpdates(orderId: string, callback: (data: OrderStatusUpdate) => void) {
    try {
      return this.db
        .collection('order_status_updates')
        .doc(orderId)
        .onSnapshot((doc) => {
          if (doc.exists) {
            callback(doc.data() as OrderStatusUpdate);
          }
        });
    } catch (error) {
      console.error('❌ Failed to subscribe to order updates:', error);
      throw error;
    }
  }

  // Real-time delivery partner location for admins
  async subscribeToDeliveryPartnerLocation(
    partnerId: string,
    callback: (data: DeliveryLocation) => void
  ) {
    try {
      return this.db
        .collection('delivery_locations')
        .doc(partnerId)
        .onSnapshot((doc) => {
          if (doc.exists) {
            callback(doc.data() as DeliveryLocation);
          }
        });
    } catch (error) {
      console.error('❌ Failed to subscribe to delivery partner location:', error);
      throw error;
    }
  }

  // Bulk notification sending
  async sendBulkNotifications(notifications: NotificationData[]): Promise<void> {
    try {
      const batch = this.db.batch();
      
      notifications.forEach((notification) => {
        const docRef = this.db.collection('notifications').doc();
        batch.set(docRef, {
          ...notification,
          timestamp: new Date().toISOString(),
          read: false
        });
      });

      await batch.commit();
      console.log(`✅ Bulk notifications sent: ${notifications.length} notifications`);
    } catch (error) {
      console.error('❌ Failed to send bulk notifications:', error);
      throw error;
    }
  }

  // Clean up old data
  async cleanupOldData(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffISO = cutoffDate.toISOString();

      // Clean up old activity logs
      const activityLogsQuery = this.db
        .collection('activity_logs')
        .where('timestamp', '<', cutoffISO)
        .limit(500);

      const activitySnapshot = await activityLogsQuery.get();
      const activityBatch = this.db.batch();

      activitySnapshot.docs.forEach((doc) => {
        activityBatch.delete(doc.ref);
      });

      if (!activitySnapshot.empty) {
        await activityBatch.commit();
        console.log(`✅ Cleaned up ${activitySnapshot.size} old activity logs`);
      }

      // Clean up old read notifications
      const notificationsQuery = this.db
        .collection('notifications')
        .where('read', '==', true)
        .where('timestamp', '<', cutoffISO)
        .limit(500);

      const notificationsSnapshot = await notificationsQuery.get();
      const notificationsBatch = this.db.batch();

      notificationsSnapshot.docs.forEach((doc) => {
        notificationsBatch.delete(doc.ref);
      });

      if (!notificationsSnapshot.empty) {
        await notificationsBatch.commit();
        console.log(`✅ Cleaned up ${notificationsSnapshot.size} old notifications`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup old data:', error);
    }
  }
}

export const firestoreService = new FirestoreService();
export default firestoreService;