import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { environment } from '../../environments/environment';

// Google Maps types
declare var google: any;

export interface DeliveryPartner {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  vehicleType: string;
  vehicleNumber: string;
  isAvailable: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  ratings: {
    average: number;
    count: number;
  };
}

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  status: 'OUT_FOR_DELIVERY' | 'DELIVERED';
  totalAmount: number;
  finalAmount: number;
  estimatedDeliveryTime?: string;
  deliveredAt?: string;
  address: {
    id: string;
    fullAddress: string;
    pincode: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  };
  orderItems: Array<{
    id: string;
    productName: string;
    quantity: number;
    pricePerKg: number;
  }>;
  specialInstructions?: string;
  paymentMethod: string;
  paymentStatus: string;
  rating?: {
    score: number;
    feedback: string;
  };
}

export interface LocalityGroup {
  locality: string;
  pincode: string;
  orders: DeliveryOrder[];
  totalOrders: number;
  totalAmount: number;
  estimatedTime: number; // in minutes
  center?: {
    latitude: number;
    longitude: number;
  };
}

export interface OptimizedRoute {
  routeId: string;
  partnerId: string;
  localities: LocalityGroup[];
  waypoints: Array<{
    orderId: string;
    address: string;
    latitude: number;
    longitude: number;
    estimatedArrival: string;
    completed: boolean;
  }>;
  totalDistance: number; // in km
  totalDuration: number; // in minutes
  startLocation: {
    latitude: number;
    longitude: number;
  };
  googleMapsUrl: string;
  createdAt: string;
  completedAt?: string;
}

export interface LocationUpdate {
  partnerId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface DeliveryStats {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalEarnings: number;
  averageRating: number;
  completionRate: number;
  onTimeDeliveries: number;
}

@Injectable({
  providedIn: 'root'
})
export class DeliveryPartnerService {
  private readonly apiUrl = `${environment.apiUrl}/delivery`;
  
  // Real-time data subjects
  private assignedOrdersSubject = new BehaviorSubject<DeliveryOrder[]>([]);
  private localityGroupsSubject = new BehaviorSubject<LocalityGroup[]>([]);
  private currentRouteSubject = new BehaviorSubject<OptimizedRoute | null>(null);
  private partnerStatsSubject = new BehaviorSubject<DeliveryStats | null>(null);
  private locationTrackingSubject = new BehaviorSubject<boolean>(false);

  public assignedOrders$ = this.assignedOrdersSubject.asObservable();
  public localityGroups$ = this.localityGroupsSubject.asObservable();
  public currentRoute$ = this.currentRouteSubject.asObservable();
  public partnerStats$ = this.partnerStatsSubject.asObservable();
  public isTrackingLocation$ = this.locationTrackingSubject.asObservable();

  private geolocationWatchId?: number;
  private locationUpdateInterval?: any;

  constructor(private http: HttpClient) {}

  // Delivery Partner Profile
  getPartnerProfile(): Observable<{ success: boolean; data: DeliveryPartner }> {
    return this.http.get<{ success: boolean; data: DeliveryPartner }>(`${this.apiUrl}/profile`);
  }

  updateAvailability(isAvailable: boolean): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${this.apiUrl}/availability`, {
      isAvailable
    });
  }

  // Order Management
  getAssignedOrders(): Observable<{ success: boolean; data: DeliveryOrder[] }> {
    return this.http.get<{ success: boolean; data: DeliveryOrder[] }>(`${this.apiUrl}/orders`);
  }

  loadAssignedOrders(): void {
    this.getAssignedOrders().subscribe({
      next: (response) => {
        if (response.success) {
          this.assignedOrdersSubject.next(response.data);
          this.groupOrdersByLocality(response.data);
        }
      },
      error: (error) => {
        console.error('Failed to load assigned orders:', error);
      }
    });
  }

  // Locality Grouping
  private groupOrdersByLocality(orders: DeliveryOrder[]): void {
    const groupMap = new Map<string, LocalityGroup>();

    orders.forEach(order => {
      const key = `${order.address.pincode}`;
      
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          locality: this.extractLocalityFromAddress(order.address.fullAddress),
          pincode: order.address.pincode,
          orders: [],
          totalOrders: 0,
          totalAmount: 0,
          estimatedTime: 0
        });
      }

      const group = groupMap.get(key)!;
      group.orders.push(order);
      group.totalOrders++;
      group.totalAmount += order.finalAmount;
    });

    // Calculate estimated time and center for each group
    const localities = Array.from(groupMap.values()).map(group => {
      group.estimatedTime = this.calculateEstimatedTime(group.orders.length);
      group.center = this.calculateGroupCenter(group.orders);
      return group;
    });

    // Sort by total amount (prioritize high-value deliveries)
    localities.sort((a, b) => b.totalAmount - a.totalAmount);

    this.localityGroupsSubject.next(localities);
  }

  private extractLocalityFromAddress(address: string): string {
    // Simple extraction - in production, use more sophisticated address parsing
    const parts = address.split(',');
    return parts.length > 1 ? parts[parts.length - 2].trim() : 'Unknown';
  }

  private calculateEstimatedTime(orderCount: number): number {
    // Base time per order: 15 minutes + 5 minutes travel between orders
    return (orderCount * 15) + ((orderCount - 1) * 5);
  }

  private calculateGroupCenter(orders: DeliveryOrder[]): { latitude: number; longitude: number } {
    const validCoords = orders
      .map(order => order.address)
      .filter(addr => addr.latitude && addr.longitude);

    if (validCoords.length === 0) {
      // Default to Bangalore center if no coordinates
      return { latitude: 12.9716, longitude: 77.5946 };
    }

    const avgLat = validCoords.reduce((sum, addr) => sum + addr.latitude!, 0) / validCoords.length;
    const avgLng = validCoords.reduce((sum, addr) => sum + addr.longitude!, 0) / validCoords.length;

    return { latitude: avgLat, longitude: avgLng };
  }

  // Route Optimization
  generateOptimizedRoute(localityGroups: LocalityGroup[]): Observable<{ success: boolean; data: OptimizedRoute }> {
    const orderIds = localityGroups.flatMap(group => group.orders.map(order => order.id));
    
    return this.http.post<{ success: boolean; data: OptimizedRoute }>(`${this.apiUrl}/optimize-route`, {
      orderIds,
      startLocation: this.getCurrentLocation()
    });
  }

  startDeliveryRoute(routeId: string): Observable<{ success: boolean; message: string; googleMapsUrl: string }> {
    return this.http.post<{ success: boolean; message: string; googleMapsUrl: string }>(
      `${this.apiUrl}/routes/${routeId}/start`, {}
    );
  }

  // Google Maps Integration
  launchGoogleMaps(route: OptimizedRoute): void {
    // Generate Google Maps URL with multiple waypoints
    const waypoints = route.waypoints
      .filter(wp => !wp.completed)
      .map(wp => `${wp.latitude},${wp.longitude}`)
      .join('|');

    const startPoint = `${route.startLocation.latitude},${route.startLocation.longitude}`;
    const endPoint = route.waypoints.length > 0 ? 
      `${route.waypoints[route.waypoints.length - 1].latitude},${route.waypoints[route.waypoints.length - 1].longitude}` : 
      startPoint;

    let mapsUrl = `https://www.google.com/maps/dir/${startPoint}`;
    
