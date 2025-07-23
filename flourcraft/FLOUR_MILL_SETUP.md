# FlourCraft Flour Mill Dashboard Setup Guide

## Overview
This guide explains how to set up and use the new Flour Mill Dashboard feature in FlourCraft. The dashboard allows flour mill users to manage orders, track inventory, and handle stock alerts with automated background processing.

## Features Implemented

### 🏭 Flour Mill Dashboard
- **Real-time Order Management**: View and process assigned orders
- **Inventory Tracking**: Monitor stock levels with visual indicators
- **Stock Alerts**: Automated alerts for low stock and critical situations
- **Automated Processing**: Background jobs for order status updates
- **Order Timeline**: Track grinding progress and dispatch scheduling

### 📋 Order Management
- **Start Grinding**: Initiate grinding process for confirmed orders
- **Complete Grinding**: Mark grinding as done with configurable dispatch delay
- **Stock Deduction**: Automatic inventory reduction when grinding starts
- **Status Updates**: Real-time Firestore updates and push notifications

### 📦 Inventory Management
- **Stock Tracking**: Current stock, thresholds, and capacity management
- **Stock Updates**: Add or set inventory levels with batch tracking
- **Visual Indicators**: Progress bars and status colors for stock levels
- **Expiry Tracking**: Monitor product expiry dates and batch numbers

### 🚨 Stock Alerts
- **Automated Alerts**: Background job creates alerts for low stock
- **Severity Levels**: Critical, High, Medium, Low priority alerts
- **Admin Notifications**: Push notifications to admin users
- **Resolution Tracking**: Mark alerts as resolved with notes

### ⚙️ Background Automation
- **Order Processing Queue**: Automatic dispatch after grinding completion
- **Configurable Delays**: Set custom dispatch delays (default 1 hour)
- **Retry Logic**: Failed processing with exponential backoff
- **Stock Monitoring**: Continuous stock level monitoring

## Backend Setup

### 1. Database Schema Updates

New tables added:
- `mill_inventory`: Track stock levels per flour mill and product
- `stock_alerts`: Store and manage stock alerts
- `order_processing_queue`: Handle automated order status updates

### 2. Environment Configuration

Update your `.env` file with these additional configurations:

```env
# Background Jobs Configuration
CRON_ENABLED=true
ORDER_DISPATCH_DELAY_MINUTES=60
STOCK_ALERT_CHECK_INTERVAL=30

# Admin Configuration for alerts
ADMIN_EMAIL="admin@flourcraft.com"
ADMIN_PHONE="+91xxxxxxxxxx"
```

### 3. New API Endpoints

#### Flour Mill Dashboard
- `GET /api/mill/dashboard` - Get dashboard overview
- `GET /api/mill/orders` - Get assigned orders with pagination
- `POST /api/mill/orders/:id/start-grinding` - Start grinding process
- `POST /api/mill/orders/:id/complete-grinding` - Complete grinding

#### Inventory Management
- `GET /api/mill/inventory` - Get inventory with analysis
- `POST /api/mill/inventory/initialize` - Initialize inventory for all products
- `PUT /api/mill/inventory/:productId` - Update stock levels

#### Stock Alerts
- `GET /api/mill/alerts` - Get stock alerts
- `POST /api/mill/alerts/:id/resolve` - Resolve an alert

### 4. Background Jobs

New automated jobs:
- **Order Processing**: Runs every 5 minutes to handle scheduled order updates
- **Stock Alerts**: Monitors inventory levels and creates alerts
- **Admin Notifications**: Sends consolidated alerts to admin users

### 5. Firestore Integration

Real-time updates:
- Order status changes trigger Firestore document updates
- Push notifications sent to customers and admins
- Live dashboard updates for flour mill users

## Frontend Setup

### 1. New Angular Components

#### Main Dashboard Component
```typescript
// flourcraft/frontend/src/app/components/flour-mill-dashboard/
├── flour-mill-dashboard.component.ts
├── flour-mill-dashboard.component.scss
├── stock-update-dialog/
├── order-details-dialog/
└── alert-resolve-dialog/
```

#### FlourMillService
```typescript
// flourcraft/frontend/src/app/services/flour-mill.service.ts
- Complete API integration
- Real-time data management
- Observable-based state management
```

### 2. Material Design Integration

Components used:
- **Mat Tabs**: Main navigation between Orders, Inventory, and Alerts
- **Mat Cards**: Display orders, inventory items, and alerts
- **Mat Progress Bar**: Visual stock level indicators
- **Mat Dialogs**: Stock updates, order details, alert resolution
- **Mat Chips**: Status indicators and badges

### 3. Responsive Design

Features:
- Mobile-first responsive layout
- Touch-friendly interface
- Swipe gestures for mobile navigation
- Optimized for tablet and desktop use

