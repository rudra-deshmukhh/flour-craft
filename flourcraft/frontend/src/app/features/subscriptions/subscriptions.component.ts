import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { Subject, Observable } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { OrderService } from '../../core/services/order.service';
import { 
  Subscription, 
  SubscriptionFrequency, 
  Order,
  OrderStatus 
} from '../../core/models/product.model';

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatMenuModule
  ],
  template: `
    <div class="subscriptions-container p-4 max-w-6xl mx-auto">
      <div class="header mb-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-2">My Subscriptions</h1>
        <p class="text-gray-600">Manage your regular flour deliveries</p>
      </div>

      <mat-tab-group class="subscription-tabs" animationDuration="300ms">
        <!-- Active Subscriptions Tab -->
        <mat-tab label="Active Subscriptions">
          <div class="tab-content p-4">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold">Active Subscriptions ({{ activeSubscriptions.length }})</h2>
              <button 
                mat-raised-button 
                color="primary" 
                routerLink="/products"
                class="create-subscription-btn">
                <mat-icon>add</mat-icon>
                Create New Subscription
              </button>
            </div>

            <div *ngIf="loading" class="flex justify-center p-8">
              <mat-spinner diameter="40"></mat-spinner>
            </div>

            <div *ngIf="!loading && activeSubscriptions.length === 0" class="empty-state text-center p-8">
              <mat-icon class="text-6xl text-gray-400 mb-4">event_repeat</mat-icon>
              <h3 class="text-xl font-medium text-gray-700 mb-2">No Active Subscriptions</h3>
              <p class="text-gray-500 mb-4">Start a subscription to get fresh flour delivered regularly</p>
              <button mat-raised-button color="primary" routerLink="/products">
                Browse Products
              </button>
            </div>

            <div class="subscriptions-grid grid gap-4" *ngIf="!loading && activeSubscriptions.length > 0">
              <mat-card 
                *ngFor="let subscription of activeSubscriptions" 
                class="subscription-card hover:shadow-lg transition-shadow duration-200">
                <mat-card-header class="pb-2">
                  <div class="flex justify-between items-start w-full">
                    <div>
                      <mat-card-title class="text-lg">
                        {{ getSubscriptionTitle(subscription) }}
                      </mat-card-title>
                      <mat-card-subtitle class="flex items-center gap-2">
                        <mat-chip [style.background-color]="getFrequencyColor(subscription.frequency)" class="text-white text-xs">
                          {{ getFrequencyText(subscription.frequency) }}
                        </mat-chip>
                        <span class="text-sm">{{ subscription.items.length }} items</span>
                      </mat-card-subtitle>
                    </div>
                    
                    <button 
                      mat-icon-button 
                      [matMenuTriggerFor]="subscriptionMenu"
                      class="subscription-menu-btn">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    
                    <mat-menu #subscriptionMenu="matMenu">
                      <button mat-menu-item (click)="editSubscription(subscription)">
                        <mat-icon>edit</mat-icon>
                        <span>Edit Subscription</span>
                      </button>
                      <button mat-menu-item (click)="pauseSubscription(subscription)">
                        <mat-icon>pause</mat-icon>
                        <span>Pause Subscription</span>
                      </button>
                      <button mat-menu-item (click)="viewSubscriptionDetails(subscription)">
                        <mat-icon>visibility</mat-icon>
                        <span>View Details</span>
                      </button>
                      <button mat-menu-item (click)="cancelSubscription(subscription)" class="text-red-600">
                        <mat-icon>cancel</mat-icon>
                        <span>Cancel Subscription</span>
                      </button>
                    </mat-menu>
                  </div>
                </mat-card-header>

                <mat-card-content>
                  <div class="subscription-info space-y-3">
                    <!-- Next Delivery -->
                    <div class="next-delivery bg-blue-50 p-3 rounded-lg">
                      <div class="flex items-center gap-2 mb-1">
                        <mat-icon class="text-blue-600 text-lg">schedule</mat-icon>
                        <span class="font-medium text-blue-800">Next Delivery</span>
                      </div>
                      <p class="text-blue-700 font-semibold">
                        {{ getFormattedDate(subscription.nextDelivery) }}
                      </p>
                      <p class="text-blue-600 text-sm">
                        {{ getDaysUntilDelivery(subscription.nextDelivery) }}
                      </p>
                    </div>

                    <!-- Subscription Items -->
                    <div class="items-summary">
                      <h4 class="font-medium mb-2">Items ({{ subscription.items.length }})</h4>
                      <div class="items-list space-y-1">
                        <div 
                          *ngFor="let item of subscription.items; let i = index" 
                          class="item-row flex justify-between items-center text-sm"
                          [class.hidden]="i >= 3 && !subscription.showAllItems">
                          <span>{{ item.product.name }}</span>
                          <span class="font-medium">{{ item.quantity }} kg</span>
                        </div>
                        <button 
                          *ngIf="subscription.items.length > 3"
                          mat-button 
                          class="show-more-btn text-xs"
                          (click)="toggleShowAllItems(subscription)">
                          {{ subscription.showAllItems ? 'Show Less' : `Show ${subscription.items.length - 3} More` }}
                        </button>
                      </div>
                    </div>

                    <!-- Delivery Address -->
                    <div class="delivery-address">
                      <div class="flex items-center gap-2 mb-1">
                        <mat-icon class="text-gray-600 text-lg">location_on</mat-icon>
                        <span class="font-medium text-gray-700">Delivery Address</span>
                      </div>
                      <p class="text-gray-600 text-sm">
                        {{ subscription.address.line1 }}, {{ subscription.address.city }}
                        <br>{{ subscription.address.state }} - {{ subscription.address.pincode }}
                      </p>
                    </div>

                    <!-- Total Amount -->
                    <div class="total-amount flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span class="font-medium text-green-800">Total Amount</span>
                      <span class="text-lg font-bold text-green-700">
                        {{ formatPrice(subscription.totalAmount) }}
                      </span>
                    </div>
                  </div>
                </mat-card-content>

                <mat-card-actions class="p-4 pt-0">
                  <button 
                    mat-button 
                    color="primary" 
                    (click)="viewSubscriptionDetails(subscription)">
                    View Details
                  </button>
                  <button 
                    mat-button 
                    (click)="viewRecentOrders(subscription)">
                    Recent Orders
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- Paused Subscriptions Tab -->
        <mat-tab label="Paused Subscriptions">
          <div class="tab-content p-4">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold">Paused Subscriptions ({{ pausedSubscriptions.length }})</h2>
            </div>

            <div *ngIf="!loading && pausedSubscriptions.length === 0" class="empty-state text-center p-8">
              <mat-icon class="text-6xl text-gray-400 mb-4">pause_circle_outline</mat-icon>
              <h3 class="text-xl font-medium text-gray-700 mb-2">No Paused Subscriptions</h3>
              <p class="text-gray-500">You can pause any active subscription anytime</p>
            </div>

            <div class="subscriptions-grid grid gap-4" *ngIf="!loading && pausedSubscriptions.length > 0">
              <mat-card 
                *ngFor="let subscription of pausedSubscriptions" 
                class="subscription-card paused-card opacity-75">
                <mat-card-header>
                  <div class="flex justify-between items-start w-full">
                    <div>
                      <mat-card-title class="text-lg">
                        {{ getSubscriptionTitle(subscription) }}
                      </mat-card-title>
                      <mat-card-subtitle class="flex items-center gap-2">
                        <mat-chip class="bg-gray-500 text-white text-xs">Paused</mat-chip>
                        <span class="text-sm">{{ subscription.items.length }} items</span>
                      </mat-card-subtitle>
                    </div>
                  </div>
                </mat-card-header>

                <mat-card-content>
                  <div class="subscription-info space-y-3">
                    <div class="paused-info bg-gray-50 p-3 rounded-lg">
                      <div class="flex items-center gap-2 mb-1">
                        <mat-icon class="text-gray-600 text-lg">pause</mat-icon>
                        <span class="font-medium text-gray-700">Subscription Paused</span>
                      </div>
                      <p class="text-gray-600 text-sm">
                        Resume anytime to continue regular deliveries
                      </p>
                    </div>

                    <div class="total-amount flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span class="font-medium text-gray-700">Amount per delivery</span>
                      <span class="text-lg font-bold text-gray-800">
                        {{ formatPrice(subscription.totalAmount) }}
                      </span>
                    </div>
                  </div>
                </mat-card-content>

                <mat-card-actions class="p-4 pt-0">
                  <button 
                    mat-raised-button 
                    color="primary" 
                    (click)="resumeSubscription(subscription)">
                    Resume Subscription
                  </button>
                  <button 
                    mat-button 
                    (click)="viewSubscriptionDetails(subscription)">
                    View Details
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- Upcoming Deliveries Tab -->
        <mat-tab label="Upcoming Deliveries">
          <div class="tab-content p-4">
            <div class="upcoming-deliveries">
              <h2 class="text-lg font-semibold mb-4">Next 30 Days</h2>
              
              <div *ngIf="upcomingDeliveries.length === 0" class="empty-state text-center p-8">
                <mat-icon class="text-6xl text-gray-400 mb-4">event_available</mat-icon>
                <h3 class="text-xl font-medium text-gray-700 mb-2">No Upcoming Deliveries</h3>
                <p class="text-gray-500">Start a subscription to schedule regular deliveries</p>
              </div>

              <div class="deliveries-timeline space-y-4" *ngIf="upcomingDeliveries.length > 0">
                <div 
                  *ngFor="let delivery of upcomingDeliveries" 
                  class="delivery-item flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50">
                  <div class="delivery-date text-center min-w-16">
                    <div class="date-day text-2xl font-bold text-primary">
                      {{ getDeliveryDay(delivery.nextDelivery) }}
                    </div>
                    <div class="date-month text-sm text-gray-600">
                      {{ getDeliveryMonth(delivery.nextDelivery) }}
                    </div>
                  </div>
                  
                  <div class="delivery-info flex-1">
                    <h4 class="font-medium mb-1">{{ getSubscriptionTitle(delivery) }}</h4>
                    <p class="text-sm text-gray-600 mb-2">
                      {{ delivery.items.length }} items • {{ formatPrice(delivery.totalAmount) }}
                    </p>
                    <div class="delivery-address text-xs text-gray-500">
                      {{ delivery.address.line1 }}, {{ delivery.address.city }}
                    </div>
                  </div>
                  
                  <div class="delivery-actions">
                    <mat-chip [style.background-color]="getFrequencyColor(delivery.frequency)" class="text-white text-xs">
                      {{ getFrequencyText(delivery.frequency) }}
                    </mat-chip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .subscriptions-container {
      min-height: calc(100vh - 120px);
    }

    .subscription-card {
      border-radius: 12px;
      transition: all 0.2s ease-in-out;
    }

    .subscription-card:hover {
      transform: translateY(-2px);
    }

    .paused-card {
      border-left: 4px solid #6b7280;
    }

    .subscriptions-grid {
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    }

    .next-delivery {
      background: linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%);
    }

    .total-amount {
      background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
    }

    .delivery-item {
      border-left: 4px solid var(--primary-color);
    }

    .subscription-tabs ::ng-deep .mat-tab-body-content {
      padding: 0;
    }

    @media (max-width: 768px) {
      .subscriptions-grid {
        grid-template-columns: 1fr;
      }
      
      .subscription-card {
        margin-bottom: 1rem;
      }
    }
  `]
})
export class SubscriptionsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  subscriptions: Subscription[] = [];
  upcomingDeliveries: any[] = [];
  loading = false;
  error: string | null = null;

  get activeSubscriptions(): Subscription[] {
    return this.subscriptions.filter(sub => sub.isActive);
  }

  get pausedSubscriptions(): Subscription[] {
    return this.subscriptions.filter(sub => !sub.isActive);
  }

  constructor(
    private orderService: OrderService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadSubscriptions();
    this.loadUpcomingDeliveries();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSubscriptions(): void {
    this.loading = true;
    this.orderService.getMySubscriptions()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (subscriptions) => {
          this.subscriptions = subscriptions;
        },
        error: (error) => {
          this.error = error.message;
          this.snackBar.open('Failed to load subscriptions', 'Close', { duration: 3000 });
        }
      });
  }

  loadUpcomingDeliveries(): void {
    this.orderService.getUpcomingDeliveries()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.upcomingDeliveries = data.upcomingDeliveries;
        },
        error: (error) => {
          console.error('Failed to load upcoming deliveries:', error);
        }
      });
  }

  pauseSubscription(subscription: Subscription): void {
    if (confirm('Are you sure you want to pause this subscription?')) {
      this.orderService.pauseSubscription(subscription.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.snackBar.open('Subscription paused successfully', 'Close', { duration: 3000 });
            this.loadSubscriptions();
          },
          error: (error) => {
            this.snackBar.open('Failed to pause subscription', 'Close', { duration: 3000 });
          }
        });
    }
  }

  resumeSubscription(subscription: Subscription): void {
    this.orderService.resumeSubscription(subscription.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Subscription resumed successfully', 'Close', { duration: 3000 });
          this.loadSubscriptions();
          this.loadUpcomingDeliveries();
        },
        error: (error) => {
          this.snackBar.open('Failed to resume subscription', 'Close', { duration: 3000 });
        }
      });
  }

  cancelSubscription(subscription: Subscription): void {
    const confirmMessage = 'Are you sure you want to cancel this subscription? This action cannot be undone.';
    if (confirm(confirmMessage)) {
      this.orderService.cancelSubscription(subscription.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.snackBar.open('Subscription cancelled successfully', 'Close', { duration: 3000 });
            this.loadSubscriptions();
          },
          error: (error) => {
            this.snackBar.open('Failed to cancel subscription', 'Close', { duration: 3000 });
          }
        });
    }
  }

  editSubscription(subscription: Subscription): void {
    // TODO: Open edit subscription dialog
    console.log('Edit subscription:', subscription);
  }

  viewSubscriptionDetails(subscription: Subscription): void {
    // TODO: Open subscription details dialog
    console.log('View subscription details:', subscription);
  }

  viewRecentOrders(subscription: Subscription): void {
    // TODO: Navigate to orders filtered by subscription
    console.log('View recent orders for subscription:', subscription);
  }

  toggleShowAllItems(subscription: any): void {
    subscription.showAllItems = !subscription.showAllItems;
  }

  // Utility methods
  getSubscriptionTitle(subscription: any): string {
    const mainProduct = subscription.items[0]?.product?.name || 'Mixed Items';
    return subscription.items.length === 1 ? mainProduct : `${mainProduct} + ${subscription.items.length - 1} more`;
  }

  getFrequencyText(frequency: SubscriptionFrequency): string {
    return this.orderService.getSubscriptionFrequencyText(frequency);
  }

  getFrequencyColor(frequency: SubscriptionFrequency): string {
    const colors = {
      [SubscriptionFrequency.WEEKLY]: '#4CAF50',
      [SubscriptionFrequency.BI_WEEKLY]: '#2196F3',
      [SubscriptionFrequency.MONTHLY]: '#FF9800'
    };
    return colors[frequency] || '#757575';
  }

  getFormattedDate(date: string): string {
    return new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getDaysUntilDelivery(date: string): string {
    const today = new Date();
    const deliveryDate = new Date(date);
    const diffTime = deliveryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 0) return 'Overdue';
    return `In ${diffDays} days`;
  }

  getDeliveryDay(date: string): string {
    return new Date(date).getDate().toString();
  }

  getDeliveryMonth(date: string): string {
    return new Date(date).toLocaleDateString('en-IN', { month: 'short' });
  }

  formatPrice(amount: number): string {
    return this.orderService.formatPrice(amount);
  }
}