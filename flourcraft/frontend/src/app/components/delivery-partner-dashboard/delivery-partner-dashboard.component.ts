import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/spinner';
import { MatBottomSheetModule, MatBottomSheet } from '@angular/material/bottom-sheet';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, interval } from 'rxjs';

import { 
  DeliveryPartnerService, 
  DeliveryPartner, 
  DeliveryOrder, 
  LocalityGroup, 
  OptimizedRoute, 
  DeliveryStats 
} from '../../services/delivery-partner.service';
import { AuthService } from '../../services/auth.service';
import { DeliveryConfirmationComponent } from './delivery-confirmation/delivery-confirmation.component';
import { RoutePreviewComponent } from './route-preview/route-preview.component';
import { OrderDetailsSheetComponent } from './order-details-sheet/order-details-sheet.component';

@Component({
  selector: 'app-delivery-partner-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    MatExpansionModule,
    MatListModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatBottomSheetModule,
    FormsModule
  ],
  template: `
    <div class="delivery-dashboard" *ngIf="partner">
      <!-- Header with Partner Info -->
      <div class="dashboard-header">
        <div class="partner-info">
          <div class="partner-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="partner-details">
            <h2>{{ partner.name }}</h2>
            <p>{{ partner.vehicleType }} - {{ partner.vehicleNumber }}</p>
            <div class="rating-info">
              <mat-icon>star</mat-icon>
              <span>{{ partner.ratings.average.toFixed(1) }} ({{ partner.ratings.count }} reviews)</span>
            </div>
          </div>
        </div>
        
        <div class="partner-controls">
          <div class="availability-toggle">
            <mat-slide-toggle 
              [(ngModel)]="partner.isAvailable"
              (change)="toggleAvailability()"
              [disabled]="isUpdatingAvailability">
              {{ partner.isAvailable ? 'Available' : 'Offline' }}
            </mat-slide-toggle>
          </div>
          
          <div class="location-status" [class.tracking]="isTrackingLocation">
            <mat-icon>{{ isTrackingLocation ? 'gps_fixed' : 'gps_off' }}</mat-icon>
            <span>{{ isTrackingLocation ? 'Tracking' : 'GPS Off' }}</span>
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid" *ngIf="stats">
        <mat-card class="stat-card orders-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>local_shipping</mat-icon>
            </div>
            <div class="stat-info">
              <h3>{{ stats.pendingOrders }}</h3>
              <p>Pending Deliveries</p>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card earnings-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
            <div class="stat-info">
              <h3>{{ deliveryService.formatCurrency(stats.totalEarnings) }}</h3>
              <p>Today's Earnings</p>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card completion-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <div class="stat-info">
              <h3>{{ stats.completionRate }}%</h3>
              <p>Completion Rate</p>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card rating-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>star</mat-icon>
            </div>
            <div class="stat-info">
              <h3>{{ stats.averageRating.toFixed(1) }}</h3>
              <p>Average Rating</p>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Main Content Tabs -->
      <mat-tab-group class="main-tabs" [(selectedIndex)]="selectedTabIndex">
        
        <!-- Localities Tab -->
        <mat-tab label="Localities" [disabled]="localityGroups.length === 0">
          <ng-template matTabContent>
            <div class="tab-content">
              <div class="tab-header">
                <h2>Delivery Areas</h2>
                <div class="tab-actions">
                  <button mat-raised-button color="primary" 
                         (click)="generateOptimizedRoute()"
                         [disabled]="selectedGroups.length === 0 || isGeneratingRoute">
                    <mat-icon>route</mat-icon>
                    Generate Route
                  </button>
                  <button mat-raised-button (click)="refreshData()">
                    <mat-icon>refresh</mat-icon>
                    Refresh
                  </button>
                </div>
              </div>

              <div class="localities-grid" *ngIf="localityGroups.length > 0; else noLocalitiesTemplate">
                <mat-card *ngFor="let group of localityGroups; trackBy: trackByLocality" 
                         class="locality-card"
                         [class.selected]="isGroupSelected(group)"
                         (click)="toggleGroupSelection(group)">
                  <mat-card-header>
                    <mat-card-title>
                      <div class="locality-header">
                        <div class="locality-info">
                          <h3>{{ group.locality }}</h3>
                          <p>{{ group.pincode }}</p>
                        </div>
                        <div class="locality-stats">
                          <mat-chip color="primary" selected>
                            {{ group.totalOrders }} orders
                          </mat-chip>
                        </div>
                      </div>
                    </mat-card-title>
                  </mat-card-header>

                  <mat-card-content>
                    <div class="locality-summary">
                      <div class="summary-item">
                        <mat-icon>attach_money</mat-icon>
                        <span>{{ deliveryService.formatCurrency(group.totalAmount) }}</span>
                      </div>
                      <div class="summary-item">
                        <mat-icon>access_time</mat-icon>
                        <span>{{ deliveryService.formatTime(group.estimatedTime) }}</span>
                      </div>
                    </div>

                    <!-- Order List -->
                    <mat-expansion-panel class="orders-panel">
                      <mat-expansion-panel-header>
                        <mat-panel-title>View Orders</mat-panel-title>
                      </mat-expansion-panel-header>
                      
                      <div class="orders-list">
                        <div *ngFor="let order of group.orders" 
                             class="order-item"
                             (click)="showOrderDetails(order)">
                          <div class="order-header">
                            <strong>#{{ order.orderNumber }}</strong>
                            <mat-chip [color]="getOrderStatusColor(order.status)" selected>
                              {{ order.status }}
                            </mat-chip>
                          </div>
                          <div class="order-details">
                            <p><mat-icon>person</mat-icon> {{ order.customerName }}</p>
                            <p><mat-icon>location_on</mat-icon> {{ getShortAddress(order.address.fullAddress) }}</p>
                            <p><mat-icon>account_balance_wallet</mat-icon> {{ deliveryService.formatCurrency(order.finalAmount) }}</p>
                          </div>
                        </div>
                      </div>
                    </mat-expansion-panel>
                  </mat-card-content>

                  <mat-card-actions>
                    <button mat-button (click)="startSingleLocalityDelivery(group); $event.stopPropagation()">
                      <mat-icon>directions</mat-icon>
                      Start Delivery
                    </button>
                  </mat-card-actions>
                </mat-card>
              </div>

              <ng-template #noLocalitiesTemplate>
                <div class="no-content">
                  <mat-icon>location_off</mat-icon>
                  <h3>No Delivery Areas</h3>
                  <p>You don't have any assigned deliveries at the moment.</p>
                  <button mat-raised-button color="primary" (click)="refreshData()">
                    <mat-icon>refresh</mat-icon>
                    Check for New Orders
                  </button>
                </div>
              </ng-template>
            </div>
          </ng-template>
        </mat-tab>

        <!-- Active Route Tab -->
        <mat-tab label="Active Route" [disabled]="!currentRoute">
          <ng-template matTabContent>
            <div class="tab-content" *ngIf="currentRoute">
              <div class="route-header">
                <h2>Active Delivery Route</h2>
                <div class="route-stats">
                  <mat-chip color="accent" selected>
                    <mat-icon>straighten</mat-icon>
                    {{ currentRoute.totalDistance.toFixed(1) }} km
                  </mat-chip>
                  <mat-chip color="accent" selected>
                    <mat-icon>access_time</mat-icon>
                    {{ deliveryService.formatTime(currentRoute.totalDuration) }}
                  </mat-chip>
                </div>
              </div>

              <div class="route-actions">
                <button mat-raised-button color="primary" 
                       (click)="launchGoogleMaps()"
                       class="maps-button">
                  <mat-icon>map</mat-icon>
                  Open in Google Maps
                </button>
                <button mat-button (click)="previewRoute()">
                  <mat-icon>visibility</mat-icon>
                  Preview Route
                </button>
              </div>

              <!-- Waypoints List -->
              <div class="waypoints-list">
                <div *ngFor="let waypoint of currentRoute.waypoints; let i = index" 
                     class="waypoint-card"
                     [class.completed]="waypoint.completed"
                     [class.current]="isCurrentWaypoint(i)">
                  
                  <div class="waypoint-number">
                    <span *ngIf="!waypoint.completed">{{ i + 1 }}</span>
                    <mat-icon *ngIf="waypoint.completed" color="primary">check_circle</mat-icon>
                  </div>

                  <div class="waypoint-details">
                    <h4>{{ waypoint.address }}</h4>
                    <p>{{ getOrderForWaypoint(waypoint.orderId)?.customerName }}</p>
                    <p>{{ getOrderForWaypoint(waypoint.orderId)?.customerPhone }}</p>
                    <div class="waypoint-meta">
                      <span><mat-icon>schedule</mat-icon> {{ deliveryService.formatDateTime(waypoint.estimatedArrival) }}</span>
                      <span><mat-icon>attach_money</mat-icon> {{ getOrderForWaypoint(waypoint.orderId) ? deliveryService.formatCurrency(getOrderForWaypoint(waypoint.orderId)!.finalAmount) : '' }}</span>
                    </div>
                  </div>

                  <div class="waypoint-actions">
                    <button mat-raised-button color="primary"
                           *ngIf="!waypoint.completed && isCurrentWaypoint(i)"
                           (click)="markAsDelivered(waypoint.orderId)">
                      <mat-icon>done</mat-icon>
                      Delivered
                    </button>
                    <button mat-button 
                           (click)="showOrderDetails(getOrderForWaypoint(waypoint.orderId)!)">
                      <mat-icon>visibility</mat-icon>
                      Details
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="tab-content" *ngIf="!currentRoute">
              <div class="no-content">
                <mat-icon>route</mat-icon>
                <h3>No Active Route</h3>
                <p>Generate an optimized route from the Localities tab to start deliveries.</p>
              </div>
            </div>
          </ng-template>
        </mat-tab>

        <!-- All Orders Tab -->
        <mat-tab label="All Orders">
          <ng-template matTabContent>
            <div class="tab-content">
              <div class="tab-header">
                <h2>All Assigned Orders</h2>
                <div class="tab-actions">
                  <button mat-raised-button (click)="refreshData()">
                    <mat-icon>refresh</mat-icon>
                    Refresh
                  </button>
                </div>
              </div>

              <div class="orders-grid" *ngIf="assignedOrders.length > 0; else noOrdersTemplate">
                <mat-card *ngFor="let order of assignedOrders; trackBy: trackByOrder" 
                         class="order-card"
                         [class]="'status-' + order.status.toLowerCase().replace('_', '-')">
                  
                  <mat-card-header>
                    <mat-card-title>
                      <div class="order-header">
                        <span>Order #{{ order.orderNumber }}</span>
                        <mat-chip [color]="getOrderStatusColor(order.status)" selected>
                          {{ order.status }}
                        </mat-chip>
                      </div>
                    </mat-card-title>
                    <mat-card-subtitle>
                      {{ order.customerName }} • {{ order.customerPhone }}
                    </mat-card-subtitle>
                  </mat-card-header>

                  <mat-card-content>
                    <div class="order-details">
                      <div class="detail-row">
                        <mat-icon>location_on</mat-icon>
                        <span>{{ order.address.fullAddress }}</span>
                      </div>
                      <div class="detail-row">
                        <mat-icon>inventory</mat-icon>
                        <span>{{ order.orderItems.length }} items</span>
                      </div>
                      <div class="detail-row">
                        <mat-icon>account_balance_wallet</mat-icon>
                        <span>{{ deliveryService.formatCurrency(order.finalAmount) }}</span>
                      </div>
                      <div class="detail-row" *ngIf="order.specialInstructions">
                        <mat-icon>note</mat-icon>
                        <span>{{ order.specialInstructions }}</span>
                      </div>
                    </div>
                  </mat-card-content>

                  <mat-card-actions>
                    <button mat-button (click)="showOrderDetails(order)">
                      <mat-icon>visibility</mat-icon>
                      Details
                    </button>
                    <button mat-raised-button color="primary"
                           *ngIf="order.status === 'OUT_FOR_DELIVERY'"
                           (click)="markAsDelivered(order.id)">
                      <mat-icon>done</mat-icon>
                      Mark Delivered
                    </button>
                  </mat-card-actions>
                </mat-card>
              </div>

              <ng-template #noOrdersTemplate>
                <div class="no-content">
                  <mat-icon>assignment</mat-icon>
                  <h3>No Orders Assigned</h3>
                  <p>You don't have any assigned orders at the moment.</p>
                </div>
              </ng-template>
            </div>
          </ng-template>
        </mat-tab>
      </mat-tab-group>
    </div>

    <!-- Loading State -->
    <div class="loading-container" *ngIf="!partner">
      <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
      <p>Loading delivery dashboard...</p>
    </div>
  `,
  styleUrls: ['./delivery-partner-dashboard.component.scss']
})
export class DeliveryPartnerDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  partner: DeliveryPartner | null = null;
  assignedOrders: DeliveryOrder[] = [];
  localityGroups: LocalityGroup[] = [];
  currentRoute: OptimizedRoute | null = null;
  stats: DeliveryStats | null = null;

  selectedTabIndex = 0;
  selectedGroups: LocalityGroup[] = [];
  isUpdatingAvailability = false;
  isGeneratingRoute = false;
  isTrackingLocation = false;

  constructor(
    public deliveryService: DeliveryPartnerService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private bottomSheet: MatBottomSheet
  ) {}

  ngOnInit(): void {
    // Check if user has delivery partner access
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'DELIVERY_PARTNER') {
      this.snackBar.open('Access denied. Delivery partner role required.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.loadInitialData();
    this.setupSubscriptions();
    this.setupAutoRefresh();
    this.startLocationTracking();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.deliveryService.stopLocationTracking();
  }

  private loadInitialData(): void {
    this.loadPartnerProfile();
    this.deliveryService.loadAssignedOrders();
    this.deliveryService.loadPartnerStats();
  }

  private loadPartnerProfile(): void {
    this.deliveryService.getPartnerProfile().subscribe({
      next: (response) => {
        if (response.success) {
          this.partner = response.data;
        }
      },
      error: (error) => {
        this.snackBar.open('Failed to load partner profile', 'Close', { duration: 3000 });
      }
    });
  }

  private setupSubscriptions(): void {
    this.deliveryService.assignedOrders$
      .pipe(takeUntil(this.destroy$))
      .subscribe(orders => {
        this.assignedOrders = orders;
      });

    this.deliveryService.localityGroups$
      .pipe(takeUntil(this.destroy$))
      .subscribe(groups => {
        this.localityGroups = groups;
      });

    this.deliveryService.currentRoute$
      .pipe(takeUntil(this.destroy$))
      .subscribe(route => {
        this.currentRoute = route;
        if (route) {
          this.selectedTabIndex = 1; // Switch to Active Route tab
        }
      });

    this.deliveryService.partnerStats$
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.stats = stats;
      });

    this.deliveryService.isTrackingLocation$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isTracking => {
        this.isTrackingLocation = isTracking;
      });
  }

  private setupAutoRefresh(): void {
    // Refresh data every 2 minutes
    interval(2 * 60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.deliveryService.refreshData();
      });
  }

  private startLocationTracking(): void {
    if (this.partner?.isAvailable) {
      this.deliveryService.startLocationTracking();
    }
  }

  // Partner Controls
  toggleAvailability(): void {
    if (!this.partner) return;

    this.isUpdatingAvailability = true;
    this.deliveryService.updateAvailability(this.partner.isAvailable).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open(response.message, 'Close', { duration: 3000 });
          
          if (this.partner!.isAvailable) {
            this.startLocationTracking();
          } else {
            this.deliveryService.stopLocationTracking();
          }
        }
        this.isUpdatingAvailability = false;
      },
      error: (error) => {
        // Revert the toggle
        this.partner!.isAvailable = !this.partner!.isAvailable;
        this.snackBar.open('Failed to update availability', 'Close', { duration: 3000 });
        this.isUpdatingAvailability = false;
      }
    });
  }

  // Locality Management
  toggleGroupSelection(group: LocalityGroup): void {
    const index = this.selectedGroups.findIndex(g => g.pincode === group.pincode);
    if (index > -1) {
      this.selectedGroups.splice(index, 1);
    } else {
      this.selectedGroups.push(group);
    }
  }

  isGroupSelected(group: LocalityGroup): boolean {
    return this.selectedGroups.some(g => g.pincode === group.pincode);
  }

  // Route Generation
  generateOptimizedRoute(): void {
    if (this.selectedGroups.length === 0) {
      this.snackBar.open('Please select at least one locality', 'Close', { duration: 3000 });
      return;
    }

    this.isGeneratingRoute = true;
    this.deliveryService.generateOptimizedRoute(this.selectedGroups).subscribe({
      next: (response) => {
        if (response.success) {
          this.currentRoute = response.data;
          this.selectedTabIndex = 1; // Switch to Active Route tab
          this.snackBar.open('Route generated successfully!', 'Close', { duration: 3000 });
          
          // Show route preview
          this.previewRoute();
        }
        this.isGeneratingRoute = false;
      },
      error: (error) => {
        this.snackBar.open('Failed to generate route', 'Close', { duration: 3000 });
        this.isGeneratingRoute = false;
      }
    });
  }

  startSingleLocalityDelivery(group: LocalityGroup): void {
    this.selectedGroups = [group];
    this.generateOptimizedRoute();
  }

  // Google Maps Integration
  launchGoogleMaps(): void {
    if (this.currentRoute) {
      this.deliveryService.launchGoogleMaps(this.currentRoute);
    }
  }

  previewRoute(): void {
    if (this.currentRoute) {
      this.dialog.open(RoutePreviewComponent, {
        width: '90vw',
        maxWidth: '800px',
        data: { route: this.currentRoute }
      });
    }
  }

  // Order Management
  markAsDelivered(orderId: string): void {
    // Get current location for delivery confirmation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const dialogRef = this.dialog.open(DeliveryConfirmationComponent, {
            width: '500px',
            data: {
              orderId,
              location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              }
            }
          });

          dialogRef.afterClosed().subscribe(result => {
            if (result) {
              this.processDeliveryCompletion(orderId, result);
            }
          });
        },
        (error) => {
          this.snackBar.open('Location access required for delivery confirmation', 'Close', { 
            duration: 5000 
          });
        }
      );
    } else {
      this.snackBar.open('Geolocation not supported', 'Close', { duration: 3000 });
    }
  }

  private processDeliveryCompletion(orderId: string, deliveryData: any): void {
    this.deliveryService.markOrderAsDelivered(orderId, deliveryData).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Order marked as delivered!', 'Close', { duration: 3000 });
          
          // Update local data
          this.updateLocalOrderStatus(orderId);
          
          // Request rating from customer
          this.deliveryService.requestRating(orderId).subscribe();
          
          // Refresh data
          this.deliveryService.refreshData();
        }
      },
      error: (error) => {
        this.snackBar.open('Failed to mark order as delivered', 'Close', { duration: 3000 });
      }
    });
  }

  private updateLocalOrderStatus(orderId: string): void {
    // Update order status in local arrays
    const updateOrder = (order: DeliveryOrder) => {
      if (order.id === orderId) {
        order.status = 'DELIVERED';
        order.deliveredAt = new Date().toISOString();
      }
    };

    this.assignedOrders.forEach(updateOrder);
    this.localityGroups.forEach(group => {
      group.orders.forEach(updateOrder);
    });

    // Update route waypoints
    if (this.currentRoute) {
      const waypoint = this.currentRoute.waypoints.find(wp => wp.orderId === orderId);
      if (waypoint) {
        waypoint.completed = true;
      }
    }
  }

  showOrderDetails(order: DeliveryOrder): void {
    this.bottomSheet.open(OrderDetailsSheetComponent, {
      data: { order }
    });
  }

  // Route Management
  isCurrentWaypoint(index: number): boolean {
    if (!this.currentRoute) return false;
    
    const completedCount = this.currentRoute.waypoints.filter(wp => wp.completed).length;
    return index === completedCount;
  }

  getOrderForWaypoint(orderId: string): DeliveryOrder | undefined {
    return this.assignedOrders.find(order => order.id === orderId);
  }

  // Utility Methods
  trackByLocality(index: number, group: LocalityGroup): string {
    return group.pincode;
  }

  trackByOrder(index: number, order: DeliveryOrder): string {
    return order.id;
  }

  getOrderStatusColor(status: string): string {
    const statusColors: { [key: string]: string } = {
      'OUT_FOR_DELIVERY': 'primary',
      'DELIVERED': 'accent'
    };
    return statusColors[status] || 'primary';
  }

  getShortAddress(fullAddress: string): string {
    const parts = fullAddress.split(',');
    return parts.length > 2 ? parts.slice(0, 2).join(',') + '...' : fullAddress;
  }

  refreshData(): void {
    this.deliveryService.refreshData();
    this.loadPartnerProfile();
    this.snackBar.open('Data refreshed', 'Close', { duration: 2000 });
  }
}