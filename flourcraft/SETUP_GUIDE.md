# 🚀 FlourCraft Quick Setup Guide

Get FlourCraft up and running in under 10 minutes!

## ⚡ Quick Start (Automated)

```bash
# Clone the repository
git clone <repository-url>
cd flourcraft

# Run automated setup
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The setup script will:
- ✅ Check prerequisites (Node.js 18+, Docker)
- ✅ Install all dependencies
- ✅ Create environment files
- ✅ Set up PostgreSQL database
- ✅ Run migrations and seed data
- ✅ Create startup scripts

## 🛠️ Manual Setup

### 1. Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Firebase Account
- Google Maps API Key

### 2. Install Dependencies
```bash
npm run install:all
```

### 3. Environment Setup
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials

# Frontend
# Add Firebase config to frontend/src/environments/
```

### 4. Database Setup
```bash
# With Docker
docker-compose up -d db
npm run db:setup

# Manual PostgreSQL
# Set DATABASE_URL in .env
npm run db:setup
```

### 5. Start Development
```bash
# Both frontend and backend
npm run dev

# Or separately
npm run dev:backend    # Port 3000
npm run dev:frontend   # Port 4200
```

## 🐳 Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🔧 Configuration Required

### Firebase Setup
1. Create Firebase project
2. Enable Authentication (Phone)
3. Create Firestore database
4. Enable Cloud Messaging
5. Download service account key
6. Update backend/.env and frontend/src/environments/

### Google Maps Setup
1. Enable Maps JavaScript API
2. Enable Directions API
3. Enable Geocoding API
4. Create API key
5. Update backend/.env

## 📱 Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:4200 | Angular PWA |
| Backend API | http://localhost:3000 | Express.js API |
| Health Check | http://localhost:3000/health | API Health |
| Database Studio | npm run db:studio | Prisma Studio |
| Production Frontend | http://localhost:8080 | Nginx served |

## 🔍 Development Commands

```bash
# Development
npm run dev                 # Start both services
npm run dev:backend         # Backend only
npm run dev:frontend        # Frontend only

# Database
npm run db:setup           # Setup & seed
npm run db:studio          # Open Prisma Studio
npm run db:reset           # Reset database

# Building
npm run build              # Build both
npm run build:backend      # Backend only
npm run build:frontend     # Frontend only

# Testing
npm run test               # Test both
npm run test:backend       # Backend tests
npm run test:frontend      # Frontend tests

# Docker
npm run docker:up          # Start containers
npm run docker:down        # Stop containers
npm run docker:logs        # View logs
npm run docker:build       # Rebuild images
```

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill processes on ports
npx kill-port 3000 4200
```

**Database Connection Error**
```bash
# Restart database
docker-compose restart db
```

**Node Modules Issues**
```bash
# Clean install
npm run clean
npm run install:all
```

**Prisma Client Error**
```bash
cd backend
npx prisma generate
```

### Environment Variables

Ensure these are set in `backend/.env`:
- `DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `GOOGLE_MAPS_API_KEY`
- `JWT_SECRET`

### Firebase Config

Update `frontend/src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  firebase: {
    apiKey: 'your_api_key',
    authDomain: 'your_project.firebaseapp.com',
    projectId: 'your_project_id',
    storageBucket: 'your_project.appspot.com',
    messagingSenderId: 'your_sender_id',
    appId: 'your_app_id'
  }
};
```

## 📚 Next Steps

1. ✅ Complete Firebase setup
2. ✅ Configure Google Maps API
3. ✅ Test OTP authentication
4. ✅ Add products via admin panel
5. ✅ Test order flow
6. ✅ Set up delivery partners
7. ✅ Configure notifications

## 🆘 Getting Help

- 📖 Full documentation: `README.md`
- 🐛 Issues: Create GitHub issue
- 💬 Questions: Check documentation first
- 📧 Support: support@flourcraft.com

---

**Happy coding! 🌾**