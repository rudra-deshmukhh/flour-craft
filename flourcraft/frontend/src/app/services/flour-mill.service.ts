import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FlourMillDashboard {
  flourMill: {
    id: string;
    name: string;
    address: string;
    capacity: number;
  };
  stats: {
    pendingOrders: number;
    grindingOrders: number;
    completedTodayOrders: number;
    totalOrdersCount: number;
    lowStockItems: number;
    activeAlerts: number;
  };
  inventory: MillInventory[];
  alerts: StockAlert[];
}

export interface MillInventory {
  id: string;
  productId: string;
  currentStock: number;
  minThreshold: number;
  maxCapacity: number;
  lastRestocked?: string;
  restockQuantity?: number;
  unitCost?: number;
  expiryDate?: string;
  batchNumber?: string;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    category: string;
    pricePerKg: number;
  };
  analysis?: {
    stockPercentage: number;
    thresholdPercentage: number;
    status: 'normal' | 'warning' | 'low_stock' | 'out_of_stock';
    severity: 'low' | 'medium' | 'high' | 'critical';
    daysUntilEmpty: number;
  };
}

export interface StockAlert {
  id: string;
  flourMillId: string;
  productId: string;
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRY_WARNING' | 'OVERSTOCKED';
  currentStock: number;
  threshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    category: string;
  };
}

export interface MillOrder {
  id: string;
  orderNumber: string;
  userId: string;
  status: 'PENDING' | 'CONFIRMED' | 'GRINDING' | 'DISPATCHED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  finalAmount: number;
  deliverySlot?: string;
  grindingStarted?: string;
  grindingCompleted?: string;
  dispatchedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    phoneNumber: string;
  };
  orderItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    pricePerKg: number;
    product: {
      id: string;
      name: string;
      category: string;
    };
  }>;
  address: {
    id: string;
    fullAddress: string;
    pincode: string;
    landmark?: string;
  };
  processingQueue?: {
    id: string;
    currentStatus: string;
    targetStatus: string;
    scheduledAt: string;
    processedAt?: string;
    retryCount: number;
  };
}

