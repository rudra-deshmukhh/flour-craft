# FlourCraft Deployment Guide

This guide provides step-by-step instructions for deploying the FlourCraft application to production using modern cloud platforms.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │   Database      │
│  (Vercel/       │    │   (Railway/      │    │  (Neon/         │
│   Firebase)     │ ─→ │    Render)       │ ─→ │   Supabase)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         └────────────┬───────────┘                       │
                      │                                   │
              ┌───────▼────────┐                 ┌────────▼────────┐
              │   Firebase     │                 │     Redis       │
              │ (Auth/Store/   │                 │   (Upstash/     │
              │   FCM)         │                 │    Railway)     │
              └────────────────┘                 └─────────────────┘
```

## 📋 Prerequisites

### Required Accounts
- [Firebase Console](https://console.firebase.google.com)
- [Vercel](https://vercel.com) or [Firebase Hosting](https://firebase.google.com/products/hosting)
- [Railway](https://railway.app) or [Render](https://render.com)
- [Neon](https://neon.tech) or [Supabase](https://supabase.com)
- [Google Cloud Console](https://console.cloud.google.com) (for Maps API)

### Required Tools
```bash
# Node.js and npm
node --version  # >= 18.0.0
npm --version   # >= 8.0.0

# Firebase CLI
npm install -g firebase-tools

# Vercel CLI (optional)
npm install -g vercel

# Railway CLI (optional)
curl -fsSL https://railway.app/install.sh | sh
```

## 🔥 Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Project name: `flourcraft-prod`
4. Enable Google Analytics (recommended)

### 2. Enable Required Services

```bash
# Authentication
- Email/Password
- Phone Number (optional)
- Google Sign-in (optional)

# Firestore Database
- Start in production mode
- Choose region (asia-south1 for India)

# Storage
- Default bucket: flourcraft-prod.appspot.com

# Cloud Messaging (FCM)
- Generate web credentials
```

### 3. Configure Authentication

```javascript
// Firebase Console → Authentication → Settings
{
  "authorizedDomains": [
    "your-domain.vercel.app",
    "your-custom-domain.com",
    "localhost" // for development
  ]
}
```

### 4. Set Up Firestore Security Rules

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Or upload via console using firestore.rules file
```

### 5. Generate Admin SDK Key

1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract credentials for environment variables

## 🗄️ Database Setup

### Option A: Neon (Recommended)

