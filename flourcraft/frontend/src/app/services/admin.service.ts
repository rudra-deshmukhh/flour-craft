import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, query, where, orderBy, limit } from 'firebase/firestore';

// Interfaces
export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  unit: string;
  isActive: boolean;
  imageUrl?: string;
  nutritionalInfo?: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FlourMill {
  id: string;
  name: string;
  address: string;
  pincode: string;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  capacity: number;
  isActive: boolean;
  operatingHours: {
    start: string;
    end: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
  assignedProducts: string[];
  currentLoad: number;
  efficiency: number; // percentage
  createdAt: string;
}

export interface DeliveryPartner {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  email: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
  isActive: boolean;
  isAvailable: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
    accuracy?: number;
  };
  assignedArea: string[];
  ratings: {
    average: number;
    count: number;
  };
  stats: {
    totalDeliveries: number;
    completedDeliveries: number;
    onTimeDeliveries: number;
  };
  createdAt: string;
}

export interface Discount {
  id: string;
  name: string;
  description: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_GET_Y';
  value: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  isActive: boolean;
  startDate: string;
  endDate: string;
  usageLimit?: number;
  usedCount: number;
  conditions?: {
    buyQuantity?: number;
    getQuantity?: number;
    freeProductId?: string;
  };
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  status: 'PENDING' | 'CONFIRMED' | 'ASSIGNED_TO_MILL' | 'GRINDING' | 'GRINDING_DONE' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  assignedMillId?: string;
  assignedPartnerId?: string;
  estimatedDeliveryTime?: string;
  deliveredAt?: string;
  address: {
    fullAddress: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
  };
  orderItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    pricePerKg: number;
    totalPrice: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface StockAlert {
  id: string;
  millId: string;
  millName: string;
  productId: string;
  productName: string;
  currentStock: number;
  minThreshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isResolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface Analytics {
  orderStats: {
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    revenue: number;
    averageOrderValue: number;
  };
  bestSellingProducts: Array<{
    productId: string;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  peakHours: Array<{
    hour: number;
    orderCount: number;
  }>;
  millPerformance: Array<{
    millId: string;
    millName: string;
    ordersProcessed: number;
    avgProcessingTime: number;
    efficiency: number;
  }>;
  deliveryMetrics: Array<{
    partnerId: string;
    partnerName: string;
    deliveriesCompleted: number;
    onTimeDeliveryRate: number;
    avgRating: number;
  }>;
  stockSummary: {
    totalProducts: number;
    lowStockAlerts: number;
    criticalStockAlerts: number;
    totalStockValue: number;
  };
}

export interface DashboardSummary {
  totalOrders: number;
  activeOrders: number;
  totalRevenue: number;
  activeMills: number;
  availablePartners: number;
  lowStockAlerts: number;
  todayOrders: number;
  todayRevenue: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly apiUrl = `${environment.apiUrl}/admin`;
  private firestore: any;
  
  // Real-time data subjects
  private dashboardSummarySubject = new BehaviorSubject<DashboardSummary | null>(null);
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  private deliveryPartnersSubject = new BehaviorSubject<DeliveryPartner[]>([]);
  private stockAlertsSubject = new BehaviorSubject<StockAlert[]>([]);
  private analyticsSubject = new BehaviorSubject<Analytics | null>(null);

  public dashboardSummary$ = this.dashboardSummarySubject.asObservable();
  public orders$ = this.ordersSubject.asObservable();
  public deliveryPartners$ = this.deliveryPartnersSubject.asObservable();
  public stockAlerts$ = this.stockAlertsSubject.asObservable();
  public analytics$ = this.analyticsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeFirestore();
  }

  private initializeFirestore(): void {
    try {
      const app = initializeApp(environment.firebase);
      this.firestore = getFirestore(app);
      this.setupRealtimeListeners();
    } catch (error) {
      console.error('Failed to initialize Firestore:', error);
    }
  }

  private setupRealtimeListeners(): void {
    if (!this.firestore) return;

    // Listen to delivery partner locations
    const partnersRef = collection(this.firestore, 'delivery_locations');
    onSnapshot(partnersRef, (snapshot) => {
      const locations: any[] = [];
      snapshot.forEach(doc => {
        locations.push({ id: doc.id, ...doc.data() });
      });
      this.updatePartnerLocations(locations);
    });

    // Listen to real-time orders
    const ordersRef = query(
      collection(this.firestore, 'order_status_updates'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    onSnapshot(ordersRef, (snapshot) => {
      const orderUpdates: any[] = [];
      snapshot.forEach(doc => {
        orderUpdates.push({ id: doc.id, ...doc.data() });
      });
      this.processOrderUpdates(orderUpdates);
    });
  }

  private updatePartnerLocations(locations: any[]): void {
    const currentPartners = this.deliveryPartnersSubject.getValue();
    const updatedPartners = currentPartners.map(partner => {
      const location = locations.find(loc => loc.partnerId === partner.id);
      if (location) {
        return {
          ...partner,
          currentLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: location.timestamp,
            accuracy: location.accuracy
          }
        };
      }
      return partner;
    });
    this.deliveryPartnersSubject.next(updatedPartners);
  }

  private processOrderUpdates(updates: any[]): void {
    // Process real-time order updates and merge with existing orders
    const currentOrders = this.ordersSubject.getValue();
    // Implementation would merge updates with current orders
    // For now, we'll refresh orders from API
    this.loadOrders();
  }

  // Dashboard Summary
  getDashboardSummary(): Observable<{ success: boolean; data: DashboardSummary }> {
    return this.http.get<{ success: boolean; data: DashboardSummary }>(`${this.apiUrl}/dashboard`);
  }

  loadDashboardSummary(): void {
    this.getDashboardSummary().subscribe({
      next: (response) => {
        if (response.success) {
          this.dashboardSummarySubject.next(response.data);
        }
      },
      error: (error) => console.error('Failed to load dashboard summary:', error)
    });
  }

  // Product Management
  getProducts(params?: { search?: string; category?: string; isActive?: boolean }): Observable<{ success: boolean; data: Product[] }> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.category) httpParams = httpParams.set('category', params.category);
    if (params?.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive.toString());

    return this.http.get<{ success: boolean; data: Product[] }>(`${this.apiUrl}/products`, { params: httpParams });
  }

  createProduct(product: Partial<Product>): Observable<{ success: boolean; data: Product; message: string }> {
    return this.http.post<{ success: boolean; data: Product; message: string }>(`${this.apiUrl}/products`, product);
  }

  updateProduct(id: string, product: Partial<Product>): Observable<{ success: boolean; data: Product; message: string }> {
    return this.http.put<{ success: boolean; data: Product; message: string }>(`${this.apiUrl}/products/${id}`, product);
  }

  deleteProduct(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/products/${id}`);
  }

  // Flour Mill Management
  getFlourMills(params?: { search?: string; isActive?: boolean }): Observable<{ success: boolean; data: FlourMill[] }> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive.toString());

    return this.http.get<{ success: boolean; data: FlourMill[] }>(`${this.apiUrl}/flour-mills`, { params: httpParams });
  }

  createFlourMill(mill: Partial<FlourMill>): Observable<{ success: boolean; data: FlourMill; message: string }> {
    return this.http.post<{ success: boolean; data: FlourMill; message: string }>(`${this.apiUrl}/flour-mills`, mill);
  }

  updateFlourMill(id: string, mill: Partial<FlourMill>): Observable<{ success: boolean; data: FlourMill; message: string }> {
    return this.http.put<{ success: boolean; data: FlourMill; message: string }>(`${this.apiUrl}/flour-mills/${id}`, mill);
  }

  assignProductsToMill(millId: string, productIds: string[]): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/flour-mills/${millId}/assign-products`, { productIds });
  }

