# 🌾 FlourCraft - Swiggy-like Grain Delivery PWA

A full-stack Progressive Web Application for grain delivery service, built with modern technologies for scalability and excellent user experience.

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend**: Angular 17 PWA with Angular Material
- **Backend**: Node.js + Express.js + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Firebase Firestore + FCM
- **Authentication**: Firebase Auth (OTP-based)
- **Deployment**: Docker + Docker Compose
- **Hosting**: Vercel, Railway, Firebase, or Render

### System Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Angular PWA   │───▶│  Node.js API     │───▶│   PostgreSQL    │
│   (Frontend)    │    │   (Backend)      │    │   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌──────────────────┐              │
         └─────────────▶│  Firebase Suite  │◀─────────────┘
                        │ • Auth (OTP)     │
                        │ • Firestore      │
                        │ • FCM Push       │
                        │ • Storage        │
                        └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Firebase Account
- Google Maps API Key

### 1. Clone Repository
```bash
git clone <repository-url>
cd flourcraft
```

### 2. Environment Setup

#### Backend Configuration
```bash
cd backend
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="postgresql://flourcraft:password@localhost:5432/flourcraft_db"
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=your_service_account_email
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

#### Frontend Configuration
```bash
cd frontend
# Add Firebase config in src/environments/
```

### 3. Run with Docker Compose
```bash
# Development environment
docker-compose up -d

# Production environment
docker-compose --profile production up -d
```

### 4. Database Setup
```bash
# Run migrations
docker-compose exec backend npx prisma migrate dev

# Seed database
docker-compose exec backend npm run prisma:seed
```

## 📱 User Roles & Features

### 🛒 Customer Features
- **Authentication**: OTP-based login via Firebase Auth
- **Browse Products**: View grains (wheat, ragi, jowar, rice, bajra, multigrain)
- **Shopping Cart**: Add items with quantity selection
- **Checkout Flow**:
  - One-time orders with delivery slot selection
  - Subscription orders (weekly, bi-weekly, monthly)
- **Address Management**: Add/edit delivery addresses with pincode validation
- **Payment**: UPI deep links (GPay, PhonePe, Paytm)
- **Order Tracking**: Real-time status updates (Received → Grinding → Dispatched → Delivered)
- **Ratings**: Rate delivery experience
- **Notifications**: Order updates, offers, and promotions

### 🏭 Flour Mill User Features
- **Order Management**: Receive and process grinding orders
- **Status Updates**: Mark grinding as started/completed
- **Inventory Tracking**: Monitor grain stock levels
- **Auto-dispatch**: System automatically marks orders as dispatched after configurable delay

### 🚚 Delivery Partner Features
- **Order Assignment**: View grouped orders by locality
- **Route Optimization**: Google Maps integration for efficient delivery routes
- **GPS Tracking**: Real-time location updates during delivery
- **Order Completion**: Mark orders as delivered and trigger rating flow

### 👨‍💼 Admin Features
- **User Management**: Manage customers, flour mills, delivery partners
- **Product Management**: Add/edit grains and pricing
- **Order Oversight**: Monitor all orders and assign delivery partners
- **Analytics Dashboard**:
  - Sales analytics by time/product
  - Order volume tracking
  - Delivery performance metrics
  - User behavior insights
- **Discount Management**: Create and manage promotional campaigns
- **Inventory Monitoring**: Track stock levels across flour mills
- **Pincode Management**: Configure serviceable areas

## 🏠 Local Development

### Backend Development
```bash
cd backend

# Install dependencies
npm install

# Set up database
npx prisma migrate dev
npx prisma generate
npm run prisma:seed

# Start development server
npm run dev
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Start development server
ng serve

# Build for production
npm run build:prod

# Test PWA features
npm run serve:pwa
```

## 📊 Database Schema

### Core Models
- **Users**: Customer, flour mill, delivery partner, admin data
- **Products**: Grain information with pricing
- **Orders**: Order details with items and status tracking
- **Addresses**: Delivery addresses with geolocation
- **Subscriptions**: Recurring order configurations
- **Inventory**: Stock levels per flour mill
- **Delivery Partners**: Vehicle and availability information
- **Ratings**: Delivery feedback system

### Relationships
- Users can have multiple addresses and orders
- Orders contain multiple order items (products)
- Subscriptions generate recurring orders
- Flour mills manage inventory for multiple products
- Delivery partners handle multiple orders in batches

## 🔥 Firebase Integration

### Firestore Collections
```
order_status_updates/{orderId}
├── status: OrderStatus
├── timestamp: string
├── message?: string
└── location?: { lat, lng }

notifications/{userId}
├── title: string
├── body: string
├── type: 'ORDER_UPDATE' | 'OFFER' | 'GENERAL'
├── data?: object
├── read: boolean
└── timestamp: string

