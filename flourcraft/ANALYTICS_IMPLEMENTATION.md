# FlourCraft Analytics Implementation

## Overview

This document outlines the comprehensive analytics implementation for the FlourCraft flour mill management system. The analytics system provides real-time insights through PostgreSQL queries, Redis caching, and Firestore integration for live data.

## Architecture

### Core Components

1. **PostgreSQL Database** - Primary data storage with optimized queries
2. **Redis Cache** - High-performance caching layer with intelligent TTL
3. **Firestore** - Real-time data for live delivery tracking and order updates
4. **Materialized Views** - Pre-computed analytics for better performance
5. **Background Jobs** - Automated data processing and cache warming

### Key Features

- **Smart Caching**: Multi-level caching with different TTL strategies
- **Real-time Insights**: Live delivery tracking and order status updates
- **Performance Optimization**: Materialized views and database indexes
- **Scalable Architecture**: Designed for high-volume operations

## API Endpoints

### Base URL: `/api/analytics`

### 1. Orders Received Analytics

```http
GET /api/analytics/orders-received
```

**Parameters:**
- `period` (string): `"day"` or `"hour"` - Default: `"day"`
- `days` (number): Number of days to analyze - Default: `30`
- `startDate` (string): Start date in ISO format (optional)
- `endDate` (string): End date in ISO format (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "day",
    "data": [
      {
        "date": "2024-01-15",
        "orderCount": 25,
        "totalRevenue": 15000.50,
        "avgOrderValue": 600.02,
        "completedOrders": 22,
        "cancelledOrders": 1,
        "completionRate": "88.00"
      }
    ]
  }
}
```

**Cache TTL:** 5 minutes

### 2. Sales Totals Analytics

```http
GET /api/analytics/sales-totals
```

**Parameters:**
- `period` (string): Grouping period - Default: `"month"`
- `months` (number): Number of months to analyze - Default: `12`

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_orders": "1250",
      "total_revenue": "750000.00",
      "completed_orders": "1100",
      "avg_order_value": "600.00",
      "total_discounts": "25000.00",
      "today_orders": "15",
      "today_revenue": "9000.00"
    },
    "monthlySales": [...],
    "paymentMethods": [...],
    "categories": [...]
  }
}
```

**Cache TTL:** 10 minutes

### 3. Top-Selling Products

```http
GET /api/analytics/top-products
```

**Parameters:**
- `period` (string): `"week"`, `"month"`, `"quarter"`, `"year"` - Default: `"month"`
- `limit` (number): Number of products to return - Default: `20`
- `sortBy` (string): `"revenue"`, `"quantity"`, `"orders"` - Default: `"revenue"`

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "sortBy": "revenue",
    "topProducts": [
      {
        "id": "prod_123",
        "name": "Premium Wheat Flour",
        "category": "WHEAT",
        "totalQuantity": 500.5,
        "totalRevenue": 25000.00,
        "orderCount": 45,
        "avgSellingPrice": 49.75,
        "revenuePercentage": "15.50"
      }
    ],
    "trends": [...]
  }
}
```

**Cache TTL:** 15 minutes

### 4. Subscription Usage Analytics

```http
GET /api/analytics/subscription-usage
```

**Parameters:**
- `months` (number): Number of months to analyze - Default: `12`

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_subscriptions": "150",
      "active_subscriptions": "120",
      "monthly_recurring_revenue": "75000.00"
    },
    "growth": [...],
    "frequency": [...],
    "churn": [...],
    "topProducts": [...]
  }
}
```

**Cache TTL:** 30 minutes

### 5. Grain Stock Analytics

```http
GET /api/analytics/grain-stock
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stockByMill": [
      {
        "millId": "mill_123",
        "millName": "Central Mill",
        "totalStock": 1500.75,
        "totalStockValue": 75000.00,
        "avgCapacityUtilization": 85.5,
        "lowStockProducts": 3,
        "outOfStockProducts": 1
      }
    ],
    "stockByProduct": [...],
    "alerts": [...],
    "movements": [...],
    "expiringStock": [...]
  }
}
```

**Cache TTL:** 5 minutes

### 6. Delivery Metrics

```http
GET /api/analytics/delivery-metrics
```

