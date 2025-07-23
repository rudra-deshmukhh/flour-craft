import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/spinner';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil, interval } from 'rxjs';

import { FlourMillService, FlourMillDashboard, MillOrder, MillInventory, StockAlert } from '../../services/flour-mill.service';
import { AuthService } from '../../services/auth.service';
import { StockUpdateDialogComponent } from './stock-update-dialog/stock-update-dialog.component';
import { OrderDetailsDialogComponent } from './order-details-dialog/order-details-dialog.component';
import { AlertResolveDialogComponent } from './alert-resolve-dialog/alert-resolve-dialog.component';

@Component({
  selector: 'app-flour-mill-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatProgressBarModule,
    MatChipsModule,
    MatSnackBarModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    FormsModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="flour-mill-dashboard" *ngIf="dashboard">
      <div class="dashboard-header">
        <div class="mill-info">
          <h1>{{ dashboard.flourMill.name }}</h1>
          <p class="mill-address">{{ dashboard.flourMill.address }}</p>
          <div class="capacity-info">
            <mat-icon>factory</mat-icon>
            <span>Capacity: {{ dashboard.flourMill.capacity }} kg/day</span>
          </div>
        </div>
        
        <div class="dashboard-actions">
          <button mat-raised-button color="primary" (click)="refreshDashboard()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
          <button mat-raised-button color="accent" (click)="initializeInventory()">
            <mat-icon>inventory</mat-icon>
            Setup Inventory
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <mat-card class="stat-card orders-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>assignment</mat-icon>
            </div>
            <div class="stat-info">
              <h2>{{ dashboard.stats.pendingOrders }}</h2>
              <p>Pending Orders</p>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card grinding-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>settings</mat-icon>
            </div>
            <div class="stat-info">
              <h2>{{ dashboard.stats.grindingOrders }}</h2>
              <p>Currently Grinding</p>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card completed-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <div class="stat-info">
              <h2>{{ dashboard.stats.completedTodayOrders }}</h2>
              <p>Completed Today</p>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card alerts-card" [class.has-alerts]="dashboard.stats.activeAlerts > 0">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon [matBadge]="dashboard.stats.activeAlerts" 
                       [matBadgeHidden]="dashboard.stats.activeAlerts === 0"
                       matBadgeColor="warn">warning</mat-icon>
            </div>
            <div class="stat-info">
              <h2>{{ dashboard.stats.lowStockItems }}</h2>
              <p>Low Stock Items</p>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Main Content Tabs -->
      <mat-tab-group class="main-tabs" [(selectedIndex)]="selectedTabIndex">
        
        <!-- Orders Tab -->
        <mat-tab label="Orders">
          <ng-template matTabContent>
            <div class="tab-content">
              <div class="tab-header">
                <h2>Assigned Orders</h2>
                <div class="tab-actions">
                  <mat-form-field appearance="outline">
                    <mat-label>Filter by Status</mat-label>
                    <mat-select [(value)]="selectedOrderStatus" (selectionChange)="onOrderStatusChange()">
                      <mat-option value="">All Orders</mat-option>
                      <mat-option value="CONFIRMED">Confirmed</mat-option>
                      <mat-option value="GRINDING">Grinding</mat-option>
                      <mat-option value="DISPATCHED">Dispatched</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <button mat-raised-button color="primary" (click)="refreshOrders()">
                    <mat-icon>refresh</mat-icon>
                    Refresh
                  </button>
                </div>
              </div>

              <div class="orders-table" *ngIf="orders.length > 0; else noOrdersTemplate">
                <mat-card *ngFor="let order of orders" class="order-card" 
                         [class]="'status-' + order.status.toLowerCase()">
                  <mat-card-header>
                    <mat-card-title>
                      Order #{{ order.orderNumber }}
                      <mat-chip [color]="flourMillService.getOrderStatusColor(order.status)" selected>
                        {{ order.status }}
                      </mat-chip>
                    </mat-card-title>
                    <mat-card-subtitle>
                      Customer: {{ order.user.firstName }} {{ order.user.lastName }}
                      <br>
                      Phone: {{ order.user.phoneNumber }}
                    </mat-card-subtitle>
                  </mat-card-header>
                  
                  <mat-card-content>
                    <div class="order-items">
                      <h4>Items:</h4>
                      <div class="item-list">
                        <div *ngFor="let item of order.orderItems" class="order-item">
                          <span class="item-name">{{ item.product.name }}</span>
                          <span class="item-quantity">{{ item.quantity }} kg</span>
                          <span class="item-price">₹{{ item.pricePerKg }}/kg</span>
                        </div>
                      </div>
                    </div>
                    
                    <div class="order-meta">
                      <div class="meta-item">
                        <strong>Total Amount:</strong> ₹{{ order.finalAmount }}
                      </div>
                      <div class="meta-item" *ngIf="order.deliverySlot">
                        <strong>Delivery Slot:</strong> {{ flourMillService.formatDateTime(order.deliverySlot) }}
                      </div>
                      <div class="meta-item">
                        <strong>Address:</strong> {{ order.address.fullAddress }}, {{ order.address.pincode }}
                      </div>
                    </div>

                    <!-- Grinding Timeline -->
                    <div class="grinding-timeline" *ngIf="order.status === 'GRINDING' || order.grindingStarted">
                      <div class="timeline-item" [class.completed]="order.grindingStarted">
                        <mat-icon>play_circle</mat-icon>
                        <span>Grinding Started</span>
                        <span *ngIf="order.grindingStarted" class="timestamp">
                          {{ flourMillService.formatDateTime(order.grindingStarted) }}
                        </span>
                      </div>
                      <div class="timeline-item" [class.completed]="order.grindingCompleted">
                        <mat-icon>check_circle</mat-icon>
                        <span>Grinding Completed</span>
                        <span *ngIf="order.grindingCompleted" class="timestamp">
                          {{ flourMillService.formatDateTime(order.grindingCompleted) }}
                        </span>
                      </div>
                    </div>

                    <!-- Processing Queue Info -->
                    <div class="queue-info" *ngIf="order.processingQueue">
                      <mat-chip color="accent" selected>
                        <mat-icon>schedule</mat-icon>
                        Scheduled for {{ order.processingQueue.targetStatus }} at 
                        {{ flourMillService.formatDateTime(order.processingQueue.scheduledAt) }}
                      </mat-chip>
                    </div>
                  </mat-card-content>

                  <mat-card-actions>
                    <button mat-button (click)="viewOrderDetails(order)">
                      <mat-icon>visibility</mat-icon>
                      View Details
                    </button>
                    
                    <button mat-raised-button color="primary" 
                           *ngIf="order.status === 'CONFIRMED'"
                           (click)="startGrinding(order)"
                           [disabled]="isProcessing">
                      <mat-icon>play_arrow</mat-icon>
                      Start Grinding
                    </button>
                    
                    <button mat-raised-button color="accent" 
                           *ngIf="order.status === 'GRINDING' && !order.grindingCompleted"
                           (click)="completeGrinding(order)"
                           [disabled]="isProcessing">
                      <mat-icon>done</mat-icon>
                      Mark as Done
                    </button>
                  </mat-card-actions>
                </mat-card>
              </div>

              <ng-template #noOrdersTemplate>
                <div class="no-content">
                  <mat-icon>assignment</mat-icon>
                  <h3>No Orders Found</h3>
                  <p>There are no orders matching your current filter.</p>
                </div>
              </ng-template>
            </div>
          </ng-template>
        </mat-tab>

        <!-- Inventory Tab -->
        <mat-tab label="Inventory">
          <ng-template matTabContent>
            <div class="tab-content">
              <div class="tab-header">
                <h2>Inventory Management</h2>
                <div class="tab-actions">
                  <div class="inventory-summary">
                    <span>Total Value: ₹{{ getTotalInventoryValue() | number:'1.0-0' }}</span>
                  </div>
                  <button mat-raised-button color="primary" (click)="refreshInventory()">
                    <mat-icon>refresh</mat-icon>
                    Refresh
                  </button>
                </div>
              </div>

              <div class="inventory-grid" *ngIf="inventory.length > 0; else noInventoryTemplate">
                <mat-card *ngFor="let item of inventory" class="inventory-card"
                         [class]="'stock-' + item.analysis?.status">
                  <mat-card-header>
                    <mat-card-title>
                      {{ item.product.name }}
                      <mat-chip [color]="flourMillService.getStockStatusColor(item.analysis?.status || 'normal')" 
                               selected *ngIf="item.analysis?.status !== 'normal'">
                        {{ item.analysis?.status }}
                      </mat-chip>
                    </mat-card-title>
                    <mat-card-subtitle>{{ item.product.category }}</mat-card-subtitle>
                  </mat-card-header>

                  <mat-card-content>
                    <div class="stock-info">
                      <div class="stock-level">
                        <h3>{{ item.currentStock }} kg</h3>
                        <p>Current Stock</p>
                      </div>
                      
                      <div class="stock-progress">
                        <mat-progress-bar mode="determinate" 
                                        [value]="item.analysis?.stockPercentage || 0"
                                        [color]="getStockProgressColor(item.analysis?.status || 'normal')">
                        </mat-progress-bar>
                        <div class="progress-labels">
                          <span>{{ item.analysis?.stockPercentage || 0 }}% of capacity</span>
                          <span>{{ item.maxCapacity }} kg max</span>
                        </div>
                      </div>

                      <div class="stock-details">
                        <div class="detail-row">
                          <span>Threshold:</span>
                          <span>{{ item.minThreshold }} kg</span>
                        </div>
                        <div class="detail-row" *ngIf="item.unitCost">
                          <span>Unit Cost:</span>
                          <span>₹{{ item.unitCost }}/kg</span>
                        </div>
                        <div class="detail-row" *ngIf="item.lastRestocked">
                          <span>Last Restocked:</span>
                          <span>{{ flourMillService.formatDate(item.lastRestocked) }}</span>
                        </div>
                        <div class="detail-row" *ngIf="item.expiryDate">
                          <span>Expiry Date:</span>
                          <span>{{ flourMillService.formatDate(item.expiryDate) }}</span>
                        </div>
                        <div class="detail-row" *ngIf="item.analysis?.daysUntilEmpty && item.analysis.daysUntilEmpty < 999">
                          <span>Days Until Empty:</span>
                          <span>{{ item.analysis.daysUntilEmpty }} days</span>
                        </div>
                      </div>
                    </div>
                  </mat-card-content>

                  <mat-card-actions>
                    <button mat-raised-button color="primary" (click)="updateStock(item)">
                      <mat-icon>add</mat-icon>
                      Update Stock
                    </button>
                  </mat-card-actions>
                </mat-card>
              </div>

              <ng-template #noInventoryTemplate>
                <div class="no-content">
                  <mat-icon>inventory</mat-icon>
                  <h3>No Inventory Found</h3>
                  <p>Initialize your inventory to start tracking stock levels.</p>
                  <button mat-raised-button color="primary" (click)="initializeInventory()">
                    <mat-icon>add</mat-icon>
                    Initialize Inventory
                  </button>
                </div>
              </ng-template>
            </div>
          </ng-template>
        </mat-tab>

        <!-- Alerts Tab -->
        <mat-tab label="Alerts" [disabled]="alerts.length === 0">
          <ng-template matTabContent>
            <div class="tab-content">
              <div class="tab-header">
                <h2>Stock Alerts</h2>
                <div class="tab-actions">
                  <mat-form-field appearance="outline">
                    <mat-label>Show Alerts</mat-label>
                    <mat-select [(value)]="showResolvedAlerts" (selectionChange)="onAlertFilterChange()">
                      <mat-option [value]="false">Active Alerts</mat-option>
                      <mat-option [value]="true">Resolved Alerts</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <button mat-raised-button color="primary" (click)="refreshAlerts()">
                    <mat-icon>refresh</mat-icon>
                    Refresh
                  </button>
                </div>
              </div>

              <div class="alerts-list" *ngIf="alerts.length > 0; else noAlertsTemplate">
                <mat-card *ngFor="let alert of alerts" class="alert-card"
                         [class]="'severity-' + alert.severity.toLowerCase()">
                  <mat-card-header>
                    <mat-card-title>
                      {{ alert.product.name }}
                      <mat-chip [color]="flourMillService.getAlertSeverityColor(alert.severity)" selected>
                        {{ alert.severity }}
                      </mat-chip>
                    </mat-card-title>
                    <mat-card-subtitle>{{ alert.alertType }}</mat-card-subtitle>
                  </mat-card-header>

                  <mat-card-content>
                    <div class="alert-details">
                      <div class="detail-row">
                        <span>Current Stock:</span>
                        <span>{{ alert.currentStock }} kg</span>
                      </div>
                      <div class="detail-row">
                        <span>Threshold:</span>
                        <span>{{ alert.threshold }} kg</span>
                      </div>
                      <div class="detail-row">
                        <span>Created:</span>
                        <span>{{ flourMillService.formatDateTime(alert.createdAt) }}</span>
                      </div>
                      <div class="detail-row" *ngIf="alert.resolvedAt">
                        <span>Resolved:</span>
                        <span>{{ flourMillService.formatDateTime(alert.resolvedAt) }}</span>
                      </div>
                      <div class="detail-row" *ngIf="alert.notes">
                        <span>Notes:</span>
                        <span>{{ alert.notes }}</span>
                      </div>
                    </div>
                  </mat-card-content>

                  <mat-card-actions *ngIf="!alert.isResolved">
                    <button mat-raised-button color="primary" (click)="resolveAlert(alert)">
                      <mat-icon>check</mat-icon>
                      Resolve Alert
                    </button>
                  </mat-card-actions>
                </mat-card>
              </div>

              <ng-template #noAlertsTemplate>
                <div class="no-content">
                  <mat-icon>check_circle</mat-icon>
                  <h3>No Alerts</h3>
                  <p *ngIf="!showResolvedAlerts">All inventory levels are within normal ranges.</p>
                  <p *ngIf="showResolvedAlerts">No resolved alerts to display.</p>
                </div>
              </ng-template>
            </div>
          </ng-template>
        </mat-tab>
      </mat-tab-group>
    </div>

    <!-- Loading State -->
    <div class="loading-container" *ngIf="!dashboard">
      <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
      <p>Loading flour mill dashboard...</p>
    </div>
  `,
  styleUrls: ['./flour-mill-dashboard.component.scss']
})
export class FlourMillDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  dashboard: FlourMillDashboard | null = null;
  orders: MillOrder[] = [];
  inventory: MillInventory[] = [];
  alerts: StockAlert[] = [];
  
  selectedTabIndex = 0;
  selectedOrderStatus = '';
  showResolvedAlerts = false;
  isProcessing = false;

  constructor(
    public flourMillService: FlourMillService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // Check if user has flour mill access
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'FLOUR_MILL_USER') {
      this.snackBar.open('Access denied. Flour mill user role required.', 'Close', {
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
    this.flourMillService.loadDashboard();
    this.flourMillService.loadOrders();
  }

  private setupSubscriptions(): void {
    this.flourMillService.dashboard$
      .pipe(takeUntil(this.destroy$))
      .subscribe(dashboard => {
        this.dashboard = dashboard;
      });

    this.flourMillService.orders$
      .pipe(takeUntil(this.destroy$))
      .subscribe(orders => {
        this.orders = orders;
      });

    this.flourMillService.inventory$
      .pipe(takeUntil(this.destroy$))
      .subscribe(inventory => {
        this.inventory = inventory;
      });

    this.flourMillService.alerts$
      .pipe(takeUntil(this.destroy$))
      .subscribe(alerts => {
        this.alerts = alerts;
      });
  }

  private setupAutoRefresh(): void {
    // Refresh dashboard every 2 minutes
    interval(2 * 60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.flourMillService.refreshDashboard();
      });

    // Refresh orders every 30 seconds
    interval(30 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.flourMillService.refreshOrders(1, 20, this.selectedOrderStatus);
      });
  }

  // Dashboard Actions
  refreshDashboard(): void {
    this.flourMillService.refreshDashboard();
    this.snackBar.open('Dashboard refreshed', 'Close', { duration: 2000 });
  }

  initializeInventory(): void {
    this.flourMillService.initializeInventory().subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open(response.message, 'Close', { duration: 3000 });
          this.flourMillService.refreshInventory();
        }
      },
      error: (error) => {
        this.snackBar.open('Failed to initialize inventory', 'Close', { duration: 3000 });
      }
    });
  }

  // Order Management
  onOrderStatusChange(): void {
    this.flourMillService.loadOrders(1, 20, this.selectedOrderStatus);
  }

  refreshOrders(): void {
    this.flourMillService.refreshOrders(1, 20, this.selectedOrderStatus);
    this.snackBar.open('Orders refreshed', 'Close', { duration: 2000 });
  }

  startGrinding(order: MillOrder): void {
    this.isProcessing = true;
    this.flourMillService.startGrinding(order.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open(response.message, 'Close', { duration: 3000 });
          this.flourMillService.refreshOrders(1, 20, this.selectedOrderStatus);
          this.flourMillService.refreshInventory();
        }
        this.isProcessing = false;
      },
      error: (error) => {
        this.snackBar.open(error.error?.message || 'Failed to start grinding', 'Close', { 
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        this.isProcessing = false;
      }
    });
  }

  completeGrinding(order: MillOrder): void {
    this.isProcessing = true;
    this.flourMillService.completeGrinding(order.id, 60).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open(response.message, 'Close', { duration: 3000 });
          this.flourMillService.refreshOrders(1, 20, this.selectedOrderStatus);
        }
        this.isProcessing = false;
      },
      error: (error) => {
        this.snackBar.open(error.error?.message || 'Failed to complete grinding', 'Close', { 
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        this.isProcessing = false;
      }
    });
  }

  viewOrderDetails(order: MillOrder): void {
    this.dialog.open(OrderDetailsDialogComponent, {
      width: '600px',
      data: { order }
    });
  }

  // Inventory Management
  refreshInventory(): void {
    this.flourMillService.refreshInventory();
    this.snackBar.open('Inventory refreshed', 'Close', { duration: 2000 });
  }

  updateStock(item: MillInventory): void {
    const dialogRef = this.dialog.open(StockUpdateDialogComponent, {
      width: '500px',
      data: { inventory: item }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.flourMillService.updateStock(item.productId, result).subscribe({
          next: (response) => {
            if (response.success) {
              this.snackBar.open(response.message, 'Close', { duration: 3000 });
              this.flourMillService.refreshInventory();
              this.flourMillService.refreshDashboard();
            }
          },
          error: (error) => {
            this.snackBar.open(error.error?.message || 'Failed to update stock', 'Close', { 
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        });
      }
    });
  }

  getTotalInventoryValue(): number {
    return this.flourMillService.calculateStockValue(this.inventory);
  }

  getStockProgressColor(status: string): 'primary' | 'accent' | 'warn' {
    if (status === 'out_of_stock' || status === 'low_stock') return 'warn';
    if (status === 'warning') return 'accent';
    return 'primary';
  }

  // Alerts Management
  onAlertFilterChange(): void {
    this.flourMillService.loadAlerts(this.showResolvedAlerts);
  }

  refreshAlerts(): void {
    this.flourMillService.refreshAlerts(this.showResolvedAlerts);
    this.snackBar.open('Alerts refreshed', 'Close', { duration: 2000 });
  }

  resolveAlert(alert: StockAlert): void {
    const dialogRef = this.dialog.open(AlertResolveDialogComponent, {
      width: '400px',
      data: { alert }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.flourMillService.resolveAlert(alert.id, result.notes).subscribe({
          next: (response) => {
            if (response.success) {
              this.snackBar.open(response.message, 'Close', { duration: 3000 });
              this.flourMillService.refreshAlerts(this.showResolvedAlerts);
              this.flourMillService.refreshDashboard();
            }
          },
          error: (error) => {
            this.snackBar.open(error.error?.message || 'Failed to resolve alert', 'Close', { 
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        });
      }
    });
  }
}