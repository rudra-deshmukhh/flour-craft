export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  FLOUR_MILL_USER = 'FLOUR_MILL_USER',
  DELIVERY_PARTNER = 'DELIVERY_PARTNER',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  firebaseUid: string;
  phoneNumber: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  addresses?: Address[];
  flourMill?: FlourMill;
  deliveryPartner?: DeliveryPartner;
}

export interface Address {
  id: string;
  userId: string;
  title: string;
  addressLine: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FlourMill {
  id: string;
  userId: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryPartner {
  id: string;
  userId: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
  isAvailable: boolean;
  currentLat?: number;
  currentLng?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    isNewUser: boolean;
  };
}

export interface LoginRequest {
  firebaseToken: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
}

export interface PincodeServiceability {
  pincode: string;
  city: string;
  state: string;
  isActive: boolean;
  isServiceable?: boolean;
}

export interface AddressRequest {
  title: string;
  addressLine: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}