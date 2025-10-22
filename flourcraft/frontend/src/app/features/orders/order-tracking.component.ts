import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, Observable, combineLatest } from 'rxjs';
import { takeUntil, map, startWith } from 'rxjs/operators';

// Firebase imports
import { Firestore, doc, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { Messaging, getToken, onMessage } from '@angular/fire/messaging';

import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/services/auth.service';
import { Order, OrderStatus } from '../../core/models/product.model';

interface OrderStatusUpdate {
  status: string;
  timestamp: Date;
  message?: string;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  metadata?: Record<string, any>;
}

interface OrderStatusTimeline {
  orderId: string;
  currentStatus: string;
  updates: OrderStatusUpdate[];
  createdAt: Date;
  updatedAt: Date;
}

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatStepperModule,
    MatTabsModule,
    MatDividerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="order-tracking-container p-4 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="header mb-6" *ngIf="order">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">Track Your Order</h1>
            <p class="text-gray-600">Order #{{ order.orderNumber }}</p>
          </div>
          <div class="order-status">
            <mat-chip 
              [style.background-color]="getStatusColor(currentStatus)"
              class="text-white font-medium">
              {{ getStatusText(currentStatus) }}
            </mat-chip>
          </div>
        </div>

        <!-- Real-time indicator -->
        <div class="live-indicator flex items-center gap-2 mb-4" *ngIf="isConnected">
          <div class="live-dot w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span class="text-sm text-green-600">Live tracking</span>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="flex justify-center items-center py-12">
        <mat-spinner diameter="50"></mat-spinner>
        <span class="ml-4 text-gray-600">Loading order details...</span>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !loading" class="text-center py-12">
        <mat-icon class="text-6xl text-red-400 mb-4">error_outline</mat-icon>
        <h3 class="text-xl font-medium text-gray-700 mb-2">Unable to Load Order</h3>
        <p class="text-gray-500 mb-4">{{ error }}</p>
        <button mat-raised-button color="primary" (click)="loadOrder()">
          Try Again
        </button>
      </div>

      <!-- Order Content -->
      <div *ngIf="order && !loading" class="order-content">
        <mat-tab-group class="tracking-tabs">
          <!-- Status Timeline Tab -->
          <mat-tab label="Order Status">
            <div class="status-content p-6">
              <!-- Current Status Card -->
              <mat-card class="current-status-card mb-6">
                <mat-card-content class="p-6">
                  <div class="flex items-center gap-4">
                    <div class="status-icon">
                      <mat-icon 
                        [style.color]="getStatusColor(currentStatus)"
                        class="text-4xl">
                        {{ getStatusIcon(currentStatus) }}
                      </mat-icon>
                    </div>
                    <div class="status-info flex-1">
                      <h2 class="text-xl font-semibold mb-1">
                        {{ getStatusText(currentStatus) }}
                      </h2>
                      <p class="text-gray-600 mb-2">
                        {{ getCurrentStatusMessage() }}
                      </p>
                      <p class="text-sm text-gray-500">
                        Last updated: {{ getLastUpdateTime() }}
                      </p>
                    </div>
                  </div>

                  <!-- Estimated Delivery -->
                  <div class="estimated-delivery mt-4 p-4 bg-blue-50 rounded-lg" *ngIf="order.estimatedDelivery">
                    <div class="flex items-center gap-2">
                      <mat-icon class="text-blue-600">schedule</mat-icon>
                      <span class="font-medium text-blue-800">Estimated Delivery</span>
                    </div>
                    <p class="text-blue-700 mt-1">
                      {{ formatDate(order.estimatedDelivery) }}
                    </p>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Status Timeline -->
              <mat-card class="timeline-card">
                <mat-card-header>
                  <mat-card-title>Order Timeline</mat-card-title>
                  <mat-card-subtitle>Track your order progress step by step</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content class="p-6">
                  <div class="timeline">
                    <div 
                      *ngFor="let update of statusUpdates; let i = index; trackBy: trackByTimestamp"
                      class="timeline-item"
                      [class.active]="i === 0"
                      [class.completed]="i > 0">
                      
                      <div class="timeline-content flex gap-4">
                        <!-- Timeline dot -->
                        <div class="timeline-dot-container flex flex-col items-center">
                          <div class="timeline-dot">
                            <mat-icon 
                              [style.color]="getStatusColor(update.status)"
                              class="text-lg">
                              {{ getStatusIcon(update.status) }}
                            </mat-icon>
                          </div>
                          <div class="timeline-line" *ngIf="i < statusUpdates.length - 1"></div>
                        </div>

                        <!-- Timeline content -->
                        <div class="timeline-info flex-1 pb-6">
                          <div class="flex justify-between items-start mb-2">
                            <h3 class="font-semibold text-gray-900">
                              {{ getStatusText(update.status) }}
                            </h3>
                            <span class="text-sm text-gray-500">
                              {{ formatDateTime(update.timestamp) }}
                            </span>
                          </div>
                          
                          <p class="text-gray-600 mb-2" *ngIf="update.message">
                            {{ update.message }}
                          </p>

                          <!-- Location info -->
                          <div class="location-info" *ngIf="update.location">
                            <div class="flex items-center gap-2 text-sm text-gray-500">
                              <mat-icon class="text-sm">location_on</mat-icon>
                              <span>{{ update.location.address }}</span>
                            </div>
                          </div>

                          <!-- Additional metadata -->
                          <div class="metadata" *ngIf="update.metadata">
                            <div class="text-sm text-gray-500 mt-2">
                              <span *ngIf="update.metadata['deliveryPartner']">
                                Delivery Partner: {{ update.metadata['deliveryPartner'] }}
                              </span>
                              <span *ngIf="update.metadata['vehicleNumber']">
                                Vehicle: {{ update.metadata['vehicleNumber'] }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Order Details Tab -->
          <mat-tab label="Order Details">
            <div class="order-details p-6">
              <!-- Order Items -->
              <mat-card class="mb-6">
                <mat-card-header>
                  <mat-card-title>Order Items</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="items-list">
                    <div 
                      *ngFor="let item of order.orderItems" 
                      class="item-row flex justify-between items-center py-3 border-b last:border-b-0">
                      <div class="item-info">
                        <h4 class="font-medium">{{ item.product.name }}</h4>
                        <p class="text-sm text-gray-600">{{ item.quantity }} kg × ₹{{ item.pricePerKg }}/kg</p>
                      </div>
                      <div class="item-total font-semibold">
                        ₹{{ item.totalPrice }}
                      </div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Order Summary -->
              <mat-card class="mb-6">
                <mat-card-header>
                  <mat-card-title>Order Summary</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="summary-rows space-y-2">
                    <div class="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹{{ order.totalAmount }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span>Delivery Charge</span>
                      <span>₹{{ order.deliveryCharge }}</span>
                    </div>
                    <div class="flex justify-between" *ngIf="order.discount > 0">
                      <span>Discount</span>
                      <span class="text-green-600">-₹{{ order.discount }}</span>
                    </div>
                    <mat-divider></mat-divider>
                    <div class="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>₹{{ order.finalAmount }}</span>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Delivery Address -->
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Delivery Address</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="address-info">
                    <p class="font-medium mb-1">{{ order.address.label || 'Delivery Address' }}</p>
                    <p class="text-gray-600">
                      {{ order.address.line1 }}<br>
                      {{ order.address.line2 }}<br>
                      {{ order.address.city }}, {{ order.address.state }} - {{ order.address.pincode }}
                    </p>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Support Tab -->
          <mat-tab label="Support">
            <div class="support-content p-6">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Need Help?</mat-card-title>
                  <mat-card-subtitle>Get support for your order</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="support-options space-y-4">
                    <button mat-raised-button color="primary" class="w-full">
                      <mat-icon>phone</mat-icon>
                      Call Support
                    </button>
                    <button mat-stroked-button class="w-full">
                      <mat-icon>chat</mat-icon>
                      Chat with Us
                    </button>
                    <button 
                      mat-stroked-button 
                      class="w-full"
                      (click)="cancelOrder()"
                      *ngIf="canCancelOrder()">
                      <mat-icon>cancel</mat-icon>
                      Cancel Order
                    </button>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    </div>
  `,
  styles: [`
    .order-tracking-container {
      min-height: calc(100vh - 120px);
      background: #f8f9fa;
    }

    .current-status-card {
      border-left: 4px solid var(--primary-color);
    }

    .timeline {
      position: relative;
    }

    .timeline-item {
      position: relative;
    }

    .timeline-dot-container {
      width: 48px;
      min-height: 100%;
    }

    .timeline-dot {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: white;
      border: 3px solid #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 2;
    }

    .timeline-item.active .timeline-dot {
      border-color: var(--primary-color);
      background: var(--primary-color);
      color: white;
    }

    .timeline-item.completed .timeline-dot {
      border-color: #4caf50;
      background: #4caf50;
      color: white;
    }

    .timeline-line {
      width: 2px;
      background: #e0e0e0;
      flex-grow: 1;
      margin-top: 8px;
    }

    .timeline-item.completed .timeline-line {
      background: #4caf50;
    }

    .live-indicator .live-dot {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .tracking-tabs ::ng-deep .mat-tab-body-content {
      padding: 0;
    }

    @media (max-width: 768px) {
      .timeline-content {
        flex-direction: column;
        gap: 1rem;
      }
      
      .timeline-dot-container {
        width: 100%;
        flex-direction: row;
        align-items: center;
        min-height: auto;
      }
      
      .timeline-line {
        height: 2px;
        width: 100%;
        margin-top: 0;
        margin-left: 8px;
      }
    }
  `]
})
export class OrderTrackingComponent implements OnInit, OnDestroy {
  @Input() orderId?: string;

  private destroy$ = new Subject<void>();
  private firestoreUnsubscribe?: Unsubscribe;

  order: Order | null = null;
  statusUpdates: OrderStatusUpdate[] = [];
  currentStatus = '';
  loading = false;
  error: string | null = null;
  isConnected = false;

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private authService: AuthService,
    private firestore: Firestore,
    private messaging: Messaging,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Get order ID from route or input
    const routeOrderId = this.route.snapshot.paramMap.get('id');
    this.orderId = this.orderId || routeOrderId || '';

    if (!this.orderId) {
      this.error = 'Order ID not provided';
      return;
    }

    this.initializeFCM();
    this.loadOrder();
    this.setupRealtimeTracking();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.firestoreUnsubscribe) {
      this.firestoreUnsubscribe();
    }
  }

  private async initializeFCM(): Promise<void> {
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Get FCM token
        const token = await getToken(this.messaging, {
          vapidKey: 'YOUR_VAPID_KEY' // Replace with your VAPID key
        });

        if (token) {
          // Save token to backend
          await this.saveFCMToken(token);
        }

        // Listen for foreground messages
        onMessage(this.messaging, (payload) => {
          console.log('Received foreground message:', payload);
          
          if (payload.notification) {
            this.showNotification(payload.notification.title || '', payload.notification.body || '');
          }
        });
      }
    } catch (error) {
      console.error('Error initializing FCM:', error);
    }
  }

  private async saveFCMToken(token: string): Promise<void> {
    // Implementation would call your backend to save the token
    console.log('Saving FCM token:', token);
    // await this.authService.saveFCMToken(token);
  }

  private showNotification(title: string, body: string): void {
    this.snackBar.open(`${title}: ${body}`, 'Close', {
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  private loadOrder(): void {
    if (!this.orderId) return;

    this.loading = true;
    this.error = null;

    this.orderService.trackOrder(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.order = response.order;
          if (response.statusTimeline) {
            this.statusUpdates = response.statusTimeline.updates || [];
            this.currentStatus = response.statusTimeline.currentStatus || this.order.status;
          }
          this.loading = false;
        },
        error: (error) => {
          this.error = error.message || 'Failed to load order';
          this.loading = false;
        }
      });
  }

  private setupRealtimeTracking(): void {
    if (!this.orderId) return;

    // Listen to Firestore document changes
    const orderStatusDoc = doc(this.firestore, 'order_status_updates', this.orderId);
    
    this.firestoreUnsubscribe = onSnapshot(orderStatusDoc, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as OrderStatusTimeline;
        this.statusUpdates = data.updates || [];
        this.currentStatus = data.currentStatus || '';
        this.isConnected = true;
        
        // Show real-time update notification
        if (this.statusUpdates.length > 0) {
          const latestUpdate = this.statusUpdates[0];
          this.showNotification(
            'Order Update',
            `Your order is now ${this.getStatusText(latestUpdate.status)}`
          );
        }
      }
    }, (error) => {
      console.error('Error listening to Firestore:', error);
      this.isConnected = false;
    });
  }

  cancelOrder(): void {
    if (!this.orderId) return;

    const reason = prompt('Please provide a reason for cancellation (optional):');
    
    this.orderService.cancelOrder(this.orderId, reason || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Order cancelled successfully', 'Close', { duration: 3000 });
          this.loadOrder(); // Reload to get updated status
        },
        error: (error) => {
          this.snackBar.open('Failed to cancel order', 'Close', { duration: 3000 });
        }
      });
  }

  canCancelOrder(): boolean {
    if (!this.order) return false;
    
    const cancellableStatuses = ['PENDING', 'CONFIRMED'];
    return cancellableStatuses.includes(this.order.status);
  }

  // Utility methods
  getStatusText(status: string): string {
    const statusTexts: Record<string, string> = {
      'ORDER_RECEIVED': 'Order Received',
      'CONFIRMED': 'Order Confirmed',
      'GRINDING': 'Grinding in Progress',
      'DISPATCHED': 'Order Dispatched',
      'OUT_FOR_DELIVERY': 'Out for Delivery',
      'DELIVERED': 'Delivered',
      'CANCELLED': 'Cancelled'
    };

    return statusTexts[status] || status;
  }

  getStatusIcon(status: string): string {
    const statusIcons: Record<string, string> = {
      'ORDER_RECEIVED': 'receipt',
      'CONFIRMED': 'check_circle',
      'GRINDING': 'settings',
      'DISPATCHED': 'local_shipping',
      'OUT_FOR_DELIVERY': 'delivery_dining',
      'DELIVERED': 'done_all',
      'CANCELLED': 'cancel'
    };

    return statusIcons[status] || 'info';
  }

  getStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      'ORDER_RECEIVED': '#ff9800',
      'CONFIRMED': '#2196f3',
      'GRINDING': '#9c27b0',
      'DISPATCHED': '#3f51b5',
      'OUT_FOR_DELIVERY': '#ff5722',
      'DELIVERED': '#4caf50',
      'CANCELLED': '#f44336'
    };

    return statusColors[status] || '#757575';
  }

  getCurrentStatusMessage(): string {
    if (this.statusUpdates.length === 0) return '';
    
    return this.statusUpdates[0].message || this.getDefaultStatusMessage(this.currentStatus);
  }

  getDefaultStatusMessage(status: string): string {
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
  }

  getLastUpdateTime(): string {
    if (this.statusUpdates.length === 0) return '';
    
    const lastUpdate = this.statusUpdates[0];
    return this.formatDateTime(lastUpdate.timestamp);
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateTime(date: string | Date): string {
    return new Date(date).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  trackByTimestamp(index: number, update: OrderStatusUpdate): string {
    return update.timestamp.toString();
  }
}