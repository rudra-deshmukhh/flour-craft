const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

// Import services and middleware
const cacheService = require('./src/services/CacheService');
const firestoreService = require('./src/services/FirestoreService');
const { handleCors } = require('./src/middleware/firebaseAuth');

// Import routes
const authRoutes = require('./src/routes/auth');
const orderRoutes = require('./src/routes/orders');
const productRoutes = require('./src/routes/products');
const flourMillRoutes = require('./src/routes/flourMill');
const deliveryPartnerRoutes = require('./src/routes/deliveryPartner');
const adminRoutes = require('./src/routes/admin');
const analyticsRoutes = require('./src/routes/analytics');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// ==================== FIREBASE INITIALIZATION ====================

try {
  // Initialize Firebase Admin SDK
  const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    clientId: process.env.FIREBASE_CLIENT_ID,
    authUri: process.env.FIREBASE_AUTH_URI,
    tokenUri: process.env.FIREBASE_TOKEN_URI,
    authProviderX509CertUrl: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    clientX509CertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };

  initializeApp({
    credential: cert(firebaseConfig),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });

  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  process.exit(1);
}

// ==================== TRUST PROXY FOR DEPLOYMENT ====================

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

// ==================== SECURITY MIDDLEWARE ====================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.yourapp.com"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health' || req.path === '/api/health'
});

app.use(limiter);

// ==================== CORS CONFIGURATION ====================

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:4200', 'http://localhost:3000'];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// ==================== GENERAL MIDDLEWARE ====================

// Compression for production
if (process.env.NODE_ENV === 'production') {
  app.use(compression());
}

// Logging
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substr(2, 9);
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// ==================== HEALTH CHECK ENDPOINT ====================

app.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || '1.0.0',
      services: {}
    };

    // Check cache health
    try {
      const cacheHealth = await cacheService.healthCheck();
      healthStatus.services.cache = cacheHealth;
    } catch (error) {
      healthStatus.services.cache = { status: 'error', message: error.message };
      healthStatus.status = 'degraded';
    }

    // Check Firestore health
    try {
      const firestore = getFirestore();
      await firestore.collection('health_check').doc('test').set({ 
        timestamp: new Date().toISOString() 
      });
      await firestore.collection('health_check').doc('test').delete();
      
      healthStatus.services.firestore = { status: 'healthy' };
    } catch (error) {
      healthStatus.services.firestore = { status: 'error', message: error.message };
      healthStatus.status = 'degraded';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'FlourCraft API',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      orders: '/api/orders',
      products: '/api/products',
      flourMill: '/api/flour-mill',
      deliveryPartner: '/api/delivery-partner',
      admin: '/api/admin',
      analytics: '/api/analytics'
    }
  });
});

// ==================== API ROUTES ====================

// Add CORS middleware to all API routes
app.use('/api', handleCors);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/flour-mill', flourMillRoutes);
app.use('/api/delivery-partner', deliveryPartnerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);

// ==================== WEBHOOK ENDPOINTS ====================

// Payment webhook endpoint (without auth middleware)
app.post('/webhook/payment', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-webhook-signature'];
    const expectedSignature = process.env.PAYMENT_WEBHOOK_SECRET;
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(req.body);
    
    // Handle payment events
    switch (event.type) {
      case 'payment.success':
        // Handle successful payment
        console.log('Payment successful:', event.data);
        break;
      case 'payment.failed':
        // Handle failed payment
        console.log('Payment failed:', event.data);
        break;
      default:
        console.log('Unhandled webhook event:', event.type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// ==================== STATIC FILE SERVING ====================

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use('/uploads', express.static('uploads'));
}

// ==================== ERROR HANDLING MIDDLEWARE ====================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Log error details
  const errorDetails = {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    timestamp: new Date().toISOString()
  };

  // Log to external service in production
  if (process.env.NODE_ENV === 'production') {
    // Log to Sentry, LogTail, etc.
    console.error('Production error:', errorDetails);
  }

  // Response time header
  if (req.startTime) {
    res.setHeader('X-Response-Time', `${Date.now() - req.startTime}ms`);
  }

  // Different responses based on environment
  if (process.env.NODE_ENV === 'production') {
    // Production: Don't expose error details
    res.status(error.status || 500).json({
      success: false,
      message: error.status === 404 ? 'Not found' : 'Internal server error',
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  } else {
    // Development: Expose error details
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
      stack: error.stack,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== GRACEFUL SHUTDOWN ====================

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  const server = app.listen(PORT);
  
  // Stop accepting new requests
  server.close(async () => {
    console.log('HTTP server closed');
    
    try {
      // Close cache connection
      await cacheService.disconnect();
      console.log('Cache disconnected');
      
      // Close other connections if needed
      // await prisma.$disconnect();
      
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    console.error('Forced shutdown due to timeout');
    process.exit(1);
  }, parseInt(process.env.SHUTDOWN_TIMEOUT) || 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ==================== START SERVER ====================

const server = app.listen(PORT, () => {
  console.log(`
🚀 FlourCraft API Server Started Successfully!

📊 Server Information:
   • Environment: ${process.env.NODE_ENV}
   • Port: ${PORT}
   • Version: ${process.env.APP_VERSION || '1.0.0'}
   • PID: ${process.pid}

🔗 Endpoints:
   • Health Check: http://localhost:${PORT}/health
   • API Base: http://localhost:${PORT}/api
   • Analytics: http://localhost:${PORT}/api/analytics

🛡️  Security:
   • CORS: ${process.env.CORS_ORIGIN ? 'Configured' : 'Default'}
   • Rate Limiting: ${process.env.RATE_LIMIT_MAX_REQUESTS || 100} requests per ${(process.env.RATE_LIMIT_WINDOW_MS || 900000) / 60000} minutes
   • Helmet: Enabled

🔥 Services:
   • Firebase: Initialized
   • Cache: ${cacheService.isConnected ? 'Connected' : 'Disconnected'}
   • Real-time: Firestore

📚 Documentation:
   • API Docs: /api/docs (if enabled)
   • Health: /health
  `);

  // Initialize background jobs in production
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_BACKGROUND_JOBS === 'true') {
    console.log('🔄 Background jobs enabled');
    // Initialize your background job processors here
  }
});

// Handle server errors
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

module.exports = app;