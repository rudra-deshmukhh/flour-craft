import { Injectable } from '@angular/core';
import { 
  Auth, 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  ConfirmationResult,
  PhoneAuthProvider,
  signInWithCredential,
  User as FirebaseUser,
  onAuthStateChanged,
  signOut
} from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private confirmationResult: ConfirmationResult | null = null;
  private firebaseUser$ = new BehaviorSubject<FirebaseUser | null>(null);

  constructor(private auth: Auth) {
    // Listen to auth state changes
    onAuthStateChanged(this.auth, (user) => {
      this.firebaseUser$.next(user);
    });
  }

  get currentFirebaseUser$(): Observable<FirebaseUser | null> {
    return this.firebaseUser$.asObservable();
  }

  get currentFirebaseUser(): FirebaseUser | null {
    return this.firebaseUser$.value;
  }

  async initializeRecaptcha(containerId: string = 'recaptcha-container'): Promise<void> {
    try {
      this.recaptchaVerifier = new RecaptchaVerifier(this.auth, containerId, {
        size: 'invisible',
        callback: (response: any) => {
          console.log('Recaptcha resolved:', response);
        },
        'expired-callback': () => {
          console.log('Recaptcha expired');
          this.resetRecaptcha();
        }
      });

      await this.recaptchaVerifier.render();
      console.log('Recaptcha initialized successfully');
    } catch (error) {
      console.error('Error initializing recaptcha:', error);
      throw new Error('Failed to initialize recaptcha. Please try again.');
    }
  }

  async sendOTP(phoneNumber: string): Promise<void> {
    try {
      // Ensure phone number is in international format
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      if (!this.recaptchaVerifier) {
        await this.initializeRecaptcha();
      }

      if (!this.recaptchaVerifier) {
        throw new Error('Recaptcha not initialized');
      }

      this.confirmationResult = await signInWithPhoneNumber(
        this.auth, 
        formattedPhone, 
        this.recaptchaVerifier
      );

      console.log('OTP sent successfully to:', formattedPhone);
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      this.resetRecaptcha();
      
      if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please try again later.');
      } else if (error.code === 'auth/invalid-phone-number') {
        throw new Error('Invalid phone number format.');
      } else if (error.code === 'auth/quota-exceeded') {
        throw new Error('SMS quota exceeded. Please try again later.');
      } else {
        throw new Error('Failed to send OTP. Please try again.');
      }
    }
  }

  async verifyOTP(otp: string): Promise<FirebaseUser> {
    try {
      if (!this.confirmationResult) {
        throw new Error('No OTP session found. Please request a new OTP.');
      }

      const result = await this.confirmationResult.confirm(otp);
      const user = result.user;

      if (!user) {
        throw new Error('Authentication failed');
      }

      console.log('OTP verified successfully for user:', user.uid);
      return user;
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      
      if (error.code === 'auth/invalid-verification-code') {
        throw new Error('Invalid OTP. Please check and try again.');
      } else if (error.code === 'auth/code-expired') {
        throw new Error('OTP has expired. Please request a new one.');
      } else {
        throw new Error('Failed to verify OTP. Please try again.');
      }
    }
  }

  async getIdToken(): Promise<string | null> {
    try {
      const user = this.currentFirebaseUser;
      if (!user) {
        return null;
      }
      
      return await user.getIdToken();
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }

  async refreshToken(): Promise<string | null> {
    try {
      const user = this.currentFirebaseUser;
      if (!user) {
        return null;
      }
      
      return await user.getIdToken(true); // Force refresh
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      this.resetRecaptcha();
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      throw new Error('Failed to sign out. Please try again.');
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming India +91)
    if (cleaned.length === 10) {
      return '+91' + cleaned;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return '+' + cleaned;
    } else if (cleaned.length === 13 && cleaned.startsWith('+91')) {
      return cleaned;
    }
    
    // Return as is if already in international format
    return phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber;
  }

  private resetRecaptcha(): void {
    if (this.recaptchaVerifier) {
      this.recaptchaVerifier.clear();
      this.recaptchaVerifier = null;
    }
    this.confirmationResult = null;
  }

  // For testing purposes - allows manual verification code input
  async signInWithCredential(verificationId: string, verificationCode: string): Promise<FirebaseUser> {
    try {
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      const result = await signInWithCredential(this.auth, credential);
      return result.user;
    } catch (error) {
      console.error('Error signing in with credential:', error);
      throw error;
    }
  }

  // Check if user is currently authenticated
  isAuthenticated(): boolean {
    return !!this.currentFirebaseUser;
  }

  // Get current user's phone number
  getCurrentPhoneNumber(): string | null {
    return this.currentFirebaseUser?.phoneNumber || null;
  }

  // Get current user's UID
  getCurrentUID(): string | null {
    return this.currentFirebaseUser?.uid || null;
  }
}