  // Delivery Partner Management
  getDeliveryPartners(params?: { search?: string; isActive?: boolean; isAvailable?: boolean }): Observable<{ success: boolean; data: DeliveryPartner[] }> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive.toString());
    if (params?.isAvailable !== undefined) httpParams = httpParams.set('isAvailable', params.isAvailable.toString());

    return this.http.get<{ success: boolean; data: DeliveryPartner[] }>(`${this.apiUrl}/delivery-partners`, { params: httpParams });
  }

  loadDeliveryPartners(): void {
    this.getDeliveryPartners().subscribe({
      next: (response) => {
        if (response.success) {
          this.deliveryPartnersSubject.next(response.data);
        }
      },
      error: (error) => console.error('Failed to load delivery partners:', error)
    });
  }

  createDeliveryPartner(partner: Partial<DeliveryPartner>): Observable<{ success: boolean; data: DeliveryPartner; message: string }> {
    return this.http.post<{ success: boolean; data: DeliveryPartner; message: string }>(`${this.apiUrl}/delivery-partners`, partner);
  }

  updateDeliveryPartner(id: string, partner: Partial<DeliveryPartner>): Observable<{ success: boolean; data: DeliveryPartner; message: string }> {
    return this.http.put<{ success: boolean; data: DeliveryPartner; message: string }>(`${this.apiUrl}/delivery-partners/${id}`, partner);
  }

  assignAreaToPartner(partnerId: string, pincodes: string[]): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/delivery-partners/${partnerId}/assign-area`, { pincodes });
  }

  // Order Management
  getOrders(params?: { 
    status?: string; 
    millId?: string; 
    partnerId?: string; 
    dateFrom?: string; 
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Observable<{ success: boolean; data: Order[]; total: number; page: number; limit: number }> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.millId) httpParams = httpParams.set('millId', params.millId);
    if (params?.partnerId) httpParams = httpParams.set('partnerId', params.partnerId);
    if (params?.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());

    return this.http.get<{ success: boolean; data: Order[]; total: number; page: number; limit: number }>(`${this.apiUrl}/orders`, { params: httpParams });
  }

  loadOrders(filters?: any): void {
    this.getOrders(filters).subscribe({
      next: (response) => {
        if (response.success) {
          this.ordersSubject.next(response.data);
        }
      },
      error: (error) => console.error('Failed to load orders:', error)
    });
  }

  assignOrderToMill(orderId: string, millId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/orders/${orderId}/assign-mill`, { millId });
  }

  assignOrderToPartner(orderId: string, partnerId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/orders/${orderId}/assign-partner`, { partnerId });
  }

  updateOrderStatus(orderId: string, status: string, notes?: string): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${this.apiUrl}/orders/${orderId}/status`, { status, notes });
  }

  // Discount Management
  getDiscounts(params?: { isActive?: boolean; type?: string }): Observable<{ success: boolean; data: Discount[] }> {
    let httpParams = new HttpParams();
    if (params?.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive.toString());
    if (params?.type) httpParams = httpParams.set('type', params.type);

    return this.http.get<{ success: boolean; data: Discount[] }>(`${this.apiUrl}/discounts`, { params: httpParams });
  }

  createDiscount(discount: Partial<Discount>): Observable<{ success: boolean; data: Discount; message: string }> {
    return this.http.post<{ success: boolean; data: Discount; message: string }>(`${this.apiUrl}/discounts`, discount);
  }

  updateDiscount(id: string, discount: Partial<Discount>): Observable<{ success: boolean; data: Discount; message: string }> {
    return this.http.put<{ success: boolean; data: Discount; message: string }>(`${this.apiUrl}/discounts/${id}`, discount);
  }

  deleteDiscount(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/discounts/${id}`);
  }

  // Stock Management
  getStockAlerts(): Observable<{ success: boolean; data: StockAlert[] }> {
    return this.http.get<{ success: boolean; data: StockAlert[] }>(`${this.apiUrl}/stock-alerts`);
  }

  loadStockAlerts(): void {
    this.getStockAlerts().subscribe({
      next: (response) => {
        if (response.success) {
          this.stockAlertsSubject.next(response.data);
        }
      },
      error: (error) => console.error('Failed to load stock alerts:', error)
    });
  }

  resolveStockAlert(alertId: string, notes?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/stock-alerts/${alertId}/resolve`, { notes });
  }

  getMillInventory(millId: string): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/flour-mills/${millId}/inventory`);
  }

  updateMillStock(millId: string, productId: string, operation: 'ADD' | 'SET', quantity: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/flour-mills/${millId}/inventory/${productId}`, {
      operation,
      quantity
    });
  }

  // Analytics
  getAnalytics(dateRange?: { from: string; to: string }): Observable<{ success: boolean; data: Analytics }> {
    let httpParams = new HttpParams();
    if (dateRange?.from) httpParams = httpParams.set('from', dateRange.from);
    if (dateRange?.to) httpParams = httpParams.set('to', dateRange.to);

    return this.http.get<{ success: boolean; data: Analytics }>(`${this.apiUrl}/analytics`, { params: httpParams });
  }

  loadAnalytics(dateRange?: { from: string; to: string }): void {
    this.getAnalytics(dateRange).subscribe({
      next: (response) => {
        if (response.success) {
          this.analyticsSubject.next(response.data);
        }
      },
      error: (error) => console.error('Failed to load analytics:', error)
    });
  }

  // Utility Methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
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

  getStatusColor(status: string): string {
    const statusColors: { [key: string]: string } = {
      'PENDING': 'warn',
      'CONFIRMED': 'primary',
      'ASSIGNED_TO_MILL': 'primary',
      'GRINDING': 'accent',
      'GRINDING_DONE': 'accent',
      'OUT_FOR_DELIVERY': 'primary',
      'DELIVERED': 'primary',
      'CANCELLED': 'warn'
    };
    return statusColors[status] || 'primary';
  }

  getSeverityColor(severity: string): string {
    const severityColors: { [key: string]: string } = {
      'LOW': 'primary',
      'MEDIUM': 'accent',
      'HIGH': 'warn',
      'CRITICAL': 'warn'
    };
    return severityColors[severity] || 'primary';
  }

  // Real-time updates
  refreshData(): void {
    this.loadDashboardSummary();
    this.loadOrders();
    this.loadDeliveryPartners();
    this.loadStockAlerts();
    this.loadAnalytics();
  }

  // Clean up subscriptions
  ngOnDestroy(): void {
    this.dashboardSummarySubject.complete();
    this.ordersSubject.complete();
    this.deliveryPartnersSubject.complete();
    this.stockAlertsSubject.complete();
    this.analyticsSubject.complete();
  }
}