import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Subject, takeUntil, interval } from 'rxjs';

import { 
  AdminService, 
  DashboardSummary, 
  Order, 
  DeliveryPartner, 
  StockAlert, 
  Analytics 
} from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';

// Child Components
import { ProductManagementComponent } from './product-management/product-management.component';
import { FlourMillManagementComponent } from './flour-mill-management/flour-mill-management.component';
import { DeliveryPartnerManagementComponent } from './delivery-partner-management/delivery-partner-management.component';
import { OrderManagementComponent } from './order-management/order-management.component';
import { DiscountManagementComponent } from './discount-management/discount-management.component';
import { StockManagementComponent } from './stock-management/stock-management.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { LiveTrackingComponent } from './live-tracking/live-tracking.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatSnackBarModule,
    MatDialogModule,
    MatMenuModule,
    MatToolbarModule,
    ProductManagementComponent,
    FlourMillManagementComponent,
    DeliveryPartnerManagementComponent,
    OrderManagementComponent,
    DiscountManagementComponent,
    StockManagementComponent,
    AnalyticsComponent,
    LiveTrackingComponent
  ],
  template: `
    <div class="admin-dashboard">
      <!-- Header Toolbar -->
      <mat-toolbar class="dashboard-toolbar" color="primary">
        <div class="toolbar-content">
          <div class="toolbar-title">
            <mat-icon>admin_panel_settings</mat-icon>
            <h1>FlourCraft Admin Dashboard</h1>
          </div>
          
          <div class="toolbar-actions">
            <!-- Notifications -->
            <button mat-icon-button [matMenuTriggerFor]="notificationMenu" 
                   [matBadge]="getTotalAlerts()" 
                   [matBadgeHidden]="getTotalAlerts() === 0"
                   matBadgeColor="warn">
              <mat-icon>notifications</mat-icon>
            </button>
            
            <mat-menu #notificationMenu="matMenu" class="notification-menu">
              <div class="notification-header">
                <h3>Notifications</h3>
                <button mat-button (click)="markAllAlertsRead()">Mark all read</button>
              </div>
              <mat-divider></mat-divider>
              
              <div class="notification-item" *ngFor="let alert of stockAlerts.slice(0, 5)">
                <mat-icon [color]="adminService.getSeverityColor(alert.severity)">warning</mat-icon>
                <div class="notification-content">
                  <p><strong>{{ alert.severity }} Stock Alert</strong></p>
                  <p>{{ alert.productName }} at {{ alert.millName }}</p>
                  <small>{{ adminService.formatDateTime(alert.createdAt) }}</small>
                </div>
              </div>
              
              <div class="notification-item" *ngIf="stockAlerts.length === 0">
                <mat-icon>check_circle</mat-icon>
                <div class="notification-content">
                  <p>No active alerts</p>
                </div>
              </div>
              
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="navigateToStockAlerts()">
                <mat-icon>visibility</mat-icon>
                View All Alerts
              </button>
            </mat-menu>

            <!-- Refresh -->
            <button mat-icon-button (click)="refreshData()" [disabled]="isRefreshing">
              <mat-icon [class.spinning]="isRefreshing">refresh</mat-icon>
            </button>

            <!-- User Menu -->
            <button mat-icon-button [matMenuTriggerFor]="userMenu">
              <mat-icon>account_circle</mat-icon>
            </button>
            
            <mat-menu #userMenu="matMenu">
              <div class="user-info">
                <p><strong>{{ currentUser?.name }}</strong></p>
                <p>{{ currentUser?.email }}</p>
              </div>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="logout()">
                <mat-icon>logout</mat-icon>
                Logout
              </button>
            </mat-menu>
          </div>
        </div>
      </mat-toolbar>

      <!-- Dashboard Summary Cards -->
      <div class="dashboard-summary" *ngIf="dashboardSummary">
        <div class="summary-grid">
          <mat-card class="summary-card orders-card">
            <mat-card-content>
              <div class="card-header">
                <mat-icon>shopping_cart</mat-icon>
                <div class="card-values">
                  <h2>{{ dashboardSummary.totalOrders }}</h2>
                  <p>Total Orders</p>
                  <small>{{ dashboardSummary.activeOrders }} active</small>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card revenue-card">
            <mat-card-content>
              <div class="card-header">
                <mat-icon>account_balance_wallet</mat-icon>
                <div class="card-values">
                  <h2>{{ adminService.formatCurrency(dashboardSummary.totalRevenue) }}</h2>
                  <p>Total Revenue</p>
                  <small>{{ adminService.formatCurrency(dashboardSummary.todayRevenue) }} today</small>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card mills-card">
            <mat-card-content>
              <div class="card-header">
                <mat-icon>factory</mat-icon>
                <div class="card-values">
                  <h2>{{ dashboardSummary.activeMills }}</h2>
                  <p>Active Mills</p>
                  <small>Processing orders</small>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card partners-card">
            <mat-card-content>
              <div class="card-header">
                <mat-icon>delivery_dining</mat-icon>
                <div class="card-values">
                  <h2>{{ dashboardSummary.availablePartners }}</h2>
                  <p>Available Partners</p>
                  <small>Ready for delivery</small>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card today-card">
            <mat-card-content>
              <div class="card-header">
                <mat-icon>today</mat-icon>
                <div class="card-values">
                  <h2>{{ dashboardSummary.todayOrders }}</h2>
                  <p>Today's Orders</p>
                  <small>{{ ((dashboardSummary.todayOrders / dashboardSummary.totalOrders) * 100).toFixed(1) }}% of total</small>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card alerts-card" [class.has-alerts]="dashboardSummary.lowStockAlerts > 0">
            <mat-card-content>
              <div class="card-header">
                <mat-icon>warning</mat-icon>
                <div class="card-values">
                  <h2>{{ dashboardSummary.lowStockAlerts }}</h2>
                  <p>Stock Alerts</p>
                  <small>{{ dashboardSummary.lowStockAlerts > 0 ? 'Requires attention' : 'All good' }}</small>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>

      <!-- Main Content Tabs -->
      <mat-tab-group class="main-tabs" 
                    [(selectedIndex)]="selectedTabIndex"
                    animationDuration="300ms">
        
        <!-- Overview Tab -->
        <mat-tab label="Overview">
          <ng-template matTabContent>
            <div class="overview-content">
              <!-- Quick Actions -->
              <div class="quick-actions">
                <h2>Quick Actions</h2>
                <div class="action-cards">
                  <mat-card class="action-card" (click)="navigateToTab(1)">
                    <mat-card-content>
                      <mat-icon>add_shopping_cart</mat-icon>
                      <h3>Add Product</h3>
                      <p>Create new product</p>
                    </mat-card-content>
                  </mat-card>

                  <mat-card class="action-card" (click)="navigateToTab(4)">
                    <mat-card-content>
                      <mat-icon>local_offer</mat-icon>
                      <h3>Create Discount</h3>
                      <p>Setup new promotion</p>
                    </mat-card-content>
                  </mat-card>

                  <mat-card class="action-card" (click)="navigateToTab(6)">
                    <mat-card-content>
                      <mat-icon>analytics</mat-icon>
                      <h3>View Analytics</h3>
                      <p>Business insights</p>
                    </mat-card-content>
                  </mat-card>

                  <mat-card class="action-card" (click)="navigateToTab(7)">
                    <mat-card-content>
                      <mat-icon>gps_fixed</mat-icon>
                      <h3>Live Tracking</h3>
                      <p>Monitor deliveries</p>
                    </mat-card-content>
                  </mat-card>
                </div>
              </div>

              <!-- Recent Activity -->
              <div class="recent-activity">
                <h2>Recent Orders</h2>
                <div class="order-list">
                  <mat-card *ngFor="let order of recentOrders" class="order-card">
                    <mat-card-content>
                      <div class="order-header">
                        <span class="order-number">#{{ order.orderNumber }}</span>
                        <mat-chip [color]="adminService.getStatusColor(order.status)" selected>
                          {{ order.status }}
                        </mat-chip>
                      </div>
                      <div class="order-details">
                        <p><strong>{{ order.customerName }}</strong></p>
                        <p>{{ adminService.formatCurrency(order.finalAmount) }} • {{ order.orderItems.length }} items</p>
                        <p><small>{{ adminService.formatDateTime(order.createdAt) }}</small></p>
                      </div>
                    </mat-card-content>
                  </mat-card>
                </div>
              </div>
            </div>
          </ng-template>
        </mat-tab>

        <!-- Product Management -->
        <mat-tab label="Products">
          <ng-template matTabContent>
            <app-product-management></app-product-management>
          </ng-template>
        </mat-tab>

        <!-- Flour Mill Management -->
        <mat-tab label="Flour Mills">
          <ng-template matTabContent>
            <app-flour-mill-management></app-flour-mill-management>
          </ng-template>
        </mat-tab>

        <!-- Delivery Partners -->
        <mat-tab label="Delivery Partners">
          <ng-template matTabContent>
            <app-delivery-partner-management></app-delivery-partner-management>
          </ng-template>
        </mat-tab>

        <!-- Order Management -->
        <mat-tab label="Orders" [disabled]="false">
          <ng-template matTabContent>
            <app-order-management></app-order-management>
          </ng-template>
        </mat-tab>

        <!-- Discount Management -->
        <mat-tab label="Discounts">
          <ng-template matTabContent>
            <app-discount-management></app-discount-management>
          </ng-template>
        </mat-tab>

        <!-- Stock Management -->
        <mat-tab label="Stock Management">
          <ng-template matTabContent>
            <app-stock-management></app-stock-management>
          </ng-template>
        </mat-tab>

        <!-- Analytics -->
        <mat-tab label="Analytics">
          <ng-template matTabContent>
            <app-analytics></app-analytics>
          </ng-template>
        </mat-tab>

        <!-- Live Tracking -->
        <mat-tab label="Live Tracking">
          <ng-template matTabContent>
            <app-live-tracking></app-live-tracking>
          </ng-template>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  dashboardSummary: DashboardSummary | null = null;
  recentOrders: Order[] = [];
  stockAlerts: StockAlert[] = [];
  currentUser: any = null;
  
  selectedTabIndex = 0;
  isRefreshing = false;

  constructor(
    public adminService: AdminService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // Check admin access
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser || this.currentUser.role !== 'ADMIN') {
      this.snackBar.open('Access denied. Admin role required.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.loadInitialData();
    this.setupSubscriptions();
    this.setupAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadInitialData(): void {
    this.adminService.loadDashboardSummary();
    this.adminService.loadOrders({ limit: 10 });
    this.adminService.loadStockAlerts();
    this.adminService.loadDeliveryPartners();
  }

  private setupSubscriptions(): void {
    this.adminService.dashboardSummary$
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => {
        this.dashboardSummary = summary;
      });

    this.adminService.orders$
      .pipe(takeUntil(this.destroy$))
      .subscribe(orders => {
        this.recentOrders = orders.slice(0, 5);
      });

    this.adminService.stockAlerts$
      .pipe(takeUntil(this.destroy$))
      .subscribe(alerts => {
        this.stockAlerts = alerts.filter(alert => !alert.isResolved);
      });
  }

  private setupAutoRefresh(): void {
    // Refresh data every 5 minutes
    interval(5 * 60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.adminService.refreshData();
      });
  }

  // Navigation
  navigateToTab(tabIndex: number): void {
    this.selectedTabIndex = tabIndex;
  }

  navigateToStockAlerts(): void {
    this.selectedTabIndex = 6; // Stock Management tab
  }

  // Actions
  refreshData(): void {
    this.isRefreshing = true;
    this.adminService.refreshData();
    
    setTimeout(() => {
      this.isRefreshing = false;
      this.snackBar.open('Data refreshed', 'Close', { duration: 2000 });
    }, 2000);
  }

  markAllAlertsRead(): void {
    // In a real app, this would mark alerts as read
    this.snackBar.open('All alerts marked as read', 'Close', { duration: 2000 });
  }

  logout(): void {
    this.authService.logout();
  }

  // Utility Methods
  getTotalAlerts(): number {
    return this.stockAlerts.length;
  }

  getCardClass(cardType: string): string {
    const classes = ['summary-card'];
    classes.push(`${cardType}-card`);
    
    if (cardType === 'alerts' && this.getTotalAlerts() > 0) {
      classes.push('has-alerts');
    }
    
    return classes.join(' ');
  }
}