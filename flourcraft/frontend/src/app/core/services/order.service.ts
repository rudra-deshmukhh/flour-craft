import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { 
  Order, 
  CheckoutRequest, 
  PaymentResponse, 
  PaymentLink,
  Subscription,
  SubscriptionFrequency,
  OrderStatus,
  PaymentStatus
} from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly apiUrl = environment.apiUrl;
  private orders$ = new BehaviorSubject<Order[]>([]);
  private subscriptions$ = new BehaviorSubject<Subscription[]>([]);
  private isLoading$ = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient) {}

  // Getters
  get orders(): Observable<Order[]> {
    return this.orders$.asObservable();
  }

  get subscriptions(): Observable<Subscription[]> {
    return this.subscriptions$.asObservable();
  }

  get loading(): Observable<boolean> {
    return this.isLoading$.asObservable();
  }

  // Checkout and create order
  checkout(checkoutData: CheckoutRequest): Observable<PaymentResponse> {
    this.isLoading$.next(true);

    return this.http.post<{ data: PaymentResponse }>(`${this.apiUrl}/orders/checkout`, checkoutData)
      .pipe(
        map(response => response.data),
        tap(() => this.isLoading$.next(false)),
        catchError(this.handleError)
      );
  }

  // Create subscription
  createSubscription(subscriptionData: {
    addressId: string;
    frequency: SubscriptionFrequency;
    items: { productId: string; quantity: number }[];
    startDate?: string;
  }): Observable<Subscription> {
    this.isLoading$.next(true);

    return this.http.post<{ data: { subscription: Subscription } }>(`${this.apiUrl}/subscriptions`, subscriptionData)
      .pipe(
        map(response => response.data.subscription),
        tap(() => this.isLoading$.next(false)),
        catchError(this.handleError)
      );
  }

  // Get available delivery slots
  getDeliverySlots(pincode: string, date?: string): Observable<string[]> {
    let params = new HttpParams().set('pincode', pincode);
    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<{ data: { slots: string[] } }>(`${this.apiUrl}/orders/delivery-slots`, { params })
      .pipe(
        map(response => response.data.slots),
        catchError(this.handleError)
      );
  }

  // Generate UPI payment links
  generatePaymentLinks(orderId: string): Observable<PaymentLink> {
    return this.http.post<{ data: { paymentLinks: PaymentLink } }>(`${this.apiUrl}/orders/${orderId}/payment-links`, {})
      .pipe(
        map(response => response.data.paymentLinks),
        catchError(this.handleError)
      );
  }

  // Verify payment and update order
  verifyPayment(orderId: string, transactionId: string, paymentMethod: string): Observable<Order> {
    const paymentData = {
      transactionId,
      paymentMethod
    };

    return this.http.post<{ data: { order: Order } }>(`${this.apiUrl}/orders/${orderId}/verify-payment`, paymentData)
      .pipe(
        map(response => response.data.order),
        catchError(this.handleError)
      );
  }

  // Get user orders
  getMyOrders(page: number = 1, limit: number = 20): Observable<{ orders: Order[]; totalCount: number }> {
    this.isLoading$.next(true);

    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<{ data: { orders: Order[]; totalCount: number } }>(`${this.apiUrl}/orders`, { params })
      .pipe(
        map(response => response.data),
        tap(data => {
          this.orders$.next(data.orders);
          this.isLoading$.next(false);
        }),
        catchError(this.handleError)
      );
  }

  // Get order by ID
  getOrderById(orderId: string): Observable<Order> {
    return this.http.get<{ data: { order: Order } }>(`${this.apiUrl}/orders/${orderId}`)
      .pipe(
        map(response => response.data.order),
        catchError(this.handleError)
      );
  }

  // Track order status
  trackOrder(orderId: string): Observable<{
    order: Order;
    statusHistory: Array<{ status: OrderStatus; timestamp: string; message?: string }>;
  }> {
    return this.http.get<{ data: any }>(`${this.apiUrl}/orders/${orderId}/track`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // Cancel order
  cancelOrder(orderId: string, reason?: string): Observable<Order> {
    const cancelData = reason ? { reason } : {};

    return this.http.post<{ data: { order: Order } }>(`${this.apiUrl}/orders/${orderId}/cancel`, cancelData)
      .pipe(
        map(response => response.data.order),
        catchError(this.handleError)
      );
  }

  // Rate order/delivery
  rateOrder(orderId: string, rating: number, feedback?: string): Observable<void> {
    const ratingData = { rating, feedback };

    return this.http.post<void>(`${this.apiUrl}/orders/${orderId}/rate`, ratingData)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Get user subscriptions
  getMySubscriptions(): Observable<Subscription[]> {
    this.isLoading$.next(true);

    return this.http.get<{ data: { subscriptions: Subscription[] } }>(`${this.apiUrl}/subscriptions`)
      .pipe(
        map(response => response.data.subscriptions),
        tap(subscriptions => {
          this.subscriptions$.next(subscriptions);
          this.isLoading$.next(false);
        }),
        catchError(this.handleError)
      );
  }

  // Get subscription by ID
  getSubscriptionById(subscriptionId: string): Observable<Subscription> {
    return this.http.get<{ data: { subscription: Subscription } }>(`${this.apiUrl}/subscriptions/${subscriptionId}`)
      .pipe(
        map(response => response.data.subscription),
        catchError(this.handleError)
      );
  }

  // Update subscription
  updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Observable<Subscription> {
    return this.http.put<{ data: { subscription: Subscription } }>(`${this.apiUrl}/subscriptions/${subscriptionId}`, updates)
      .pipe(
        map(response => response.data.subscription),
        catchError(this.handleError)
      );
  }

  // Pause subscription
  pauseSubscription(subscriptionId: string): Observable<Subscription> {
    return this.http.post<{ data: { subscription: Subscription } }>(`${this.apiUrl}/subscriptions/${subscriptionId}/pause`, {})
      .pipe(
        map(response => response.data.subscription),
        catchError(this.handleError)
      );
  }

  // Resume subscription
  resumeSubscription(subscriptionId: string): Observable<Subscription> {
    return this.http.post<{ data: { subscription: Subscription } }>(`${this.apiUrl}/subscriptions/${subscriptionId}/resume`, {})
      .pipe(
        map(response => response.data.subscription),
        catchError(this.handleError)
      );
  }

  // Cancel subscription
  cancelSubscription(subscriptionId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/subscriptions/${subscriptionId}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Apply discount code
  applyDiscountCode(code: string, orderTotal: number): Observable<{
    isValid: boolean;
    discount: number;
    message: string;
  }> {
    return this.http.post<{ data: any }>(`${this.apiUrl}/orders/apply-discount`, { code, orderTotal })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // Calculate order totals
  calculateOrderTotals(items: { productId: string; quantity: number; pricePerKg: number }[], discountCode?: string): Observable<{
    subtotal: number;
    deliveryCharge: number;
    discount: number;
    total: number;
  }> {
    const calculateData = { items, discountCode };

    return this.http.post<{ data: any }>(`${this.apiUrl}/orders/calculate-totals`, calculateData)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // Get order summary for display
  getOrderSummary(order: Order): {
    itemCount: number;
    subtotal: number;
    deliveryCharge: number;
    discount: number;
    total: number;
    savings: number;
  } {
    const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = order.totalAmount;
    const deliveryCharge = order.deliveryCharge;
    const discount = order.discount;
    const total = order.finalAmount;
    const savings = discount + (deliveryCharge === 0 ? 30 : 0);

    return {
      itemCount,
      subtotal,
      deliveryCharge,
      discount,
      total,
      savings
    };
  }

  // Format order status for display
  getOrderStatusText(status: OrderStatus): string {
    const statusTexts: { [key in OrderStatus]: string } = {
      [OrderStatus.PENDING]: 'Order Placed',
      [OrderStatus.CONFIRMED]: 'Order Confirmed',
      [OrderStatus.GRINDING]: 'Grinding in Progress',
      [OrderStatus.DISPATCHED]: 'Order Dispatched',
      [OrderStatus.OUT_FOR_DELIVERY]: 'Out for Delivery',
      [OrderStatus.DELIVERED]: 'Delivered',
      [OrderStatus.CANCELLED]: 'Cancelled'
    };

    return statusTexts[status] || status;
  }

  // Get order status color
  getOrderStatusColor(status: OrderStatus): string {
    const statusColors: { [key in OrderStatus]: string } = {
      [OrderStatus.PENDING]: '#ff9800',
      [OrderStatus.CONFIRMED]: '#2196f3',
      [OrderStatus.GRINDING]: '#9c27b0',
      [OrderStatus.DISPATCHED]: '#3f51b5',
      [OrderStatus.OUT_FOR_DELIVERY]: '#ff5722',
      [OrderStatus.DELIVERED]: '#4caf50',
      [OrderStatus.CANCELLED]: '#f44336'
    };

    return statusColors[status] || '#757575';
  }

  // Check if order can be cancelled
  canCancelOrder(order: Order): boolean {
    const cancellableStatuses = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
    return cancellableStatuses.includes(order.status);
  }

  // Check if order can be rated
  canRateOrder(order: Order): boolean {
    return order.status === OrderStatus.DELIVERED;
  }

  // Format subscription frequency for display
  getSubscriptionFrequencyText(frequency: SubscriptionFrequency): string {
    const frequencyTexts: { [key in SubscriptionFrequency]: string } = {
      [SubscriptionFrequency.WEEKLY]: 'Weekly',
      [SubscriptionFrequency.BI_WEEKLY]: 'Bi-weekly',
      [SubscriptionFrequency.MONTHLY]: 'Monthly'
    };

    return frequencyTexts[frequency] || frequency;
  }

  // Get next delivery date for subscription
  getNextDeliveryDate(subscription: Subscription): Date {
    return new Date(subscription.nextDelivery);
  }

  // Format price for display
  formatPrice(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Launch UPI app for payment
  launchUPIPayment(paymentLink: string): void {
    if (this.isMobileDevice()) {
      window.location.href = paymentLink;
    } else {
      // For desktop, show QR code or copy link
      this.copyToClipboard(paymentLink);
      // You could also show a QR code modal here
    }
  }

  // Check if running on mobile device
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Copy text to clipboard
  private copyToClipboard(text: string): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        console.log('Payment link copied to clipboard');
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  // Error handling
  private handleError = (error: any) => {
    console.error('Order service error:', error);
    this.isLoading$.next(false);

    if (error.status === 0) {
      return throwError(() => new Error('Network error. Please check your connection.'));
    }

    if (error.status === 400) {
      return throwError(() => new Error(error.error?.message || 'Invalid request data.'));
    }

    if (error.status === 402) {
      return throwError(() => new Error('Payment required. Please complete the payment.'));
    }

    if (error.status === 409) {
      return throwError(() => new Error('Conflict. The order might already exist.'));
    }

    const errorMessage = error.error?.message || error.message || 'An unexpected error occurred';
    return throwError(() => new Error(errorMessage));
  };

  // Clear cached data
  clearCache(): void {
    this.orders$.next([]);
    this.subscriptions$.next([]);
  }

  // Refresh orders
  refreshOrders(): void {
    this.getMyOrders().subscribe();
  }

  // Refresh subscriptions
  refreshSubscriptions(): void {
    this.getMySubscriptions().subscribe();
  }
}