    if (waypoints) {
      mapsUrl += `/${waypoints}`;
    }
    
    mapsUrl += `/${endPoint}?travelmode=driving`;

    // Try to open in Google Maps app first, then fallback to web
    const googleMapsApp = `google.navigation:q=${endPoint}&waypoints=${waypoints}&mode=d`;
    
    if (this.isMobile()) {
      // Try to open Google Maps app
      window.location.href = googleMapsApp;
      
      // Fallback to web after a delay
      setTimeout(() => {
        window.open(mapsUrl, '_blank');
      }, 1500);
    } else {
      // Desktop: open in new tab
      window.open(mapsUrl, '_blank');
    }
  }

  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Order Delivery
  markOrderAsDelivered(orderId: string, deliveryData: {
    latitude: number;
    longitude: number;
    deliveryNotes?: string;
    customerSignature?: string;
    photoUrl?: string;
  }): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(
      `${this.apiUrl}/orders/${orderId}/deliver`,
      deliveryData
    );
  }

  // Location Tracking
  startLocationTracking(): void {
    if (navigator.geolocation) {
      this.locationTrackingSubject.next(true);
      
      // Start watching position
      this.geolocationWatchId = navigator.geolocation.watchPosition(
        (position) => {
          this.updateLocation({
            partnerId: '', // Will be set by backend
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date().toISOString(),
            accuracy: position.coords.accuracy,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          this.locationTrackingSubject.next(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );

      // Update location every 30 seconds
      this.locationUpdateInterval = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              this.updateLocation({
                partnerId: '', // Will be set by backend
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: new Date().toISOString(),
                accuracy: position.coords.accuracy,
                heading: position.coords.heading || undefined,
                speed: position.coords.speed || undefined
              });
            },
            (error) => console.error('Location update error:', error)
          );
        }
      }, 30000);
    }
  }

  stopLocationTracking(): void {
    this.locationTrackingSubject.next(false);
    
    if (this.geolocationWatchId) {
      navigator.geolocation.clearWatch(this.geolocationWatchId);
      this.geolocationWatchId = undefined;
    }

    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = undefined;
    }
  }

  private updateLocation(location: LocationUpdate): void {
    this.http.post(`${this.apiUrl}/location`, location).subscribe({
      next: () => {
        // Location updated successfully
      },
      error: (error) => {
        console.error('Failed to update location:', error);
      }
    });
  }

  private getCurrentLocation(): { latitude: number; longitude: number } | null {
    // Return last known location or default
    return { latitude: 12.9716, longitude: 77.5946 }; // Bangalore default
  }

  // Statistics
  getPartnerStats(): Observable<{ success: boolean; data: DeliveryStats }> {
    return this.http.get<{ success: boolean; data: DeliveryStats }>(`${this.apiUrl}/stats`);
  }

  loadPartnerStats(): void {
    this.getPartnerStats().subscribe({
      next: (response) => {
        if (response.success) {
          this.partnerStatsSubject.next(response.data);
        }
      },
      error: (error) => {
        console.error('Failed to load partner stats:', error);
      }
    });
  }

  // Rating System
  requestRating(orderId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/orders/${orderId}/request-rating`, {});
  }

  // Utility Methods
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.degToRad(lat2 - lat1);
    const dLng = this.degToRad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.degToRad(lat1)) * Math.cos(this.degToRad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private degToRad(deg: number): number {
    return deg * (Math.PI/180);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
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

  // Real-time updates
  refreshData(): void {
    this.loadAssignedOrders();
    this.loadPartnerStats();
  }

  // Clean up subscriptions
  ngOnDestroy(): void {
    this.stopLocationTracking();
    this.assignedOrdersSubject.complete();
    this.localityGroupsSubject.complete();
    this.currentRouteSubject.complete();
    this.partnerStatsSubject.complete();
    this.locationTrackingSubject.complete();
  }
}