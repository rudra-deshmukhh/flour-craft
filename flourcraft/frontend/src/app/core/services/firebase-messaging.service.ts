import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

// Firebase imports
import { Messaging, getToken, onMessage, MessagePayload } from '@angular/fire/messaging';
import { getMessaging, isSupported } from 'firebase/messaging';

import { environment } from '../../../environments/environment';

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseMessagingService {
  private readonly apiUrl = environment.apiUrl;
  private currentMessage = new BehaviorSubject<MessagePayload | null>(null);
  private token$ = new BehaviorSubject<string | null>(null);
  private isMessagingSupported = false;

  constructor(
    private messaging: Messaging,
    private http: HttpClient
  ) {
    this.initializeMessaging();
  }

  // Observables
  get currentMessage$(): Observable<MessagePayload | null> {
    return this.currentMessage.asObservable();
  }

  get token(): Observable<string | null> {
    return this.token$.asObservable();
  }

  private async initializeMessaging(): Promise<void> {
    try {
      // Check if messaging is supported
      this.isMessagingSupported = await isSupported();
      
      if (!this.isMessagingSupported) {
        console.log('Firebase Messaging is not supported in this browser');
        return;
      }

      // Request permission and get token
      await this.requestPermission();
      
      // Listen for foreground messages
      this.listenForMessages();

    } catch (error) {
      console.error('Error initializing Firebase Messaging:', error);
    }
  }

  // Request notification permission and get FCM token
  async requestPermission(): Promise<string | null> {
    try {
      if (!this.isMessagingSupported) {
        throw new Error('Firebase Messaging is not supported');
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      // Get FCM token
      const token = await getToken(this.messaging, {
        vapidKey: environment.firebase.vapidKey
      });

      if (token) {
        console.log('FCM Token:', token);
        this.token$.next(token);
        
        // Save token to backend
        await this.saveTokenToBackend(token);
        
        return token;
      } else {
        console.log('No registration token available');
        return null;
      }

    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  // Listen for foreground messages
  private listenForMessages(): void {
    if (!this.isMessagingSupported) return;

    onMessage(this.messaging, (payload) => {
      console.log('Received foreground message:', payload);
      
      this.currentMessage.next(payload);
      
      // Show notification if the app is in foreground
      this.showForegroundNotification(payload);
    });
  }

  // Show notification when app is in foreground
  private showForegroundNotification(payload: MessagePayload): void {
    if (!payload.notification) return;

    const notificationTitle = payload.notification.title || 'FlourCraft';
    const notificationOptions: NotificationOptions = {
      body: payload.notification.body || '',
      icon: payload.notification.icon || '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/badge-72x72.png',
      tag: payload.data?.type || 'general',
      data: payload.data,
      vibrate: [200, 100, 200],
      requireInteraction: false,
      actions: [
        {
          action: 'view',
          title: 'View',
          icon: '/assets/icons/view-icon.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/assets/icons/dismiss-icon.png'
        }
      ]
    };

    // Check if the browser supports the Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(notificationTitle, notificationOptions);
      
      // Handle notification click
      notification.onclick = (event) => {
        event.preventDefault();
        
        // Close the notification
        notification.close();
        
        // Handle click action based on notification data
        this.handleNotificationClick(payload.data);
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }

  // Handle notification click actions
  private handleNotificationClick(data?: any): void {
    // Focus the window if it's not already focused
    if (window.focus) {
      window.focus();
    }

    // Navigate based on notification data
    if (data) {
      switch (data.type) {
        case 'order_status_update':
          if (data.orderId) {
            window.location.href = `/orders/${data.orderId}`;
          }
          break;
        case 'subscription_update':
          window.location.href = '/subscriptions';
          break;
        case 'offer':
          window.location.href = '/products';
          break;
        default:
          window.location.href = '/';
      }
    }
  }

  // Save FCM token to backend
  private async saveTokenToBackend(token: string): Promise<void> {
    try {
      const deviceInfo = this.getDeviceInfo();
      
      await this.http.post(`${this.apiUrl}/auth/fcm-token`, {
        token,
        platform: deviceInfo.platform,
        browser: deviceInfo.browser,
        os: deviceInfo.os
      }).toPromise();

      console.log('FCM token saved to backend');
    } catch (error) {
      console.error('Error saving FCM token to backend:', error);
    }
  }

  // Get device information
  private getDeviceInfo(): { platform: string; browser: string; os: string } {
    const userAgent = navigator.userAgent;
    
    // Detect platform
    let platform = 'web';
    if (/Android/i.test(userAgent)) {
      platform = 'android';
    } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
      platform = 'ios';
    } else if (/Windows/i.test(userAgent)) {
      platform = 'windows';
    } else if (/Mac/i.test(userAgent)) {
      platform = 'mac';
    } else if (/Linux/i.test(userAgent)) {
      platform = 'linux';
    }

    // Detect browser
    let browser = 'unknown';
    if (/Chrome/i.test(userAgent)) {
      browser = 'chrome';
    } else if (/Firefox/i.test(userAgent)) {
      browser = 'firefox';
    } else if (/Safari/i.test(userAgent)) {
      browser = 'safari';
    } else if (/Edge/i.test(userAgent)) {
      browser = 'edge';
    }

    // Detect OS
    let os = 'unknown';
    if (/Windows NT 10/i.test(userAgent)) {
      os = 'windows_10';
    } else if (/Windows/i.test(userAgent)) {
      os = 'windows';
    } else if (/Mac OS X/i.test(userAgent)) {
      os = 'macos';
    } else if (/Android/i.test(userAgent)) {
      os = 'android';
    } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
      os = 'ios';
    } else if (/Linux/i.test(userAgent)) {
      os = 'linux';
    }

    return { platform, browser, os };
  }

  // Get current FCM token
  async getCurrentToken(): Promise<string | null> {
    try {
      if (!this.isMessagingSupported) {
        return null;
      }

      const token = await getToken(this.messaging, {
        vapidKey: environment.firebase.vapidKey
      });

      if (token) {
        this.token$.next(token);
        return token;
      }

      return null;
    } catch (error) {
      console.error('Error getting current FCM token:', error);
      return null;
    }
  }

  // Delete FCM token (for logout)
  async deleteToken(): Promise<void> {
    try {
      const token = this.token$.value;
      
      if (token) {
        // Remove token from backend
        await this.http.delete(`${this.apiUrl}/auth/fcm-token/${token}`).toPromise();
        
        this.token$.next(null);
        console.log('FCM token deleted');
      }
    } catch (error) {
      console.error('Error deleting FCM token:', error);
    }
  }

  // Check if notifications are supported
  isNotificationSupported(): boolean {
    return 'Notification' in window && this.isMessagingSupported;
  }

  // Check notification permission status
  getNotificationPermission(): NotificationPermission {
    if ('Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  }

  // Subscribe to topic (for general notifications)
  async subscribeToTopic(topic: string): Promise<void> {
    try {
      const token = this.token$.value;
      
      if (!token) {
        throw new Error('No FCM token available');
      }

      await this.http.post(`${this.apiUrl}/messaging/subscribe`, {
        token,
        topic
      }).toPromise();

      console.log(`Subscribed to topic: ${topic}`);
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
    }
  }

  // Unsubscribe from topic
  async unsubscribeFromTopic(topic: string): Promise<void> {
    try {
      const token = this.token$.value;
      
      if (!token) {
        throw new Error('No FCM token available');
      }

      await this.http.post(`${this.apiUrl}/messaging/unsubscribe`, {
        token,
        topic
      }).toPromise();

      console.log(`Unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
    }
  }

  // Test notification (for development)
  async sendTestNotification(): Promise<void> {
    try {
      const token = this.token$.value;
      
      if (!token) {
        throw new Error('No FCM token available');
      }

      await this.http.post(`${this.apiUrl}/messaging/test`, {
        token,
        title: 'Test Notification',
        body: 'This is a test notification from FlourCraft!'
      }).toPromise();

      console.log('Test notification sent');
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }

  // Show local notification (for testing)
  showLocalNotification(title: string, body: string, data?: any): void {
    if (!this.isNotificationSupported()) {
      console.log('Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    const notification = new Notification(title, {
      body,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/badge-72x72.png',
      data,
      tag: 'local-notification'
    });

    notification.onclick = () => {
      notification.close();
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    };

    // Auto close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
  }

  // Background message handler (for service worker)
  setupBackgroundMessageHandler(): void {
    // This would be implemented in the service worker
    // See firebase-messaging-sw.js
  }

  // Clear all notifications
  clearAllNotifications(): void {
    // This clears the current message observable
    this.currentMessage.next(null);
  }

  // Get notification history (from backend)
  async getNotificationHistory(limit: number = 50): Promise<any[]> {
    try {
      const response = await this.http.get(`${this.apiUrl}/notifications?limit=${limit}`).toPromise();
      return (response as any).data || [];
    } catch (error) {
      console.error('Error getting notification history:', error);
      return [];
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await this.http.put(`${this.apiUrl}/notifications/${notificationId}/read`, {}).toPromise();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
}