delivery_locations/{partnerId}
├── lat: number
├── lng: number
├── timestamp: string
└── orderId?: string

activity_logs/{userId}
├── action: string
├── details: object
├── timestamp: string
├── ipAddress?: string
└── userAgent?: string
```

### Authentication Flow
1. User enters phone number
2. Firebase sends OTP
3. User verifies OTP
4. Backend creates/updates user record
5. JWT token issued for API access

## ⚡ Background Jobs

### Automated Processes
- **Order Dispatch**: Auto-mark orders as dispatched after grinding completion
- **Inventory Alerts**: Notify admins when stock falls below threshold
- **Subscription Processing**: Generate orders for active subscriptions
- **Data Cleanup**: Remove old logs and notifications

### Cron Schedule
```javascript
// Every 10 minutes - Order dispatch
'*/10 * * * *'

// Every 30 minutes - Inventory check
'*/30 * * * *'

// Daily 6 AM - Subscription processing
'0 6 * * *'

// Daily 2 AM - Data cleanup
'0 2 * * *'
```

## 🚀 Deployment

### Environment Variables
Ensure all required environment variables are set:

**Backend**:
- `DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `GOOGLE_MAPS_API_KEY`
- `JWT_SECRET`

**Frontend**:
- Firebase configuration object
- API base URL

### Production Deployment

#### Using Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Using Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy frontend
cd frontend
vercel --prod

# Deploy backend
cd backend
vercel --prod
```

#### Using Render
1. Connect GitHub repository
2. Configure build commands:
   - Backend: `npm install && npm run build`
   - Frontend: `npm install && npm run build:prod`
3. Set environment variables
4. Deploy

### Docker Production
```bash
# Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Deploy to container registry
docker tag flourcraft-backend:latest your-registry/flourcraft-backend:latest
docker push your-registry/flourcraft-backend:latest

docker tag flourcraft-frontend:latest your-registry/flourcraft-frontend:latest
docker push your-registry/flourcraft-frontend:latest
```

## 📈 Performance Optimizations

### Frontend
- **Angular PWA**: Offline capability and app-like experience
- **Lazy Loading**: Route-based code splitting
- **Image Optimization**: WebP format with fallbacks
- **Service Worker**: Caching strategies for better performance
- **Bundle Analysis**: Webpack bundle analyzer for optimization

### Backend
- **Database Indexing**: Optimized queries for analytics
- **Connection Pooling**: Efficient database connections
- **Caching**: Redis for frequently accessed data
- **Compression**: Gzip/Brotli for API responses
- **Rate Limiting**: Prevent API abuse

### Cost Optimization
- **Firestore Reads**: Limit to essential real-time updates only
- **Database Queries**: Use PostgreSQL for heavy reads/analytics
- **Image Storage**: Firebase Storage with CDN
- **Serverless Functions**: For periodic tasks

## 🔐 Security

### Authentication
- Firebase Auth for secure OTP verification
- JWT tokens for API authentication
- Role-based access control (RBAC)

### Data Protection
- Input validation and sanitization
- SQL injection prevention with Prisma
- CORS configuration
- Security headers (HSTS, CSP, etc.)
- Rate limiting and DDoS protection

### Privacy
- GDPR compliance considerations
- User data anonymization
- Secure data deletion
- Activity logging for audit trails

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
npm run test:coverage
```

### Frontend Testing
```bash
cd frontend
ng test
ng e2e
```

### Integration Testing
```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:integration
```

## 📚 API Documentation

### Authentication Endpoints
```
POST /api/auth/register - Register/login user
GET  /api/auth/profile  - Get user profile
PUT  /api/auth/profile  - Update user profile
```

### Product Endpoints
```
GET /api/products       - List products with pagination
GET /api/products/:id   - Get product details
```

### Order Endpoints
```
GET  /api/orders        - Get user orders
POST /api/orders        - Create new order
GET  /api/orders/:id    - Get order details
POST /api/orders/:id/cancel - Cancel order
```

### Admin Endpoints
```
GET /api/admin/users    - List all users
GET /api/admin/orders   - List all orders
GET /api/admin/analytics/* - Various analytics endpoints
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@flourcraft.com
- 📞 Phone: +91-8000-123-456
- 💬 Chat: Available in the app

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Core functionality
- ✅ PWA implementation
- ✅ Real-time tracking
- ✅ Payment integration

### Phase 2 (Upcoming)
- 🔄 AI-powered recommendations
- 🔄 Voice ordering
- 🔄 Loyalty program
- 🔄 Multi-language support

### Phase 3 (Future)
- 📋 B2B marketplace
- 📋 Franchise management
- 📋 Advanced analytics
- 📋 IoT integration

---

<div align="center">
Made with ❤️ for fresh, quality grains delivered to your doorstep
</div>