export interface OrdersResponse {
  orders: MillOrder[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export interface UpdateStockRequest {
  quantity: number;
  operation: 'add' | 'set';
  batchNumber?: string;
  expiryDate?: string;
  unitCost?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FlourMillService {
  private readonly apiUrl = `${environment.apiUrl}/mill`;
  
  // Real-time data subjects
  private dashboardSubject = new BehaviorSubject<FlourMillDashboard | null>(null);
  private ordersSubject = new BehaviorSubject<MillOrder[]>([]);
  private inventorySubject = new BehaviorSubject<MillInventory[]>([]);
  private alertsSubject = new BehaviorSubject<StockAlert[]>([]);

  public dashboard$ = this.dashboardSubject.asObservable();
  public orders$ = this.ordersSubject.asObservable();
  public inventory$ = this.inventorySubject.asObservable();
  public alerts$ = this.alertsSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Dashboard Operations
  getDashboard(): Observable<{ success: boolean; data: FlourMillDashboard }> {
    return this.http.get<{ success: boolean; data: FlourMillDashboard }>(`${this.apiUrl}/dashboard`);
  }

  loadDashboard(): void {
    this.getDashboard().subscribe({
      next: (response) => {
        if (response.success) {
          this.dashboardSubject.next(response.data);
          this.inventorySubject.next(response.data.inventory);
          this.alertsSubject.next(response.data.alerts);
        }
      },
      error: (error) => {
        console.error('Failed to load dashboard:', error);
      }
    });
  }

  // Order Management
  getAssignedOrders(page: number = 1, limit: number = 20, status?: string): Observable<{ success: boolean; data: OrdersResponse }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<{ success: boolean; data: OrdersResponse }>(`${this.apiUrl}/orders`, { params });
  }

  loadOrders(page: number = 1, limit: number = 20, status?: string): void {
    this.getAssignedOrders(page, limit, status).subscribe({
      next: (response) => {
        if (response.success) {
          this.ordersSubject.next(response.data.orders);
        }
      },
      error: (error) => {
        console.error('Failed to load orders:', error);
      }
    });
  }

  startGrinding(orderId: string): Observable<{ success: boolean; message: string; data: { order: MillOrder } }> {
    return this.http.post<{ success: boolean; message: string; data: { order: MillOrder } }>(
      `${this.apiUrl}/orders/${orderId}/start-grinding`,
      {}
    );
  }

  completeGrinding(orderId: string, dispatchDelay: number = 60): Observable<{ 
    success: boolean; 
    message: string; 
    data: { order: MillOrder; scheduledDispatchTime: string } 
  }> {
    return this.http.post<{ 
      success: boolean; 
      message: string; 
      data: { order: MillOrder; scheduledDispatchTime: string } 
    }>(
      `${this.apiUrl}/orders/${orderId}/complete-grinding`,
      { dispatchDelay }
    );
  }

  // Inventory Management
  getInventory(): Observable<{ success: boolean; data: { inventory: MillInventory[] } }> {
    return this.http.get<{ success: boolean; data: { inventory: MillInventory[] } }>(`${this.apiUrl}/inventory`);
  }

  loadInventory(): void {
    this.getInventory().subscribe({
      next: (response) => {
        if (response.success) {
          this.inventorySubject.next(response.data.inventory);
        }
      },
      error: (error) => {
        console.error('Failed to load inventory:', error);
      }
    });
  }

  updateStock(productId: string, updateData: UpdateStockRequest): Observable<{ 
    success: boolean; 
    message: string; 
    data: { inventory: MillInventory } 
  }> {
    return this.http.put<{ 
      success: boolean; 
      message: string; 
      data: { inventory: MillInventory } 
    }>(`${this.apiUrl}/inventory/${productId}`, updateData);
  }

  initializeInventory(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/inventory/initialize`, {});
  }

  // Stock Alerts Management
  getStockAlerts(resolved: boolean = false): Observable<{ success: boolean; data: { alerts: StockAlert[] } }> {
    const params = new HttpParams().set('resolved', resolved.toString());
    return this.http.get<{ success: boolean; data: { alerts: StockAlert[] } }>(`${this.apiUrl}/alerts`, { params });
  }

  loadAlerts(resolved: boolean = false): void {
    this.getStockAlerts(resolved).subscribe({
      next: (response) => {
        if (response.success) {
          this.alertsSubject.next(response.data.alerts);
        }
      },
      error: (error) => {
        console.error('Failed to load alerts:', error);
      }
    });
  }

  resolveAlert(alertId: string, notes?: string): Observable<{ 
    success: boolean; 
    message: string; 
    data: { alert: StockAlert } 
  }> {
    return this.http.post<{ 
      success: boolean; 
      message: string; 
      data: { alert: StockAlert } 
    }>(`${this.apiUrl}/alerts/${alertId}/resolve`, { notes });
  }

  // Utility Methods
  getOrderStatusColor(status: string): string {
    const statusColors: { [key: string]: string } = {
      'PENDING': 'warn',
      'CONFIRMED': 'primary',
      'GRINDING': 'accent',
      'DISPATCHED': 'success',
      'OUT_FOR_DELIVERY': 'info',
      'DELIVERED': 'success',
      'CANCELLED': 'warn'
    };
    return statusColors[status] || 'primary';
  }

  getStockStatusColor(status: string): string {
    const statusColors: { [key: string]: string } = {
      'normal': 'success',
      'warning': 'warn',
      'low_stock': 'warn',
      'out_of_stock': 'error'
    };
    return statusColors[status] || 'primary';
  }

  getAlertSeverityColor(severity: string): string {
    const severityColors: { [key: string]: string } = {
      'LOW': 'primary',
      'MEDIUM': 'warn',
      'HIGH': 'warn',
      'CRITICAL': 'error'
    };
    return severityColors[severity] || 'primary';
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  calculateStockValue(inventory: MillInventory[]): number {
    return inventory.reduce((total, item) => {
      const unitCost = item.unitCost || item.product.pricePerKg;
      return total + (item.currentStock * unitCost);
    }, 0);
  }

  // Real-time updates (call these when you want to refresh data)
  refreshDashboard(): void {
    this.loadDashboard();
  }

  refreshOrders(page: number = 1, limit: number = 20, status?: string): void {
    this.loadOrders(page, limit, status);
  }

  refreshInventory(): void {
    this.loadInventory();
  }

  refreshAlerts(resolved: boolean = false): void {
    this.loadAlerts(resolved);
  }

  // Clean up subscriptions
  ngOnDestroy(): void {
    this.dashboardSubject.complete();
    this.ordersSubject.complete();
    this.inventorySubject.complete();
    this.alertsSubject.complete();
  }
}