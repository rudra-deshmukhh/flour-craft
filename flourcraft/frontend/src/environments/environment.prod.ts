export const environment = {
  production: true,
  
  // API Configuration
  apiUrl: 'https://your-backend-domain.railway.app/api',
  websocketUrl: 'wss://your-backend-domain.railway.app',
  
  // Firebase Configuration
  firebase: {
    apiKey: "AIzaSyAbc123DefGhiJklMnoPqrStuVwxYz",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-firebase-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456789",
    measurementId: "G-ABCDEF123456"
  },
  
  // Google Maps Configuration
  googleMaps: {
    apiKey: 'AIzaSyAbc123DefGhiJklMnoPqrStuVwxYz'
  },
  
  // Application Settings
  app: {
    name: 'FlourCraft',
    version: '1.0.0',
    supportEmail: 'support@flourcraft.com',
    supportPhone: '+91-9876543210'
  },
  
  // Feature Flags
  features: {
    enableAnalytics: true,
    enableNotifications: true,
    enableRealTimeTracking: true,
    enableChat: false,
    enableOfflineMode: false,
    enablePWA: true
  },
  
  // Cache Configuration
  cache: {
    defaultTTL: 300000, // 5 minutes
    maxSize: 100,
    enableLocalStorage: true
  },
  
  // Real-time Configuration
  realtime: {
    enableAutoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    reconnectAttempts: 5,
    reconnectDelay: 1000
  },
  
  // Notification Configuration
  notifications: {
    enablePush: true,
    enableInApp: true,
    defaultTimeout: 5000,
    maxNotifications: 10
  },
  
  // Geolocation Settings
  geolocation: {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000,
    defaultZoom: 15
  },
  
  // Upload Configuration
  upload: {
    maxFileSize: 10485760, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    enableCompression: true,
    compressionQuality: 0.8
  },
  
  // Security Settings
  security: {
    enableCSP: true,
    enableXSRFProtection: true,
    tokenRefreshThreshold: 300000 // 5 minutes before expiry
  },
  
  // Payment Configuration
  payment: {
    enableUPI: true,
    enableCards: false,
    enableWallets: true,
    defaultMethod: 'UPI'
  },
  
  // Analytics Configuration
  analytics: {
    enableGA: true,
    trackingId: 'GA_MEASUREMENT_ID',
    enableHotjar: false,
    enableMixpanel: false
  },
  
  // Logging Configuration
  logging: {
    level: 'ERROR',
    enableConsole: false,
    enableRemote: true,
    maxLogSize: 1000
  },
  
  // Performance Configuration
  performance: {
    enableServiceWorker: true,
    enablePreloading: true,
    enableLazyLoading: true,
    chunkSize: 'medium'
  },
  
  // External Services
  services: {
    sentry: {
      dsn: 'https://abc123def456ghi789jkl012mno345pqr@o123456.ingest.sentry.io/7890123',
      environment: 'production',
      enableTracing: true
    },
    
    // Monitoring
    monitoring: {
      enableRUM: true,
      enableErrorTracking: true,
      enablePerformanceMonitoring: true
    }
  },
  
  // Business Configuration
  business: {
    defaultDeliveryRadius: 50, // km
    maxOrderItems: 20,
    minOrderAmount: 100, // INR
    defaultProcessingTime: 120, // minutes
    
    // Delivery Settings
    delivery: {
      baseCharge: 50, // INR
      perKmCharge: 5, // INR
      freeDeliveryThreshold: 500 // INR
    },
    
    // Subscription Settings
    subscription: {
      discountRate: 0.10,
      minFrequency: 7, // days
      maxProducts: 10
    }
  },
  
  // Localization
  i18n: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'hi', 'ta', 'te', 'kn'],
    enableRTL: false,
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    currency: 'INR',
    currencySymbol: '₹'
  },
  
  // Theme Configuration
  theme: {
    defaultTheme: 'light',
    enableDarkMode: true,
    primaryColor: '#2196F3',
    accentColor: '#FF9800',
    enableThemeToggle: true
  },
  
  // PWA Configuration
  pwa: {
    enableOffline: true,
    cacheStrategy: 'cacheFirst',
    updatePrompt: true,
    enableBackgroundSync: true
  }
};