#!/bin/bash

# FlourCraft Setup Script
echo "🌾 Setting up FlourCraft - Grain Delivery PWA"
echo "================================================"

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "❌ Node.js version must be 18 or higher. Current version: $(node -v)"
        exit 1
    fi
    echo "✅ Node.js $(node -v) detected"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "⚠️  Docker is not installed. Some features may not work."
        echo "   Install Docker from https://docs.docker.com/get-docker/"
    else
        echo "✅ Docker detected"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo "⚠️  Docker Compose is not installed. Using 'docker compose' instead."
    else
        echo "✅ Docker Compose detected"
    fi
}

# Install dependencies
install_dependencies() {
    echo ""
    echo "📦 Installing dependencies..."
    
    # Root dependencies
    echo "Installing root dependencies..."
    npm install
    
    # Backend dependencies
    echo "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    # Frontend dependencies
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    echo "✅ All dependencies installed"
}

# Setup environment files
setup_environment() {
    echo ""
    echo "⚙️  Setting up environment files..."
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        echo "✅ Created backend/.env from template"
        echo "⚠️  Please update backend/.env with your actual configuration"
    else
        echo "✅ Backend .env already exists"
    fi
    
    # Frontend environment
    mkdir -p frontend/src/environments
    if [ ! -f "frontend/src/environments/environment.ts" ]; then
        cat > frontend/src/environments/environment.ts << 'EOF'
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
EOF
        echo "✅ Created frontend environment template"
        echo "⚠️  Please update frontend/src/environments/environment.ts with your Firebase config"
    else
        echo "✅ Frontend environment already exists"
    fi
}

# Setup database
setup_database() {
    echo ""
    echo "🗄️  Setting up database..."
    
    # Check if Docker is available for database setup
    if command -v docker &> /dev/null; then
        echo "Starting PostgreSQL with Docker..."
        docker-compose up -d db
        
        echo "Waiting for database to be ready..."
        sleep 10
        
        # Run Prisma migrations
        echo "Running database migrations..."
        cd backend
        npx prisma migrate dev --name initial
        
        # Generate Prisma client
        echo "Generating Prisma client..."
        npx prisma generate
        
        # Seed database
        echo "Seeding database with sample data..."
        npm run prisma:seed
        
        cd ..
        echo "✅ Database setup complete"
    else
        echo "⚠️  Docker not available. Please set up PostgreSQL manually and run:"
        echo "   cd backend"
        echo "   npx prisma migrate dev"
        echo "   npm run prisma:seed"
    fi
}

# Setup Firebase (instructions)
setup_firebase() {
    echo ""
    echo "🔥 Firebase Setup Instructions"
    echo "==============================="
    echo "1. Go to https://console.firebase.google.com"
    echo "2. Create a new project or select existing one"
    echo "3. Enable Authentication with Phone Number sign-in"
    echo "4. Create Firestore database"
    echo "5. Enable Cloud Messaging"
    echo "6. Generate service account key"
    echo "7. Update backend/.env with Firebase credentials"
    echo "8. Update frontend/src/environments/ with Firebase config"
    echo ""
    echo "📖 See README.md for detailed Firebase setup instructions"
}

# Setup Google Maps
setup_maps() {
    echo ""
    echo "🗺️  Google Maps Setup Instructions"
    echo "==================================="
    echo "1. Go to https://console.cloud.google.com"
    echo "2. Enable Maps JavaScript API"
    echo "3. Enable Directions API"
    echo "4. Enable Geocoding API"
    echo "5. Create API key and add restrictions"
    echo "6. Update backend/.env with GOOGLE_MAPS_API_KEY"
    echo ""
    echo "📖 See README.md for detailed Google Maps setup instructions"
}

# Create startup scripts
create_scripts() {
    echo ""
    echo "📜 Creating startup scripts..."
    
    # Development script
    cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting FlourCraft in development mode..."
npm run dev
EOF
    chmod +x start-dev.sh
    
    # Docker script
    cat > start-docker.sh << 'EOF'
#!/bin/bash
echo "🐳 Starting FlourCraft with Docker..."
docker-compose up -d
echo "✅ Services started!"
echo "🌐 Frontend: http://localhost:4200"
echo "🔧 Backend: http://localhost:3000"
echo "📊 Database Studio: Run 'npm run db:studio' in backend directory"
EOF
    chmod +x start-docker.sh
    
    echo "✅ Created startup scripts"
}

# Final instructions
show_final_instructions() {
    echo ""
    echo "🎉 FlourCraft setup complete!"
    echo "============================="
    echo ""
    echo "📝 Next steps:"
    echo "1. Update backend/.env with your configuration"
    echo "2. Update frontend/src/environments/ with Firebase config"
    echo "3. Set up Firebase project (see instructions above)"
    echo "4. Set up Google Maps API (see instructions above)"
    echo ""
    echo "🚀 To start development:"
    echo "   npm run dev                 # Start both frontend and backend"
    echo "   ./start-dev.sh              # Alternative script"
    echo ""
    echo "🐳 To start with Docker:"
    echo "   docker-compose up -d        # Start all services"
    echo "   ./start-docker.sh           # Alternative script"
    echo ""
    echo "🌐 URLs:"
    echo "   Frontend: http://localhost:4200"
    echo "   Backend:  http://localhost:3000"
    echo "   Health:   http://localhost:3000/health"
    echo ""
    echo "📚 Documentation:"
    echo "   README.md - Comprehensive guide"
    echo "   backend/README.md - Backend specific docs"
    echo "   frontend/README.md - Frontend specific docs"
    echo ""
    echo "🆘 Need help? Check the documentation or create an issue!"
}

# Main execution
main() {
    check_prerequisites
    install_dependencies
    setup_environment
    setup_database
    setup_firebase
    setup_maps
    create_scripts
    show_final_instructions
}

# Run main function
main