**Parameters:**
- `days` (number): Number of days to analyze - Default: `30`

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalDeliveries": 450,
      "avgDeliveryTimeHours": 4.5,
      "onTimeRate": "85.50",
      "avgDelayHours": 2.3
    },
    "partnerMetrics": [...],
    "dailyMetrics": [...],
    "timeDistribution": [...]
  }
}
```

**Cache TTL:** 10 minutes

### 7. Real-Time Insights

```http
GET /api/analytics/real-time-insights
```

**Response:**
```json
{
  "success": true,
  "data": {
    "activeDeliveries": {
      "count": 15,
      "deliveries": [
        {
          "partnerId": "partner_123",
          "latitude": 12.9716,
          "longitude": 77.5946,
          "lastUpdateMinutes": 2
        }
      ]
    },
    "recentUpdates": {...},
    "currentStats": {...},
    "systemHealth": {...}
  },
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

**Cache TTL:** 1 minute

### 8. Cache Management

```http
DELETE /api/analytics/cache?type=all
```

**Parameters:**
- `type` (string): Cache type to clear or `"all"` - Default: `"all"`

## Database Schema

### Core Tables

#### Stock Movements
```sql
CREATE TABLE stock_movements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    mill_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'TRANSFER')),
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(10,2),
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    batch_number TEXT,
    performed_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Materialized Views

#### Daily Order Statistics
```sql
CREATE MATERIALIZED VIEW daily_order_stats AS
SELECT 
    DATE(created_at) as order_date,
    COUNT(*) as total_orders,
    SUM(final_amount) as total_revenue,
    AVG(final_amount) as avg_order_value,
    COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_orders,
    COUNT(DISTINCT customer_id) as unique_customers,
    SUM(discount_amount) as total_discounts
FROM orders 
WHERE created_at >= CURRENT_DATE - INTERVAL '365 DAYS'
GROUP BY DATE(created_at);
```

#### Product Performance
```sql
CREATE MATERIALIZED VIEW product_performance_stats AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.category,
    DATE_TRUNC('month', o.created_at) as month,
    SUM(oi.quantity) as total_quantity,
    SUM(oi.total_price) as total_revenue,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(DISTINCT o.customer_id) as unique_customers,
    AVG(oi.price_per_kg) as avg_selling_price
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN products p ON oi.product_id = p.id
WHERE o.status = 'DELIVERED'
AND o.created_at >= CURRENT_DATE - INTERVAL '24 MONTHS'
GROUP BY p.id, p.name, p.category, DATE_TRUNC('month', o.created_at);
```

### Stored Procedures

#### Order Analytics Function
```sql
CREATE OR REPLACE FUNCTION get_order_analytics(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 DAYS',
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_group_by TEXT DEFAULT 'day'
)
RETURNS TABLE (
    period_start TIMESTAMP,
    order_count BIGINT,
    total_revenue NUMERIC,
    avg_order_value NUMERIC,
    completed_orders BIGINT,
    cancelled_orders BIGINT,
    completion_rate NUMERIC
);
```

#### Real-time Dashboard Stats
```sql
CREATE OR REPLACE FUNCTION get_realtime_dashboard_stats()
RETURNS TABLE (
    orders_today BIGINT,
    revenue_today NUMERIC,
    orders_in_progress BIGINT,
    deliveries_today BIGINT,
    avg_order_value_today NUMERIC,
    total_customers BIGINT,
    active_subscriptions BIGINT,
    low_stock_alerts BIGINT
);
```

## Caching Strategy

### Redis Cache Implementation

#### Cache Service Features
- **Intelligent Key Generation**: Consistent cache keys with parameter hashing
- **TTL Management**: Different TTL strategies based on data type
- **Pattern-based Operations**: Bulk cache operations and cleanup
- **Health Monitoring**: Cache performance and connectivity monitoring

#### Cache TTL Configuration
```javascript
const TTL = {
  ORDERS_BY_HOUR: 300,     // 5 minutes
  SALES_TOTALS: 600,       // 10 minutes
  TOP_PRODUCTS: 900,       // 15 minutes
  SUBSCRIPTIONS: 1800,     // 30 minutes
  STOCK_LEVELS: 300,       // 5 minutes
  DELIVERY_METRICS: 600,   // 10 minutes
  REALTIME_INSIGHTS: 60    // 1 minute
};
```

#### Cache Key Structure
```
analytics:{type}:{params_hash}
dashboard:{identifier}
session:{session_id}
rate_limit:{identifier}
```

### Cache Warming Strategy

```javascript
// Example cache warming for frequently accessed data
await cacheService.warmCache([
  {
    key: 'analytics:top_products:{"period":"month","limit":20}',
    fetchFunction: () => getTopProducts('month', 20),
    ttl: 900
  },
  {
    key: 'analytics:sales_totals:{"months":12}',
    fetchFunction: () => getSalesTotals(12),
    ttl: 600
  }
]);
```

## Performance Optimizations

### Database Indexes

```sql
-- Analytics-specific indexes
CREATE INDEX idx_orders_created_at_status ON orders(created_at, status);
CREATE INDEX idx_orders_delivered_at ON orders(delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX idx_orders_customer_created ON orders(customer_id, created_at);
CREATE INDEX idx_order_items_product_created ON order_items(product_id, created_at);
CREATE INDEX idx_subscriptions_status_created ON subscriptions(status, created_at);
CREATE INDEX idx_mill_inventory_stock_threshold ON mill_inventory(current_stock, min_threshold);
```

### Query Optimization Techniques

1. **Materialized Views**: Pre-computed aggregations
2. **Partial Indexes**: Indexes with WHERE clauses for filtered data
3. **Composite Indexes**: Multi-column indexes for complex queries
4. **Query Planning**: Using EXPLAIN ANALYZE for optimization

### Caching Strategies

1. **Multi-Level Caching**: Application → Redis → Database
2. **Cache Hierarchy**: Different TTL based on data volatility
3. **Intelligent Invalidation**: Event-driven cache clearing
4. **Background Refresh**: Proactive cache warming

## Real-Time Integration

### Firestore Collections

#### Delivery Locations
```javascript
// Collection: delivery_locations/{partnerId}
{
  latitude: 12.9716,
  longitude: 77.5946,
  timestamp: "2024-01-15T10:30:00Z",
  status: "ON_DELIVERY",
  currentOrderId: "order_123",
  accuracy: 10
}
```

#### Order Status Updates
```javascript
// Collection: order_status_updates/{orderId}
{
  orderId: "order_123",
  status: "OUT_FOR_DELIVERY",
  timestamp: "2024-01-15T10:30:00Z",
  updatedBy: "partner_456",
  location: {
    latitude: 12.9716,
    longitude: 77.5946
  }
}
```

## Monitoring and Health Checks

### Cache Health Monitoring

```javascript
// Cache health check endpoint
GET /api/analytics/health

{
  "cache": {
    "status": "healthy",
    "connected": true,
    "memory": {
      "used": "128MB",
      "peak": "256MB"
    },
    "operations": {
      "ops_per_sec": "150"
    }
  },
  "database": {
    "status": "healthy",
    "connection_count": 10
  }
}
```

### Performance Metrics

1. **Query Performance**: Average response times
2. **Cache Hit Ratio**: Cache effectiveness metrics
3. **Memory Usage**: Redis memory consumption
4. **Database Load**: Connection and query metrics

## Usage Examples

### Frontend Integration

```typescript
// Angular service example
@Injectable()
export class AnalyticsService {
  async getOrdersAnalytics(period: string, days: number) {
    return this.http.get(`/api/analytics/orders-received`, {
      params: { period, days: days.toString() }
    }).toPromise();
  }

  async getSalesAnalytics(months: number = 12) {
    return this.http.get(`/api/analytics/sales-totals`, {
      params: { months: months.toString() }
    }).toPromise();
  }
}
```

### Dashboard Component

```typescript
// Real-time dashboard updates
@Component({...})
export class AdminDashboardComponent {
  ngOnInit() {
    // Initial load
    this.loadAnalytics();
    
    // Auto-refresh every 5 minutes
    interval(300000).subscribe(() => {
      this.loadAnalytics();
    });
    
    // Real-time insights every minute
    interval(60000).subscribe(() => {
      this.loadRealTimeInsights();
    });
  }
}
```

## Deployment Considerations

### Environment Configuration

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/flourcraft

# Firebase Configuration
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
```

### Production Optimizations

1. **Connection Pooling**: Optimize database connections
2. **Redis Clustering**: Scale Redis for high availability
3. **CDN Integration**: Cache static analytics assets
4. **Monitoring**: Implement comprehensive logging and alerting

## Security Considerations

### Authentication & Authorization

```javascript
// Admin-only analytics access
router.use('/analytics', requireAdmin);

// Rate limiting for analytics endpoints
router.use('/analytics', async (req, res, next) => {
  const isLimited = await cacheService.isRateLimited(
    req.user.id, 
    100, // 100 requests
    3600 // per hour
  );
  
  if (isLimited) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  next();
});
```

### Data Privacy

1. **Data Anonymization**: Remove PII from analytics
2. **Access Controls**: Role-based data access
3. **Audit Logging**: Track analytics access
4. **Data Retention**: Automatic cleanup of old data

## Future Enhancements

### Planned Features

1. **Machine Learning Integration**: Predictive analytics
2. **Advanced Visualization**: Interactive charts and graphs
3. **Export Capabilities**: PDF/Excel report generation
4. **Custom Dashboards**: User-configurable analytics views
5. **Webhook Integration**: Real-time event notifications

### Scalability Roadmap

1. **Microservices Architecture**: Separate analytics service
2. **Data Warehousing**: Dedicated analytics database
3. **Streaming Analytics**: Real-time data processing
4. **AI-Powered Insights**: Automated trend detection

This implementation provides a robust, scalable analytics system capable of handling high-volume operations while maintaining real-time insights and optimal performance.