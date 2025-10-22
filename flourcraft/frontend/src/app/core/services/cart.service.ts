import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product, Cart, CartItem } from '../models/product.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly CART_STORAGE_KEY = 'flourcraft_cart';
  private cart$ = new BehaviorSubject<Cart>(this.getEmptyCart());

  constructor(private authService: AuthService) {
    this.loadCartFromStorage();
    
    // Sync cart when user logs in/out
    this.authService.user$.subscribe(user => {
      if (user) {
        this.syncCartWithServer();
      } else {
        this.clearServerCart();
      }
    });
  }

  // Getters
  get cart(): Observable<Cart> {
    return this.cart$.asObservable();
  }

  get currentCart(): Cart {
    return this.cart$.value;
  }

  get totalItems(): number {
    return this.currentCart.totalItems;
  }

  get totalAmount(): number {
    return this.currentCart.totalAmount;
  }

  get isEmpty(): boolean {
    return this.currentCart.items.length === 0;
  }

  // Add item to cart
  addItem(product: Product, quantity: number = 1): void {
    const cart = this.currentCart;
    const existingItemIndex = cart.items.findIndex(item => item.product.id === product.id);

    if (existingItemIndex > -1) {
      // Update existing item
      const existingItem = cart.items[existingItemIndex];
      const newQuantity = Math.min(existingItem.quantity + quantity, product.maxQuantity);
      
      cart.items[existingItemIndex] = {
        ...existingItem,
        quantity: newQuantity,
        totalPrice: newQuantity * product.pricePerKg
      };
    } else {
      // Add new item
      const validQuantity = Math.max(Math.min(quantity, product.maxQuantity), product.minQuantity);
      cart.items.push({
        product,
        quantity: validQuantity,
        totalPrice: validQuantity * product.pricePerKg
      });
    }

    this.updateCart(cart);
  }

  // Remove item from cart
  removeItem(productId: string): void {
    const cart = this.currentCart;
    cart.items = cart.items.filter(item => item.product.id !== productId);
    this.updateCart(cart);
  }

  // Update item quantity
  updateItemQuantity(productId: string, quantity: number): void {
    const cart = this.currentCart;
    const itemIndex = cart.items.findIndex(item => item.product.id === productId);

    if (itemIndex > -1) {
      const item = cart.items[itemIndex];
      const validQuantity = Math.max(
        Math.min(quantity, item.product.maxQuantity), 
        item.product.minQuantity
      );

      if (validQuantity <= 0) {
        this.removeItem(productId);
        return;
      }

      cart.items[itemIndex] = {
        ...item,
        quantity: validQuantity,
        totalPrice: validQuantity * item.product.pricePerKg
      };

      this.updateCart(cart);
    }
  }

  // Increase item quantity
  increaseQuantity(productId: string): void {
    const cart = this.currentCart;
    const item = cart.items.find(item => item.product.id === productId);
    
    if (item && item.quantity < item.product.maxQuantity) {
      this.updateItemQuantity(productId, item.quantity + 1);
    }
  }

  // Decrease item quantity
  decreaseQuantity(productId: string): void {
    const cart = this.currentCart;
    const item = cart.items.find(item => item.product.id === productId);
    
    if (item) {
      if (item.quantity <= item.product.minQuantity) {
        this.removeItem(productId);
      } else {
        this.updateItemQuantity(productId, item.quantity - 1);
      }
    }
  }

  // Clear cart
  clearCart(): void {
    this.updateCart(this.getEmptyCart());
  }

  // Get item by product ID
  getItem(productId: string): CartItem | undefined {
    return this.currentCart.items.find(item => item.product.id === productId);
  }

  // Check if product is in cart
  isInCart(productId: string): boolean {
    return !!this.getItem(productId);
  }

  // Get item quantity
  getItemQuantity(productId: string): number {
    const item = this.getItem(productId);
    return item ? item.quantity : 0;
  }

  // Calculate delivery charge
  getDeliveryCharge(): number {
    const freeDeliveryThreshold = 500; // ₹500 for free delivery
    const deliveryCharge = 30; // ₹30 delivery charge
    
    return this.totalAmount >= freeDeliveryThreshold ? 0 : deliveryCharge;
  }

  // Calculate final amount including delivery
  getFinalAmount(discount: number = 0): number {
    return this.totalAmount + this.getDeliveryCharge() - discount;
  }

  // Validate cart for checkout
  validateCart(): { isValid: boolean; errors: string[] } {
    const cart = this.currentCart;
    const errors: string[] = [];

    if (cart.items.length === 0) {
      errors.push('Cart is empty');
    }

    // Check minimum order amount
    const minOrderAmount = 200; // ₹200 minimum order
    if (this.totalAmount < minOrderAmount) {
      errors.push(`Minimum order amount is ₹${minOrderAmount}`);
    }

    // Check individual item quantities
    cart.items.forEach(item => {
      if (item.quantity < item.product.minQuantity) {
        errors.push(`Minimum quantity for ${item.product.name} is ${item.product.minQuantity} kg`);
      }
      if (item.quantity > item.product.maxQuantity) {
        errors.push(`Maximum quantity for ${item.product.name} is ${item.product.maxQuantity} kg`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Private methods
  private updateCart(cart: Cart): void {
    // Recalculate totals
    cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
    cart.totalAmount = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    cart.updatedAt = new Date().toISOString();

    // Update BehaviorSubject
    this.cart$.next(cart);

    // Save to localStorage
    this.saveCartToStorage(cart);

    // Sync with server if user is logged in
    if (this.authService.isAuthenticated) {
      this.syncCartWithServer();
    }
  }

  private getEmptyCart(): Cart {
    return {
      items: [],
      totalItems: 0,
      totalAmount: 0,
      updatedAt: new Date().toISOString()
    };
  }

  private saveCartToStorage(cart: Cart): void {
    try {
      localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }

  private loadCartFromStorage(): void {
    try {
      const cartData = localStorage.getItem(this.CART_STORAGE_KEY);
      if (cartData) {
        const cart = JSON.parse(cartData) as Cart;
        this.cart$.next(cart);
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      this.cart$.next(this.getEmptyCart());
    }
  }

  private async syncCartWithServer(): void {
    // TODO: Implement server sync when backend cart endpoints are ready
    // This would save the cart to the server and merge with any existing server cart
    try {
      const cart = this.currentCart;
      if (cart.items.length > 0) {
        // Send cart to server
        console.log('Syncing cart with server:', cart);
        // await this.http.post('/api/cart/sync', cart).toPromise();
      }
    } catch (error) {
      console.error('Error syncing cart with server:', error);
    }
  }

  private clearServerCart(): void {
    // TODO: Clear server cart when user logs out
    // await this.http.delete('/api/cart').toPromise();
  }

  // Utility methods for cart management
  hasMinQuantityForProduct(productId: string): boolean {
    const item = this.getItem(productId);
    return item ? item.quantity >= item.product.minQuantity : false;
  }

  hasMaxQuantityForProduct(productId: string): boolean {
    const item = this.getItem(productId);
    return item ? item.quantity >= item.product.maxQuantity : false;
  }

  canIncreaseQuantity(productId: string): boolean {
    return !this.hasMaxQuantityForProduct(productId);
  }

  canDecreaseQuantity(productId: string): boolean {
    const item = this.getItem(productId);
    return item ? item.quantity > item.product.minQuantity : false;
  }

  // Get cart summary for display
  getCartSummary() {
    const cart = this.currentCart;
    const deliveryCharge = this.getDeliveryCharge();
    
    return {
      itemCount: cart.totalItems,
      subtotal: cart.totalAmount,
      deliveryCharge,
      total: cart.totalAmount + deliveryCharge,
      savings: deliveryCharge === 0 ? 30 : 0 // Show savings when delivery is free
    };
  }

  // Apply discount to cart
  applyDiscount(discountAmount: number): number {
    return Math.max(0, this.getFinalAmount() - discountAmount);
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
}