## Usage Guide

### For Flour Mill Users

#### 1. Dashboard Overview
- View key metrics: pending orders, grinding status, completed orders
- Monitor stock alerts and low inventory items
- Quick access to refresh and initialize inventory

#### 2. Order Management
- **View Orders**: See all assigned orders with customer details
- **Filter Orders**: Filter by status (Confirmed, Grinding, Dispatched)
- **Start Grinding**: Click "Start Grinding" for confirmed orders
  - Automatically checks and reserves inventory
  - Updates order status and sends notifications
- **Complete Grinding**: Mark grinding as done
  - Schedules automatic dispatch (default 1 hour)
  - Creates processing queue entry

#### 3. Inventory Management
- **View Stock Levels**: Visual progress bars show stock percentage
- **Update Stock**: Add new stock or set exact levels
- **Batch Tracking**: Record batch numbers and expiry dates
- **Unit Costs**: Track cost per kg for inventory valuation

#### 4. Alert Management
- **View Alerts**: See all active and resolved stock alerts
- **Resolve Alerts**: Mark alerts as resolved with notes
- **Suggested Actions**: Get recommendations for each alert type

### For Admin Users

#### 1. Stock Alert Monitoring
- Receive push notifications for critical stock situations
- View consolidated alerts across all flour mills
- Monitor alert resolution status

#### 2. Order Processing Oversight
- Monitor background job execution
- View failed processing attempts
- Retry failed order updates

## Configuration Options

### 1. Dispatch Delay Settings
Default: 1 hour after grinding completion
- Configurable per order via API
- Can be set from 1 minute to 24 hours

### 2. Stock Thresholds
Per product configuration:
- **Min Threshold**: Trigger low stock alerts
- **Max Capacity**: Prevent overstocking
- **Warning Levels**: Multiple alert severities

### 3. Background Job Schedule
- **Order Processing**: Every 5 minutes
- **Stock Monitoring**: Every 30 minutes (configurable)
- **Alert Consolidation**: Hourly admin notifications

## API Testing

### Test Order Flow
```bash
# Start grinding
curl -X POST http://localhost:3000/api/mill/orders/{orderId}/start-grinding \
  -H "Authorization: Bearer {jwt-token}" \
  -H "Content-Type: application/json"

# Complete grinding with custom delay
curl -X POST http://localhost:3000/api/mill/orders/{orderId}/complete-grinding \
  -H "Authorization: Bearer {jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{"dispatchDelay": 120}'
```

### Test Inventory Updates
```bash
# Add stock
curl -X PUT http://localhost:3000/api/mill/inventory/{productId} \
  -H "Authorization: Bearer {jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 100,
    "operation": "add",
    "batchNumber": "BATCH001",
    "unitCost": 45.50
  }'
```

## Deployment Notes

### 1. Database Migration
```bash
cd flourcraft/backend
npx prisma db push
```

### 2. Environment Variables
Ensure all required environment variables are set in production:
- Database connection
- Firebase credentials
- CRON job settings
- Admin contact information

### 3. Background Jobs
Verify background jobs are running:
- Check server logs for cron job execution
- Monitor order processing queue
- Verify Firestore updates

### 4. Monitoring
Set up monitoring for:
- Failed order processing attempts
- Stock alert frequency
- Database performance
- API response times

## Troubleshooting

### Common Issues

1. **Orders not auto-dispatching**
   - Check background job execution
   - Verify processing queue entries
   - Check Firestore connectivity

2. **Stock alerts not appearing**
   - Verify inventory thresholds
   - Check background job schedule
   - Ensure database updates

3. **Real-time updates not working**
   - Check Firestore configuration
   - Verify FCM tokens
   - Check network connectivity

### Debug Commands
```bash
# Check background jobs status
curl http://localhost:3000/api/admin/jobs/status

# Manually trigger order processing
curl -X POST http://localhost:3000/api/admin/jobs/trigger/order-processing

# View processing queue
curl http://localhost:3000/api/admin/queue/orders
```

## Security Considerations

1. **Role-based Access**: Only FLOUR_MILL_USER role can access mill endpoints
2. **Stock Validation**: Prevents negative stock and capacity violations
3. **Rate Limiting**: Applied to all API endpoints
4. **Input Validation**: All inputs validated and sanitized
5. **Audit Trail**: All stock changes and alert resolutions logged

## Performance Optimization

1. **Database Indexing**: Optimized queries for order and inventory lookup
2. **Background Processing**: Non-blocking order status updates
3. **Real-time Efficiency**: Minimal Firestore document updates
4. **Caching Strategy**: Angular service-level data caching
5. **Lazy Loading**: Components loaded on demand

This completes the comprehensive flour mill dashboard implementation with automated order processing, inventory tracking, and stock alert management.