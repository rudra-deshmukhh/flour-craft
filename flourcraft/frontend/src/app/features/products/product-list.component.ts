import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatBadgeModule } from '@angular/material/badge';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject, Observable, combineLatest } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, startWith, map } from 'rxjs/operators';

import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { 
  Product, 
  ProductCategory, 
  ProductFilter, 
  PaginatedProducts,
  Cart,
  CartItem
} from '../../core/models/product.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    MatCheckboxModule,
    MatBadgeModule,
    MatBottomSheetModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  template: `
    <div class="product-list-container">
      <!-- Header Section -->
      <div class="header-section bg-primary text-white py-8">
        <div class="container mx-auto px-4">
          <h1 class="text-3xl font-bold mb-2">Fresh Flour Delivered</h1>
          <p class="text-lg opacity-90">Choose from premium quality grains, freshly ground for you</p>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="filters-section bg-white shadow-sm sticky top-0 z-10">
        <div class="container mx-auto px-4 py-4">
          <div class="flex flex-col md:flex-row gap-4 items-center">
            <!-- Search Bar -->
            <div class="search-bar flex-1 max-w-md">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Search for grains & flour</mat-label>
                <input 
                  matInput 
                  [formControl]="searchControl" 
                  placeholder="wheat flour, ragi, jowar..."
                  class="search-input">
                <mat-icon matPrefix>search</mat-icon>
              </mat-form-field>
            </div>

            <!-- Sort & Filter Controls -->
            <div class="filter-controls flex gap-2">
              <mat-form-field appearance="outline" class="sort-select">
                <mat-label>Sort by</mat-label>
                <mat-select [formControl]="sortControl">
                  <mat-option value="popular">Popular</mat-option>
                  <mat-option value="price-low">Price: Low to High</mat-option>
                  <mat-option value="price-high">Price: High to Low</mat-option>
                  <mat-option value="name">Name A-Z</mat-option>
                </mat-select>
              </mat-form-field>

              <button 
                mat-stroked-button 
                class="filter-btn"
                (click)="toggleFilters()">
                <mat-icon>tune</mat-icon>
                Filters
              </button>
            </div>
          </div>

          <!-- Advanced Filters (Collapsible) -->
          <div class="advanced-filters mt-4" [class.hidden]="!showFilters">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- Price Range -->
              <div class="price-filter">
                <label class="block text-sm font-medium mb-2">Price Range (₹/kg)</label>
                <div class="price-range">
                  <mat-slider 
                    class="w-full"
                    [min]="priceRange.min" 
                    [max]="priceRange.max"
                    [step]="5"
                    [value]="currentFilter.minPrice || priceRange.min"
                    (valueChange)="onPriceChange($event, 'min')">
                  </mat-slider>
                  <div class="price-labels flex justify-between text-xs text-gray-600 mt-1">
                    <span>₹{{ currentFilter.minPrice || priceRange.min }}</span>
                    <span>₹{{ currentFilter.maxPrice || priceRange.max }}</span>
                  </div>
                </div>
              </div>

              <!-- Category Filter -->
              <div class="category-filter">
                <label class="block text-sm font-medium mb-2">Category</label>
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>Select Category</mat-label>
                  <mat-select [formControl]="categoryControl">
                    <mat-option value="">All Categories</mat-option>
                    <mat-option 
                      *ngFor="let category of categories" 
                      [value]="category.name">
                      {{ category.displayName }}
                    </mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <!-- Filter Actions -->
              <div class="filter-actions flex items-end gap-2">
                <button 
                  mat-stroked-button 
                  (click)="clearFilters()"
                  class="clear-btn">
                  Clear All
                </button>
                <button 
                  mat-raised-button 
                  color="primary"
                  (click)="applyFilters()"
                  class="apply-btn">
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Chips -->
      <div class="categories-section py-4 bg-gray-50">
        <div class="container mx-auto px-4">
          <div class="category-chips flex gap-2 overflow-x-auto pb-2">
            <mat-chip-listbox>
              <mat-chip-option 
                *ngFor="let category of categories" 
                [selected]="selectedCategory === category.name"
                (click)="selectCategory(category.name)"
                class="category-chip">
                <img 
                  [src]="category.imageUrl" 
                  [alt]="category.displayName"
                  class="w-6 h-6 rounded-full mr-2"
                  onerror="this.style.display='none'">
                {{ category.displayName }}
                <span class="ml-1 text-xs opacity-75">({{ category.productCount }})</span>
              </mat-chip-option>
            </mat-chip-listbox>
          </div>
        </div>
      </div>

      <!-- Products Grid -->
      <div class="products-section py-6">
        <div class="container mx-auto px-4">
          <!-- Loading State -->
          <div *ngIf="loading" class="flex justify-center py-12">
            <mat-spinner diameter="50"></mat-spinner>
          </div>

          <!-- Empty State -->
          <div *ngIf="!loading && products.length === 0" class="empty-state text-center py-12">
            <mat-icon class="text-6xl text-gray-400 mb-4">inventory_2</mat-icon>
            <h3 class="text-xl font-medium text-gray-700 mb-2">No Products Found</h3>
            <p class="text-gray-500 mb-4">Try adjusting your search or filters</p>
            <button mat-raised-button color="primary" (click)="clearFilters()">
              Clear Filters
            </button>
          </div>

          <!-- Products Grid -->
          <div 
            *ngIf="!loading && products.length > 0" 
            class="products-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            
            <mat-card 
              *ngFor="let product of products; trackBy: trackByProductId" 
              class="product-card hover:shadow-lg transition-all duration-200 relative">
              
              <!-- Product Image -->
              <div class="product-image-container relative">
                <img 
                  [src]="product.imageUrl || getDefaultImage(product.category)" 
                  [alt]="product.name"
                  class="product-image w-full h-48 object-cover rounded-t-lg">
                
                <!-- Quick Actions Overlay -->
                <div class="quick-actions absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    mat-mini-fab 
                    color="primary"
                    (click)="quickAddToCart(product)"
                    [disabled]="!product.isActive"
                    class="quick-add-btn">
                    <mat-icon>add_shopping_cart</mat-icon>
                  </button>
                </div>

                <!-- Stock Badge -->
                <div class="stock-badge absolute top-2 left-2">
                  <mat-chip 
                    [class]="product.isActive ? 'bg-green-500 text-white' : 'bg-red-500 text-white'"
                    class="text-xs">
                    {{ product.isActive ? 'In Stock' : 'Out of Stock' }}
                  </mat-chip>
                </div>
              </div>

              <mat-card-content class="p-4">
                <!-- Product Info -->
                <div class="product-info mb-3">
                  <h3 class="product-name text-lg font-semibold mb-1 line-clamp-2">
                    {{ product.name }}
                  </h3>
                  <p class="product-description text-sm text-gray-600 line-clamp-2" *ngIf="product.description">
                    {{ product.description }}
                  </p>
                  
                  <!-- Category and Quantity Info -->
                  <div class="product-meta flex items-center gap-2 mt-2">
                    <mat-chip class="category-chip text-xs">{{ getCategoryDisplayName(product.category) }}</mat-chip>
                    <span class="quantity-range text-xs text-gray-500">
                      Min: {{ product.minQuantity }}kg - Max: {{ product.maxQuantity }}kg
                    </span>
                  </div>
                </div>

                <!-- Price Section -->
                <div class="price-section mb-4">
                  <div class="price flex items-center justify-between">
                    <div class="price-info">
                      <span class="current-price text-xl font-bold text-primary">
                        {{ formatPrice(product.pricePerKg) }}
                      </span>
                      <span class="price-unit text-sm text-gray-600">/kg</span>
                    </div>
                  </div>
                </div>

                <!-- Cart Controls -->
                <div class="cart-controls" *ngIf="product.isActive">
                  <div 
                    *ngIf="!isInCart(product.id)" 
                    class="add-to-cart">
                    <div class="quantity-selector mb-3">
                      <label class="block text-sm font-medium mb-1">Quantity (kg)</label>
                      <div class="quantity-input flex items-center gap-2">
                        <button 
                          mat-icon-button 
                          (click)="decreaseQuantity(product.id)"
                          [disabled]="getSelectedQuantity(product.id) <= product.minQuantity">
                          <mat-icon>remove</mat-icon>
                        </button>
                        <span class="quantity-display min-w-12 text-center font-medium">
                          {{ getSelectedQuantity(product.id) }}
                        </span>
                        <button 
                          mat-icon-button 
                          (click)="increaseQuantity(product.id)"
                          [disabled]="getSelectedQuantity(product.id) >= product.maxQuantity">
                          <mat-icon>add</mat-icon>
                        </button>
                      </div>
                    </div>
                    
                    <button 
                      mat-raised-button 
                      color="primary" 
                      class="w-full add-cart-btn"
                      (click)="addToCart(product)">
                      <mat-icon>add_shopping_cart</mat-icon>
                      Add to Cart • {{ formatPrice(product.pricePerKg * getSelectedQuantity(product.id)) }}
                    </button>
                  </div>

                  <!-- In Cart Controls -->
                  <div *ngIf="isInCart(product.id)" class="in-cart-controls">
                    <div class="cart-quantity-controls flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <button 
                        mat-icon-button 
                        (click)="decreaseCartQuantity(product.id)"
                        class="quantity-btn">
                        <mat-icon>remove</mat-icon>
                      </button>
                      
                      <div class="quantity-info text-center">
                        <div class="quantity text-lg font-bold text-green-700">
                          {{ getCartQuantity(product.id) }} kg
                        </div>
                        <div class="total-price text-sm text-green-600">
                          {{ formatPrice(getCartItemTotal(product.id)) }}
                        </div>
                      </div>
                      
                      <button 
                        mat-icon-button 
                        (click)="increaseCartQuantity(product.id)"
                        [disabled]="getCartQuantity(product.id) >= product.maxQuantity"
                        class="quantity-btn">
                        <mat-icon>add</mat-icon>
                      </button>
                    </div>
                    
                    <button 
                      mat-stroked-button 
                      color="warn"
                      class="w-full mt-2 remove-btn"
                      (click)="removeFromCart(product.id)">
                      <mat-icon>delete</mat-icon>
                      Remove from Cart
                    </button>
                  </div>
                </div>

                <!-- Out of Stock Message -->
                <div *ngIf="!product.isActive" class="out-of-stock text-center py-3">
                  <p class="text-gray-500">Currently out of stock</p>
                  <button mat-stroked-button class="notify-btn mt-2">
                    Notify when available
                  </button>
                </div>
              </mat-card-content>
            </mat-card>
          </div>

          <!-- Load More Button -->
          <div *ngIf="hasMoreProducts" class="load-more text-center mt-8">
            <button 
              mat-raised-button 
              color="primary"
              (click)="loadMoreProducts()"
              [disabled]="loading">
              <mat-spinner diameter="20" *ngIf="loading" class="mr-2"></mat-spinner>
              Load More Products
            </button>
          </div>
        </div>
      </div>

      <!-- Floating Cart Button -->
      <button 
        *ngIf="cartItemCount > 0"
        mat-fab 
        extended
        color="primary"
        class="floating-cart-btn fixed bottom-4 right-4 z-50"
        routerLink="/cart">
        <mat-icon>shopping_cart</mat-icon>
        <span class="ml-2">{{ cartItemCount }} items • {{ formatPrice(cartTotal) }}</span>
        <mat-icon matBadge="{{ cartItemCount }}" matBadgeColor="accent">arrow_forward</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .product-list-container {
      min-height: 100vh;
      background-color: #f8f9fa;
    }

    .header-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .filters-section {
      border-bottom: 1px solid #e0e0e0;
    }

    .category-chip {
      transition: all 0.2s ease-in-out;
    }

    .category-chip:hover {
      transform: scale(1.05);
    }

    .product-card {
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.3s ease-in-out;
    }

    .product-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    }

    .product-image {
      transition: transform 0.3s ease-in-out;
    }

    .product-card:hover .product-image {
      transform: scale(1.05);
    }

    .quantity-input button {
      min-width: 32px;
      width: 32px;
      height: 32px;
    }

    .in-cart-controls {
      border: 2px solid #4caf50;
      border-radius: 8px;
      overflow: hidden;
    }

    .floating-cart-btn {
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      transition: all 0.3s ease-in-out;
    }

    .floating-cart-btn:hover {
      transform: scale(1.05);
    }

    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .search-input {
      border-radius: 25px;
    }

    .products-grid {
      margin-top: 1rem;
    }

    @media (max-width: 768px) {
      .products-grid {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
      }
      
      .floating-cart-btn {
        bottom: 70px;
        right: 16px;
      }
    }
  `]
})
export class ProductListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Form Controls
  searchControl = new FormControl('');
  sortControl = new FormControl('popular');
  categoryControl = new FormControl('');
  
  // Data
  products: Product[] = [];
  categories: ProductCategory[] = [];
  cart$: Observable<Cart>;
  
  // State
  loading = false;
  showFilters = false;
  selectedCategory = '';
  currentPage = 1;
  hasMoreProducts = true;
  priceRange = { min: 0, max: 200 };
  
  // Filters
  currentFilter: ProductFilter = {};
  
  // Selected quantities for products not in cart
  selectedQuantities: { [productId: string]: number } = {};

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    this.cart$ = this.cartService.cart;
  }

  ngOnInit(): void {
    this.initializeFilters();
    this.loadCategories();
    this.loadProducts();
    this.setupFilterListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeFilters(): void {
    // Get price range
    this.productService.getPriceRange()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (range) => {
          this.priceRange = range;
          this.currentFilter.minPrice = range.min;
          this.currentFilter.maxPrice = range.max;
        },
        error: (error) => {
          console.error('Failed to load price range:', error);
        }
      });
  }

  private setupFilterListeners(): void {
    // Search filter
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((search) => {
        this.currentFilter.search = search || undefined;
        this.resetAndLoadProducts();
      });

    // Sort filter
    this.sortControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((sortValue) => {
        switch (sortValue) {
          case 'popular':
            this.currentFilter.sortBy = 'popular';
            this.currentFilter.sortOrder = 'desc';
            break;
          case 'price-low':
            this.currentFilter.sortBy = 'price';
            this.currentFilter.sortOrder = 'asc';
            break;
          case 'price-high':
            this.currentFilter.sortBy = 'price';
            this.currentFilter.sortOrder = 'desc';
            break;
          case 'name':
            this.currentFilter.sortBy = 'name';
            this.currentFilter.sortOrder = 'asc';
            break;
        }
        this.resetAndLoadProducts();
      });

    // Category filter
    this.categoryControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((category) => {
        this.currentFilter.category = category || undefined;
        this.selectedCategory = category || '';
        this.resetAndLoadProducts();
      });
  }

  private loadCategories(): void {
    this.productService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (error) => {
          console.error('Failed to load categories:', error);
        }
      });
  }

  private loadProducts(): void {
    this.loading = true;
    
    this.productService.getProducts(this.currentFilter, this.currentPage, 20)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: PaginatedProducts) => {
          if (this.currentPage === 1) {
            this.products = data.products;
          } else {
            this.products.push(...data.products);
          }
          
          this.hasMoreProducts = data.hasNext;
          this.initializeSelectedQuantities(data.products);
          this.loading = false;
        },
        error: (error) => {
          this.loading = false;
          this.snackBar.open('Failed to load products', 'Close', { duration: 3000 });
        }
      });
  }

  private resetAndLoadProducts(): void {
    this.currentPage = 1;
    this.hasMoreProducts = true;
    this.loadProducts();
  }

  private initializeSelectedQuantities(products: Product[]): void {
    products.forEach(product => {
      if (!this.selectedQuantities[product.id]) {
        this.selectedQuantities[product.id] = product.minQuantity;
      }
    });
  }

  // Filter Methods
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  selectCategory(categoryName: string): void {
    this.selectedCategory = categoryName === this.selectedCategory ? '' : categoryName;
    this.categoryControl.setValue(this.selectedCategory);
  }

  onPriceChange(value: number, type: 'min' | 'max'): void {
    if (type === 'min') {
      this.currentFilter.minPrice = value;
    } else {
      this.currentFilter.maxPrice = value;
    }
  }

  applyFilters(): void {
    this.resetAndLoadProducts();
    this.showFilters = false;
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.sortControl.setValue('popular');
    this.categoryControl.setValue('');
    this.selectedCategory = '';
    this.currentFilter = {
      minPrice: this.priceRange.min,
      maxPrice: this.priceRange.max
    };
    this.resetAndLoadProducts();
    this.showFilters = false;
  }

  loadMoreProducts(): void {
    if (!this.hasMoreProducts || this.loading) return;
    
    this.currentPage++;
    this.loadProducts();
  }

  // Cart Methods
  getSelectedQuantity(productId: string): number {
    return this.selectedQuantities[productId] || 1;
  }

  increaseQuantity(productId: string): void {
    const product = this.products.find(p => p.id === productId);
    if (product && this.selectedQuantities[productId] < product.maxQuantity) {
      this.selectedQuantities[productId]++;
    }
  }

  decreaseQuantity(productId: string): void {
    const product = this.products.find(p => p.id === productId);
    if (product && this.selectedQuantities[productId] > product.minQuantity) {
      this.selectedQuantities[productId]--;
    }
  }

  addToCart(product: Product): void {
    const quantity = this.selectedQuantities[product.id];
    this.cartService.addItem(product, quantity);
    this.snackBar.open(`${product.name} added to cart`, 'View Cart', { 
      duration: 3000,
      action: 'View Cart'
    }).onAction().subscribe(() => {
      // Navigate to cart
    });
  }

  quickAddToCart(product: Product): void {
    this.cartService.addItem(product, product.minQuantity);
    this.snackBar.open(`${product.name} added to cart`, 'Close', { duration: 2000 });
  }

  isInCart(productId: string): boolean {
    return this.cartService.isInCart(productId);
  }

  getCartQuantity(productId: string): number {
    return this.cartService.getItemQuantity(productId);
  }

  getCartItemTotal(productId: string): number {
    const item = this.cartService.getItem(productId);
    return item ? item.totalPrice : 0;
  }

  increaseCartQuantity(productId: string): void {
    this.cartService.increaseQuantity(productId);
  }

  decreaseCartQuantity(productId: string): void {
    this.cartService.decreaseQuantity(productId);
  }

  removeFromCart(productId: string): void {
    this.cartService.removeItem(productId);
    this.snackBar.open('Item removed from cart', 'Close', { duration: 2000 });
  }

  get cartItemCount(): number {
    return this.cartService.totalItems;
  }

  get cartTotal(): number {
    return this.cartService.totalAmount;
  }

  // Utility Methods
  trackByProductId(index: number, product: Product): string {
    return product.id;
  }

  getCategoryDisplayName(categoryName: string): string {
    const category = this.categories.find(c => c.name === categoryName);
    return category ? category.displayName : categoryName;
  }

  getDefaultImage(category: string): string {
    return this.productService.getDefaultProductImage(category);
  }

  formatPrice(amount: number): string {
    return this.productService.formatPrice(amount);
  }
}