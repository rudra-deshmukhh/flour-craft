import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { 
  Product, 
  ProductCategory, 
  ProductFilter, 
  PaginatedProducts 
} from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly apiUrl = environment.apiUrl;
  private products$ = new BehaviorSubject<Product[]>([]);
  private categories$ = new BehaviorSubject<ProductCategory[]>([]);
  private isLoading$ = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient) {
    this.loadCategories();
  }

  // Getters
  get products(): Observable<Product[]> {
    return this.products$.asObservable();
  }

  get categories(): Observable<ProductCategory[]> {
    return this.categories$.asObservable();
  }

  get loading(): Observable<boolean> {
    return this.isLoading$.asObservable();
  }

  // Get all products with filtering and pagination
  getProducts(
    filter: ProductFilter = {}, 
    page: number = 1, 
    limit: number = 20
  ): Observable<PaginatedProducts> {
    this.isLoading$.next(true);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (filter.category) {
      params = params.set('category', filter.category);
    }
    if (filter.minPrice) {
      params = params.set('minPrice', filter.minPrice.toString());
    }
    if (filter.maxPrice) {
      params = params.set('maxPrice', filter.maxPrice.toString());
    }
    if (filter.sortBy) {
      params = params.set('sortBy', filter.sortBy);
    }
    if (filter.sortOrder) {
      params = params.set('sortOrder', filter.sortOrder);
    }
    if (filter.search) {
      params = params.set('search', filter.search);
    }

    return this.http.get<{ data: PaginatedProducts }>(`${this.apiUrl}/products`, { params })
      .pipe(
        map(response => response.data),
        tap(data => {
          this.products$.next(data.products);
          this.isLoading$.next(false);
        }),
        catchError(this.handleError)
      );
  }

  // Get product by ID
  getProductById(id: string): Observable<Product> {
    return this.http.get<{ data: { product: Product } }>(`${this.apiUrl}/products/${id}`)
      .pipe(
        map(response => response.data.product),
        catchError(this.handleError)
      );
  }

  // Get products by category
  getProductsByCategory(category: string, page: number = 1, limit: number = 20): Observable<PaginatedProducts> {
    return this.getProducts({ category }, page, limit);
  }

  // Search products
  searchProducts(query: string, page: number = 1, limit: number = 20): Observable<PaginatedProducts> {
    return this.getProducts({ search: query }, page, limit);
  }

  // Get featured/popular products
  getFeaturedProducts(limit: number = 10): Observable<Product[]> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('sortBy', 'popular')
      .set('sortOrder', 'desc');

    return this.http.get<{ data: PaginatedProducts }>(`${this.apiUrl}/products`, { params })
      .pipe(
        map(response => response.data.products),
        catchError(this.handleError)
      );
  }

  // Get product categories
  getCategories(): Observable<ProductCategory[]> {
    return this.http.get<{ data: { categories: ProductCategory[] } }>(`${this.apiUrl}/products/categories`)
      .pipe(
        map(response => response.data.categories),
        tap(categories => this.categories$.next(categories)),
        catchError(this.handleError)
      );
  }

  // Load categories on service initialization
  private loadCategories(): void {
    this.getCategories().subscribe({
      next: (categories) => {
        console.log('Categories loaded:', categories);
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        // Set default categories if API fails
        this.setDefaultCategories();
      }
    });
  }

  // Set default categories as fallback
  private setDefaultCategories(): void {
    const defaultCategories: ProductCategory[] = [
      {
        name: 'wheat',
        displayName: 'Wheat Flour',
        imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=200',
        productCount: 0
      },
      {
        name: 'ragi',
        displayName: 'Ragi Flour',
        imageUrl: 'https://images.unsplash.com/photo-1631264876034-c8b2c0b2e3e9?w=200',
        productCount: 0
      },
      {
        name: 'jowar',
        displayName: 'Jowar Flour',
        imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200',
        productCount: 0
      },
      {
        name: 'rice',
        displayName: 'Rice Flour',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200',
        productCount: 0
      },
      {
        name: 'bajra',
        displayName: 'Bajra Flour',
        imageUrl: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=200',
        productCount: 0
      },
      {
        name: 'multigrain',
        displayName: 'Multigrain Flour',
        imageUrl: 'https://images.unsplash.com/photo-1549313503-7ad5ac882d5d?w=200',
        productCount: 0
      }
    ];

    this.categories$.next(defaultCategories);
  }

  // Get price range for filters
  getPriceRange(): Observable<{ min: number; max: number }> {
    return this.http.get<{ data: { min: number; max: number } }>(`${this.apiUrl}/products/price-range`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // Get product recommendations
  getRecommendations(productId?: string, limit: number = 5): Observable<Product[]> {
    let params = new HttpParams().set('limit', limit.toString());
    
    if (productId) {
      params = params.set('productId', productId);
    }

    return this.http.get<{ data: { products: Product[] } }>(`${this.apiUrl}/products/recommendations`, { params })
      .pipe(
        map(response => response.data.products),
        catchError(this.handleError)
      );
  }

  // Check product availability
  checkAvailability(productId: string, quantity: number): Observable<{ available: boolean; message?: string }> {
    return this.http.post<{ data: { available: boolean; message?: string } }>(
      `${this.apiUrl}/products/${productId}/availability`, 
      { quantity }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Get delivery time estimate for product
  getDeliveryEstimate(productId: string, pincode: string): Observable<{ estimatedDays: number; slots: string[] }> {
    return this.http.get<{ data: { estimatedDays: number; slots: string[] } }>(
      `${this.apiUrl}/products/${productId}/delivery-estimate`,
      { params: { pincode } }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Filter and sort helpers
  sortProducts(products: Product[], sortBy: string, sortOrder: 'asc' | 'desc' = 'asc'): Product[] {
    return [...products].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.pricePerKg;
          bValue = b.pricePerKg;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  filterProducts(products: Product[], filter: ProductFilter): Product[] {
    return products.filter(product => {
      // Category filter
      if (filter.category && product.category !== filter.category) {
        return false;
      }

      // Price range filter
      if (filter.minPrice && product.pricePerKg < filter.minPrice) {
        return false;
      }
      if (filter.maxPrice && product.pricePerKg > filter.maxPrice) {
        return false;
      }

      // Search filter
      if (filter.search) {
        const searchTerm = filter.search.toLowerCase();
        const searchableText = `${product.name} ${product.description} ${product.category}`.toLowerCase();
        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }

  // Format price for display
  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  }

  // Get default product image
  getDefaultProductImage(category: string): string {
    const defaultImages: { [key: string]: string } = {
      wheat: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400',
      ragi: 'https://images.unsplash.com/photo-1631264876034-c8b2c0b2e3e9?w=400',
      jowar: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
      bajra: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400',
      multigrain: 'https://images.unsplash.com/photo-1549313503-7ad5ac882d5d?w=400'
    };

    return defaultImages[category] || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400';
  }

  // Error handling
  private handleError = (error: any) => {
    console.error('Product service error:', error);
    this.isLoading$.next(false);

    if (error.status === 0) {
      return throwError(() => new Error('Network error. Please check your connection.'));
    }

    const errorMessage = error.error?.message || error.message || 'An unexpected error occurred';
    return throwError(() => new Error(errorMessage));
  };

  // Clear products cache
  clearCache(): void {
    this.products$.next([]);
  }

  // Refresh products
  refreshProducts(filter?: ProductFilter): void {
    this.getProducts(filter).subscribe();
  }
}