1. Visit [Neon Console](https://console.neon.tech)
2. Create new project: `flourcraft-prod`
3. Choose region: `Asia Pacific (Singapore)`
4. Copy connection string
5. Create database: `flourcraft`

```sql
-- Run initial schema
-- (Use the migration files from backend/prisma/migrations/)
```

### Option B: Supabase

1. Visit [Supabase Dashboard](https://app.supabase.com)
2. Create new project: `flourcraft-prod`
3. Choose region: `Southeast Asia (Singapore)`
4. Set strong database password
5. Copy connection details

```bash
# Connection string format
postgresql://postgres:password@db.project-ref.supabase.co:5432/postgres
```

## 🚀 Backend Deployment

### Option A: Railway (Recommended)

#### 1. Prepare Repository
```bash
# Ensure backend is in separate folder or use monorepo structure
cd flourcraft/backend

# Create railway.toml
echo '[build]
command = "npm install && npm run db:generate"

[deploy]
startCommand = "npm start"

[env]
NODE_ENV = "production"' > railway.toml
```

#### 2. Deploy to Railway
```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login and deploy
railway login
railway init
railway up

# Add custom domain (optional)
railway domain add your-api-domain.com
```

#### 3. Configure Environment Variables
```bash
# Set via Railway Dashboard or CLI
railway env set DATABASE_URL="postgresql://..."
railway env set FIREBASE_PROJECT_ID="flourcraft-prod"
railway env set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
railway env set REDIS_URL="redis://default:password@hostname:port"
railway env set GOOGLE_MAPS_API_KEY="AIzaSy..."
railway env set JWT_SECRET="your-super-secret-key"
railway env set CORS_ORIGIN="https://your-frontend-domain.vercel.app"
```

### Option B: Render

#### 1. Connect Repository
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Choose `backend` directory

#### 2. Configure Service
```yaml
# render.yaml
services:
  - type: web
    name: flourcraft-backend
    env: node
    buildCommand: npm install && npm run db:generate
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: flourcraft-db
          property: connectionString
```

#### 3. Add Environment Variables
Use Render Dashboard to add all environment variables from `.env.example`

## 🌐 Frontend Deployment

### Option A: Vercel (Recommended)

#### 1. Prepare Frontend
```bash
cd flourcraft/frontend

# Update environment files
# Copy environment.prod.ts template and fill in real values
```

#### 2. Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add FIREBASE_API_KEY
vercel env add FIREBASE_PROJECT_ID
vercel env add GOOGLE_MAPS_API_KEY

# Deploy production
vercel --prod
```

#### 3. Configure Custom Domain
```bash
# Add custom domain
vercel domains add your-domain.com
vercel alias your-deployment-url.vercel.app your-domain.com
```

### Option B: Firebase Hosting

#### 1. Initialize Firebase Hosting
```bash
cd flourcraft/frontend

# Login to Firebase
firebase login

# Initialize hosting
firebase init hosting

# Select existing project: flourcraft-prod
# Public directory: dist/flourcraft
# Single-page app: Yes
# Overwrite index.html: No
```

#### 2. Build and Deploy
```bash
# Build for production
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Custom domain (via Firebase Console)
# Hosting → Add custom domain → your-domain.com
```

## 🔧 Additional Services Setup

### Redis Cache (Upstash)

1. Visit [Upstash Console](https://console.upstash.com)
2. Create new database: `flourcraft-cache`
3. Choose region closest to your backend
4. Copy connection details

```bash
# Add to backend environment
REDIS_URL=rediss://default:password@hostname:port
```

### Google Maps API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable APIs:
   - Maps JavaScript API
   - Geocoding API
   - Directions API
   - Places API

```bash
# Create API key with restrictions
# Add to both frontend and backend environments
GOOGLE_MAPS_API_KEY=AIzaSy...
```

### Email Service (SendGrid)

1. Create [SendGrid](https://sendgrid.com) account
2. Create API key
3. Verify sender identity

```bash
# Add to backend environment
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### SMS Service (Twilio)

1. Create [Twilio](https://twilio.com) account
2. Get Account SID and Auth Token
3. Buy phone number

```bash
# Add to backend environment
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

## 📊 Monitoring Setup

### Error Tracking (Sentry)

1. Create [Sentry](https://sentry.io) account
2. Create new project: `flourcraft-backend`
3. Get DSN

```bash
# Add to backend environment
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Frontend setup in main.ts
import * as Sentry from "@sentry/angular";
Sentry.init({ dsn: "your-dsn" });
```

### Analytics (Google Analytics)

1. Create GA4 property
2. Get Measurement ID
3. Add to frontend environment

```typescript
// Add to frontend environment
analytics: {
  trackingId: 'G-XXXXXXXXXX'
}
```

## 🔒 Security Configuration

### SSL/HTTPS
- Vercel: Automatic HTTPS
- Railway: Automatic HTTPS  
- Custom domains: Configure DNS records

### CORS Configuration
```bash
# Backend environment
CORS_ORIGIN=https://your-frontend-domain.vercel.app,https://your-custom-domain.com
CORS_CREDENTIALS=true
```

### Security Headers
```javascript
// Already configured in server.js with Helmet
// Additional CSP rules can be added
```

## 🚦 Health Checks & Monitoring

### Backend Health Check
```bash
# Test health endpoint
curl https://your-backend-domain.railway.app/health

# Expected response
{
  "status": "healthy",
  "services": {
    "cache": { "status": "healthy" },
    "firestore": { "status": "healthy" }
  }
}
```

### Frontend Health Check
```bash
# Test frontend
curl https://your-frontend-domain.vercel.app

# Check service worker
# DevTools → Application → Service Workers
```

## 📱 Mobile App Deployment (PWA)

### PWA Configuration
```json
// Already configured in angular.json
"serviceWorker": true,
"ngswConfigPath": "ngsw-config.json"
```

### App Store Deployment (Optional)
```bash
# Generate Android APK using Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
npx cap run android
```

## 🔄 CI/CD Setup

### GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy FlourCraft

on:
  push:
    branches: [ main ]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway deploy --service backend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Deploy to Vercel
        run: |
          npm install -g vercel
          vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

## 🧪 Testing Deployment

### 1. Backend API Tests
```bash
# Test all endpoints
curl https://your-api-domain.railway.app/health
curl https://your-api-domain.railway.app/api/products
curl -H "Authorization: Bearer <token>" https://your-api-domain.railway.app/api/orders
```

### 2. Frontend Tests
```bash
# Test critical flows
- User registration/login
- Product browsing
- Order placement
- Real-time tracking
- Notifications
```

### 3. End-to-End Tests
```bash
# Test complete user journey
1. Register new account
2. Browse products
3. Place order
4. Track order status
5. Receive notifications
```

## 🔧 Troubleshooting

### Common Issues

#### Backend Not Starting
```bash
# Check logs
railway logs --service backend
# or
render logs --service your-service-id

# Common fixes:
- Verify DATABASE_URL format
- Check Firebase credentials
- Ensure all required env vars are set
```

#### Frontend Build Failing
```bash
# Check build logs in Vercel dashboard
# Common fixes:
- Update environment.prod.ts
- Check Firebase config
- Verify API endpoints
```

#### Database Connection Issues
```bash
# Test connection string
psql "postgresql://username:password@hostname:5432/database"

# Common fixes:
- Check IP whitelist
- Verify connection string format
- Ensure database exists
```

### Performance Optimization

#### Backend
```bash
# Enable compression (already configured)
# Use connection pooling (configured in DATABASE_URL)
# Implement caching (Redis configured)
# Monitor with Sentry APM
```

#### Frontend
```bash
# Already optimized:
- Lazy loading modules
- Service worker caching
- Image optimization
- Bundle splitting
```

## 📈 Scaling Considerations

### Database Scaling
- Neon: Automatic scaling
- Supabase: Connection pooling
- Read replicas for analytics

### Backend Scaling
- Railway: Auto-scaling based on traffic
- Render: Horizontal scaling available
- Load balancing with multiple instances

### Frontend Scaling
- Vercel: Global CDN by default
- Firebase: Global CDN with edge caching
- Image optimization automatic

## 🔐 Security Best Practices

### Production Checklist
- [ ] HTTPS enabled on all domains
- [ ] Environment variables secured
- [ ] Database access restricted
- [ ] API rate limiting configured
- [ ] Firebase security rules deployed
- [ ] Regular security updates
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting setup

### Regular Maintenance
- Update dependencies monthly
- Monitor security advisories
- Review access logs
- Update security rules
- Performance monitoring
- Cost optimization review

## 📞 Support & Resources

### Documentation
- [Firebase Documentation](https://firebase.google.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Vercel Documentation](https://vercel.com/docs)
- [Angular Deployment Guide](https://angular.io/guide/deployment)

### Community Support
- [FlourCraft GitHub Discussions](https://github.com/your-repo/discussions)
- [Firebase Community](https://firebase.community)
- [Angular Community](https://community.angular.io)

This deployment guide ensures a production-ready FlourCraft application with proper monitoring, security, and scalability considerations.