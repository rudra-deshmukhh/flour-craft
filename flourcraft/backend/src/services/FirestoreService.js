const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

class FirestoreService {
  constructor() {
    this.db = getFirestore();
    this.messaging = getMessaging();
    
    // Collection references
    this.collections = {
      ORDER_STATUS_UPDATES: 'order_status_updates',
      DELIVERY_LOCATIONS: 'delivery_locations',
      NOTIFICATIONS: 'notifications',
      ACTIVITY_LOGS: 'activity_logs',
      ORDER_TRACKING: 'order_tracking',
      DELIVERY_ROUTES: 'delivery_routes',
      ANALYTICS_EVENTS: 'analytics_events',
      SUPPORT_CHATS: 'support_chats',
      SYSTEM_HEALTH: 'system_health'
    };
  }

  // ==================== ORDER STATUS UPDATES ====================

  /**
   * Update order status in real-time
   */
  async updateOrderStatus(orderId, status, updatedBy, additionalData = {}) {
    try {
      const updateData = {
        orderId,
        status,
        timestamp: FieldValue.serverTimestamp(),
        updatedBy,
        ...additionalData
      };

      await this.db.collection(this.collections.ORDER_STATUS_UPDATES)
        .doc(orderId)
        .set(updateData, { merge: true });

      // Also update order tracking with detailed steps
      await this.updateOrderTracking(orderId, status, additionalData);

      console.log(`Order ${orderId} status updated to ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Get real-time order status updates
   */
  async getOrderStatusUpdates(orderId) {
    try {
      const doc = await this.db.collection(this.collections.ORDER_STATUS_UPDATES)
        .doc(orderId)
        .get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting order status:', error);
      throw error;
    }
  }

  /**
   * Listen to order status changes (for real-time updates)
   */
  listenToOrderStatus(orderId, callback) {
    return this.db.collection(this.collections.ORDER_STATUS_UPDATES)
      .doc(orderId)
      .onSnapshot(callback);
  }

  // ==================== DELIVERY PARTNER LOCATIONS ====================

  /**
   * Update delivery partner location
   */
  async updateDeliveryPartnerLocation(partnerId, locationData) {
    try {
      const updateData = {
        ...locationData,
        timestamp: FieldValue.serverTimestamp(),
        partnerId
      };

      // Validate location data
      if (!this.isValidCoordinates(locationData.latitude, locationData.longitude)) {
        throw new Error('Invalid coordinates provided');
      }

      await this.db.collection(this.collections.DELIVERY_LOCATIONS)
        .doc(partnerId)
        .set(updateData, { merge: true });

      console.log(`Location updated for partner ${partnerId}`);
      return true;
    } catch (error) {
      console.error('Error updating partner location:', error);
      throw error;
    }
  }

  /**
   * Get current delivery partner location
   */
  async getDeliveryPartnerLocation(partnerId) {
    try {
      const doc = await this.db.collection(this.collections.DELIVERY_LOCATIONS)
        .doc(partnerId)
        .get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting partner location:', error);
      throw error;
    }
  }

  /**
   * Get all active delivery partners locations
   */
  async getActiveDeliveryPartners() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const snapshot = await this.db.collection(this.collections.DELIVERY_LOCATIONS)
        .where('timestamp', '>=', Timestamp.fromDate(fiveMinutesAgo))
        .where('status', 'in', ['AVAILABLE', 'ON_DELIVERY'])
        .get();

      const activePartners = [];
      snapshot.forEach(doc => {
        activePartners.push({ id: doc.id, ...doc.data() });
      });

      return activePartners;
    } catch (error) {
      console.error('Error getting active partners:', error);
      throw error;
    }
  }

  /**
   * Listen to delivery partner location changes
   */
  listenToPartnerLocation(partnerId, callback) {
    return this.db.collection(this.collections.DELIVERY_LOCATIONS)
      .doc(partnerId)
      .onSnapshot(callback);
  }

  // ==================== NOTIFICATIONS ====================

  /**
   * Create notification for user
   */
  async createNotification(userId, notificationData) {
    try {
      const notification = {
        ...notificationData,
        timestamp: FieldValue.serverTimestamp(),
        isRead: false,
        userId
      };

      // Add to Firestore
      const docRef = await this.db.collection(this.collections.NOTIFICATIONS)
        .doc(userId)
        .collection('user_notifications')
        .add(notification);

      // Send FCM push notification if FCM token exists
      await this.sendPushNotification(userId, notificationData);

      console.log(`Notification created for user ${userId}`);
      return docRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, limit = 50) {
    try {
      const snapshot = await this.db.collection(this.collections.NOTIFICATIONS)
        .doc(userId)
        .collection('user_notifications')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const notifications = [];
      snapshot.forEach(doc => {
        notifications.push({ id: doc.id, ...doc.data() });
      });

      return notifications;
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(userId, notificationId) {
    try {
      await this.db.collection(this.collections.NOTIFICATIONS)
        .doc(userId)
        .collection('user_notifications')
        .doc(notificationId)
        .update({ isRead: true });

      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Send FCM push notification
   */
  async sendPushNotification(userId, notificationData) {
    try {
      // Get user's FCM token from database (you'll need to implement this)
      const fcmToken = await this.getUserFCMToken(userId);
      
      if (!fcmToken) {
        console.log(`No FCM token found for user ${userId}`);
        return;
      }

      const message = {
        token: fcmToken,
        notification: {
          title: notificationData.title,
          body: notificationData.body
        },
        data: {
          type: notificationData.type,
          ...notificationData.data
        },
        android: {
          notification: {
            priority: 'high',
            sound: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default'
            }
          }
        }
      };

      const response = await this.messaging.send(message);
      console.log(`FCM notification sent to ${userId}:`, response);
      return response;
    } catch (error) {
      console.error('Error sending FCM notification:', error);
      // Don't throw error for FCM failures
    }
  }

  // ==================== ACTIVITY LOGS ====================

  /**
   * Log user activity
   */
  async logActivity(userId, action, details = {}) {
    try {
      const activityLog = {
        action,
        timestamp: FieldValue.serverTimestamp(),
        userId,
        details,
        sessionId: details.sessionId || null,
        ip: details.ip || null,
        userAgent: details.userAgent || null
      };

      await this.db.collection(this.collections.ACTIVITY_LOGS)
        .doc(userId)
        .collection('user_activities')
        .add(activityLog);

      console.log(`Activity logged for user ${userId}: ${action}`);
      return true;
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  }

  /**
   * Get user activity logs
   */
  async getUserActivityLogs(userId, limit = 100) {
    try {
      const snapshot = await this.db.collection(this.collections.ACTIVITY_LOGS)
        .doc(userId)
        .collection('user_activities')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const activities = [];
      snapshot.forEach(doc => {
        activities.push({ id: doc.id, ...doc.data() });
      });

      return activities;
    } catch (error) {
      console.error('Error getting activity logs:', error);
      throw error;
    }
  }

  // ==================== ORDER TRACKING ====================

  /**
   * Update detailed order tracking
   */
  async updateOrderTracking(orderId, currentStatus, additionalData = {}) {
    try {
      const trackingSteps = this.getOrderTrackingSteps();
      const currentStepIndex = trackingSteps.findIndex(step => step.status === currentStatus);
      
      const trackingData = {
        orderId,
        currentStep: currentStepIndex,
        steps: trackingSteps.map((step, index) => ({
          ...step,
          completed: index <= currentStepIndex,
          timestamp: index === currentStepIndex ? FieldValue.serverTimestamp() : step.timestamp
        })),
        lastUpdated: FieldValue.serverTimestamp(),
        ...additionalData
      };

      await this.db.collection(this.collections.ORDER_TRACKING)
        .doc(orderId)
        .set(trackingData, { merge: true });

      return true;
    } catch (error) {
      console.error('Error updating order tracking:', error);
      throw error;
    }
  }

  /**
   * Get order tracking steps template
   */
  getOrderTrackingSteps() {
    return [
      { status: 'CONFIRMED', title: 'Order Confirmed', description: 'Your order has been confirmed' },
      { status: 'ASSIGNED_TO_MILL', title: 'Assigned to Mill', description: 'Order assigned to flour mill' },
      { status: 'GRINDING', title: 'Grinding in Progress', description: 'Your flour is being prepared' },
      { status: 'GRINDING_DONE', title: 'Grinding Complete', description: 'Flour grinding completed' },
      { status: 'QUALITY_CHECK', title: 'Quality Check', description: 'Quality assurance in progress' },
      { status: 'PACKED', title: 'Packed', description: 'Order packed and ready for delivery' },
      { status: 'OUT_FOR_DELIVERY', title: 'Out for Delivery', description: 'Order is on the way' },
      { status: 'DELIVERED', title: 'Delivered', description: 'Order delivered successfully' }
    ];
  }

  // ==================== DELIVERY ROUTES ====================

  /**
   * Create delivery route
   */
  async createDeliveryRoute(partnerId, routeData) {
    try {
      const route = {
        partnerId,
        ...routeData,
        createdAt: FieldValue.serverTimestamp(),
        status: 'ACTIVE'
      };

      const docRef = await this.db.collection(this.collections.DELIVERY_ROUTES)
        .add(route);

      return docRef.id;
    } catch (error) {
      console.error('Error creating delivery route:', error);
      throw error;
    }
  }

  /**
   * Update delivery route progress
   */
  async updateRouteProgress(routeId, progressData) {
    try {
      await this.db.collection(this.collections.DELIVERY_ROUTES)
        .doc(routeId)
        .update({
          ...progressData,
          lastUpdated: FieldValue.serverTimestamp()
        });

      return true;
    } catch (error) {
      console.error('Error updating route progress:', error);
      throw error;
    }
  }

  // ==================== ANALYTICS EVENTS ====================

  /**
   * Track analytics event
   */
  async trackEvent(userId, eventType, properties = {}) {
    try {
      const event = {
        eventType,
        userId,
        timestamp: FieldValue.serverTimestamp(),
        properties,
        sessionId: properties.sessionId || null
      };

      await this.db.collection(this.collections.ANALYTICS_EVENTS)
        .add(event);

      return true;
    } catch (error) {
      console.error('Error tracking event:', error);
      throw error;
    }
  }

  // ==================== SYSTEM HEALTH ====================

  /**
   * Update system health metrics
   */
  async updateSystemHealth(metrics) {
    try {
      await this.db.collection(this.collections.SYSTEM_HEALTH)
        .doc('current')
        .set({
          ...metrics,
          timestamp: FieldValue.serverTimestamp()
        }, { merge: true });

      return true;
    } catch (error) {
      console.error('Error updating system health:', error);
      throw error;
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Validate coordinates
   */
  isValidCoordinates(latitude, longitude) {
    return latitude >= -90 && latitude <= 90 && 
           longitude >= -180 && longitude <= 180;
  }

  /**
   * Get user FCM token (implement based on your user storage)
   */
  async getUserFCMToken(userId) {
    try {
      // This should fetch from your user database
      // For now, returning null - implement based on your user model
      return null;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Batch operations for better performance
   */
  async batchWrite(operations) {
    try {
      const batch = this.db.batch();
      
      operations.forEach(operation => {
        const { type, collection, doc, data } = operation;
        const docRef = this.db.collection(collection).doc(doc);
        
        switch (type) {
          case 'set':
            batch.set(docRef, data);
            break;
          case 'update':
            batch.update(docRef, data);
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error in batch write:', error);
      throw error;
    }
  }

  /**
   * Clean up old data
   */
  async cleanupOldData() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Clean up old location updates
      const oldLocations = await this.db.collection(this.collections.DELIVERY_LOCATIONS)
        .where('timestamp', '<', Timestamp.fromDate(thirtyDaysAgo))
        .get();

      const batch = this.db.batch();
      oldLocations.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Cleaned up ${oldLocations.size} old location records`);
      
      return true;
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      throw error;
    }
  }

  // ==================== REAL-TIME LISTENERS ====================

  /**
   * Setup real-time listeners for order updates
   */
  setupOrderStatusListener(orderId, callback) {
    return this.listenToOrderStatus(orderId, (snapshot) => {
      if (snapshot.exists) {
        callback({ type: 'update', data: snapshot.data() });
      } else {
        callback({ type: 'delete', data: null });
      }
    });
  }

  /**
   * Setup real-time listeners for delivery partner locations
   */
  setupLocationListener(partnerId, callback) {
    return this.listenToPartnerLocation(partnerId, (snapshot) => {
      if (snapshot.exists) {
        callback({ type: 'update', data: snapshot.data() });
      } else {
        callback({ type: 'delete', data: null });
      }
    });
  }

  /**
   * Setup real-time listeners for notifications
   */
  setupNotificationListener(userId, callback) {
    return this.db.collection(this.collections.NOTIFICATIONS)
      .doc(userId)
      .collection('user_notifications')
      .where('isRead', '==', false)
      .orderBy('timestamp', 'desc')
      .onSnapshot(callback);
  }
}

module.exports = new FirestoreService();