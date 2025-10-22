import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { FirebaseAuthService } from './firebase-auth.service';
import { 
  User, 
  UserRole, 
  AuthResponse, 
  LoginRequest,
  Address,
  AddressRequest,
  PincodeServiceability
} from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private currentUser$ = new BehaviorSubject<User | null>(null);
  private isLoading$ = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private router: Router,
    private firebaseAuth: FirebaseAuthService
  ) {
    this.initializeAuth();
  }

  // Getters
  get user$(): Observable<User | null> {
    return this.currentUser$.asObservable();
  }

  get currentUser(): User | null {
    return this.currentUser$.value;
  }

  get loading$(): Observable<boolean> {
    return this.isLoading$.asObservable();
  }

  get isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  // Initialize authentication state
  private async initializeAuth(): Promise<void> {
    // Listen to Firebase auth state changes
    this.firebaseAuth.currentFirebaseUser$.subscribe(async (firebaseUser) => {
      if (firebaseUser) {
        // Firebase user is authenticated, fetch user from backend
        await this.fetchUserProfile();
      } else {
        // No Firebase user, clear current user
        this.currentUser$.next(null);
      }
    });
  }

  // Send OTP to phone number
  async sendOTP(phoneNumber: string): Promise<void> {
    try {
      this.isLoading$.next(true);
      await this.firebaseAuth.sendOTP(phoneNumber);
    } catch (error) {
      console.error('Error sending OTP:', error);
      throw error;
    } finally {
      this.isLoading$.next(false);
    }
  }

  // Verify OTP and register/login user
  async verifyOTPAndLogin(
    otp: string, 
    phoneNumber: string, 
    role: UserRole = UserRole.CUSTOMER,
    additionalInfo?: { firstName?: string; lastName?: string; email?: string }
  ): Promise<User> {
    try {
      this.isLoading$.next(true);

      // Verify OTP with Firebase
      const firebaseUser = await this.firebaseAuth.verifyOTP(otp);
      
      // Get Firebase ID token
      const firebaseToken = await firebaseUser.getIdToken();

      // Prepare login request
      const loginRequest: LoginRequest = {
        firebaseToken,
        phoneNumber,
        role,
        ...additionalInfo
      };

      // Register/login with backend
      const response = await this.registerOrLogin(loginRequest).toPromise();
      
      if (!response?.data?.user) {
        throw new Error('Failed to authenticate user');
      }

      const user = response.data.user;
      this.currentUser$.next(user);

      console.log('User authenticated successfully:', user);
      return user;

    } catch (error) {
      console.error('Error verifying OTP and logging in:', error);
      await this.firebaseAuth.signOut();
      throw error;
    } finally {
      this.isLoading$.next(false);
    }
  }

  // Register or login user with backend
  private registerOrLogin(loginRequest: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, loginRequest)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Fetch user profile from backend
  async fetchUserProfile(): Promise<void> {
    try {
      const token = await this.firebaseAuth.getIdToken();
      if (!token) {
        this.currentUser$.next(null);
        return;
      }

      const user = await this.http.get<{ data: { user: User } }>(`${this.apiUrl}/auth/profile`)
        .toPromise();

      if (user?.data?.user) {
        this.currentUser$.next(user.data.user);
      } else {
        this.currentUser$.next(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      this.currentUser$.next(null);
    }
  }

  // Update user profile
  updateProfile(profileData: Partial<User>): Observable<User> {
    return this.http.put<{ data: { user: User } }>(`${this.apiUrl}/auth/profile`, profileData)
      .pipe(
        map(response => response.data.user),
        tap(user => this.currentUser$.next(user)),
        catchError(this.handleError)
      );
  }

  // Sign out user
  async signOut(): Promise<void> {
    try {
      this.isLoading$.next(true);
      await this.firebaseAuth.signOut();
      this.currentUser$.next(null);
      this.router.navigate(['/auth/login']);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      this.isLoading$.next(false);
    }
  }

  // Check user role
  hasRole(role: UserRole): boolean {
    return this.currentUser?.role === role;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return !!this.currentUser && roles.includes(this.currentUser.role);
  }

  // Address management methods
  getAddresses(): Observable<Address[]> {
    return this.http.get<{ data: { addresses: Address[] } }>(`${this.apiUrl}/users/addresses`)
      .pipe(
        map(response => response.data.addresses),
        catchError(this.handleError)
      );
  }

  addAddress(addressData: AddressRequest): Observable<Address> {
    return this.http.post<{ data: { address: Address } }>(`${this.apiUrl}/users/addresses`, addressData)
      .pipe(
        map(response => response.data.address),
        catchError(this.handleError)
      );
  }

  updateAddress(addressId: string, addressData: Partial<AddressRequest>): Observable<Address> {
    return this.http.put<{ data: { address: Address } }>(`${this.apiUrl}/users/addresses/${addressId}`, addressData)
      .pipe(
        map(response => response.data.address),
        catchError(this.handleError)
      );
  }

  deleteAddress(addressId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/addresses/${addressId}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  setDefaultAddress(addressId: string): Observable<Address> {
    return this.http.patch<{ data: { address: Address } }>(`${this.apiUrl}/users/addresses/${addressId}/default`, {})
      .pipe(
        map(response => response.data.address),
        catchError(this.handleError)
      );
  }

  // Pincode serviceability check
  checkPincodeServiceability(pincode: string): Observable<PincodeServiceability> {
    return this.http.get<{ data: PincodeServiceability }>(`${this.apiUrl}/config/pincode/${pincode}/serviceability`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // Navigation helpers based on role
  navigateToRoleDashboard(): void {
    const user = this.currentUser;
    if (!user) {
      this.router.navigate(['/auth/login']);
      return;
    }

    switch (user.role) {
      case UserRole.CUSTOMER:
        this.router.navigate(['/customer/dashboard']);
        break;
      case UserRole.FLOUR_MILL_USER:
        this.router.navigate(['/flour-mill/dashboard']);
        break;
      case UserRole.DELIVERY_PARTNER:
        this.router.navigate(['/delivery/dashboard']);
        break;
      case UserRole.ADMIN:
        this.router.navigate(['/admin/dashboard']);
        break;
      default:
        this.router.navigate(['/']);
    }
  }

  // Get user statistics
  getUserStats(): Observable<any> {
    return this.http.get<{ data: { stats: any } }>(`${this.apiUrl}/auth/stats`)
      .pipe(
        map(response => response.data.stats),
        catchError(this.handleError)
      );
  }

  // Error handling
  private handleError = (error: any) => {
    console.error('Auth service error:', error);
    
    if (error.status === 401) {
      // Unauthorized - sign out user
      this.firebaseAuth.signOut();
      this.router.navigate(['/auth/login']);
      return throwError(() => new Error('Session expired. Please login again.'));
    }
    
    if (error.status === 403) {
      return throwError(() => new Error('Access denied. Insufficient permissions.'));
    }
    
    if (error.status === 0) {
      return throwError(() => new Error('Network error. Please check your connection.'));
    }

    const errorMessage = error.error?.message || error.message || 'An unexpected error occurred';
    return throwError(() => new Error(errorMessage));
  };

  // Refresh authentication token
  async refreshToken(): Promise<string | null> {
    try {
      return await this.firebaseAuth.refreshToken();
    } catch (error) {
      console.error('Error refreshing token:', error);
      await this.signOut();
      return null;
    }
  }

  // Check if token is valid
  async isTokenValid(): Promise<boolean> {
    try {
      const token = await this.firebaseAuth.getIdToken();
      return !!token;
    } catch (error) {
      return false;
    }
  }
}