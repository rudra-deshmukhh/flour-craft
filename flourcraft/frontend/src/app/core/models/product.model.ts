export interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  imageUrl?: string;
  pricePerKg: number;
  minQuantity: number;
  maxQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  totalPrice: number;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  addressId: string;
  flourMillId?: string;
  status: OrderStatus;
  totalAmount: number;
  deliveryCharge: number;
  discount: number;
  finalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  transactionId?: string;
  deliverySlot?: string;
  subscriptionId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  orderItems: OrderItem[];
  address?: any;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  pricePerKg: number;
  totalPrice: number;
  product: Product;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  GRINDING = 'GRINDING',
  DISPATCHED = 'DISPATCHED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum SubscriptionFrequency {
  WEEKLY = 'WEEKLY',
  BI_WEEKLY = 'BI_WEEKLY',
  MONTHLY = 'MONTHLY'
}

export interface Subscription {
  id: string;
  userId: string;
  addressId: string;
  frequency: SubscriptionFrequency;
  nextDelivery: string;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: SubscriptionItem[];
}

export interface SubscriptionItem {
  id: string;
  subscriptionId: string;
  productId: string;
  quantity: number;
  pricePerKg: number;
  product: Product;
}

export interface CheckoutRequest {
  addressId: string;
  items: {
    productId: string;
    quantity: number;
  }[];
  deliverySlot?: string;
  paymentMethod: string;
  notes?: string;
  discountCode?: string;
  isSubscription?: boolean;
  subscriptionFrequency?: SubscriptionFrequency;
}

export interface PaymentLink {
  generic: string;
  gpay: string;
  phonepe: string;
  paytm: string;
}

export interface PaymentResponse {
  success: boolean;
  order: Order;
  paymentLinks: PaymentLink;
  transactionRef: string;
}

export interface ProductCategory {
  name: string;
  displayName: string;
  imageUrl?: string;
  productCount: number;
}

export interface ProductFilter {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'name' | 'price' | 'popular';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedProducts {
  products: Product[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}