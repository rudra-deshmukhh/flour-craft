const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { getFirestore } = require('firebase-admin/firestore');
const cacheService = require('../services/CacheService');

const prisma = new PrismaClient();
const firestore = getFirestore();

// Middleware for admin authentication
const requireAdmin = require('../middleware/requireAdmin');

// Helper function to execute cached query
const executeCachedQuery = async (type, params, queryFunction, customTTL = null) => {
  try {
    // Try to get from cache first
    const cached = await cacheService.getAnalytics(type, params);
    if (cached) {
      return cached;
    }

    // Execute query
    const result = await queryFunction();
    
    // Cache the result
    await cacheService.cacheAnalytics(type, params, result, customTTL);
    
    return result;
  } catch (error) {
    console.error('Cache/Query error:', error);
    // Fallback to direct query if cache fails
    return await queryFunction();
  }
};

/**
 * @route GET /api/analytics/orders-received
 * @desc Get orders received by day and hour
 * @access Admin
 */
router.get('/orders-received', requireAdmin, async (req, res) => {
  try {
    const { 
      period = 'day', // 'day', 'hour'
      days = 30,
      startDate,
      endDate 
    } = req.query;

    const result = await executeCachedQuery(
      'orders_received',
      { period, days, startDate, endDate },
      async () => {
        let dateFilter = {};
        
        if (startDate && endDate) {
          dateFilter = {
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          };
        } else {
          dateFilter = {
            createdAt: {
              gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
            }
          };
        }

        if (period === 'hour') {
          // Orders by hour (last 24 hours)
          const hoursData = await prisma.$queryRaw`
            SELECT 
              EXTRACT(HOUR FROM created_at) as hour,
              COUNT(*) as order_count,
              SUM(final_amount) as total_revenue,
              AVG(final_amount) as avg_order_value
            FROM orders 
            WHERE created_at >= NOW() - INTERVAL '24 HOURS'
            GROUP BY EXTRACT(HOUR FROM created_at)
            ORDER BY hour
          `;

          return {
            period: 'hour',
            data: hoursData.map(row => ({
              hour: parseInt(row.hour),
              orderCount: parseInt(row.order_count),
              totalRevenue: parseFloat(row.total_revenue),
              avgOrderValue: parseFloat(row.avg_order_value)
            }))
          };
        } else {
          // Orders by day
          const daysData = await prisma.$queryRaw`
            SELECT 
              DATE(created_at) as date,
              COUNT(*) as order_count,
              SUM(final_amount) as total_revenue,
              AVG(final_amount) as avg_order_value,
              COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as completed_orders,
              COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_orders
            FROM orders 
            WHERE created_at >= ${dateFilter.createdAt?.gte || new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)}
            ${dateFilter.createdAt?.lte ? `AND created_at <= ${dateFilter.createdAt.lte}` : ''}
            GROUP BY DATE(created_at)
            ORDER BY date DESC
          `;

          return {
            period: 'day',
            data: daysData.map(row => ({
              date: row.date,
              orderCount: parseInt(row.order_count),
              totalRevenue: parseFloat(row.total_revenue),
              avgOrderValue: parseFloat(row.avg_order_value),
              completedOrders: parseInt(row.completed_orders),
              cancelledOrders: parseInt(row.cancelled_orders),
              completionRate: (parseInt(row.completed_orders) / parseInt(row.order_count) * 100).toFixed(2)
            }))
          };
        }
      }
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Orders received analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders analytics'
    });
  }
});

/**
 * @route GET /api/analytics/sales-totals
 * @desc Get comprehensive sales analytics
 * @access Admin
 */
router.get('/sales-totals', requireAdmin, async (req, res) => {
  try {
    const { period = 'month', months = 12 } = req.query;
    
    const result = await executeCachedQuery(
      'sales_totals',
      { period, months },
      async () => {
        // Overall sales summary
        const salesSummary = await prisma.$queryRaw`
          SELECT 
            COUNT(*) as total_orders,
            SUM(CASE WHEN status = 'DELIVERED' THEN final_amount ELSE 0 END) as total_revenue,
            SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_orders,
            AVG(CASE WHEN status = 'DELIVERED' THEN final_amount END) as avg_order_value,
            SUM(discount_amount) as total_discounts,
            COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_orders,
            SUM(CASE WHEN created_at >= CURRENT_DATE AND status = 'DELIVERED' THEN final_amount ELSE 0 END) as today_revenue
          FROM orders
          WHERE created_at >= NOW() - INTERVAL '${months} MONTHS'
        `;

        // Sales by month
        const monthlySales = await prisma.$queryRaw`
          SELECT 
            TO_CHAR(created_at, 'YYYY-MM') as month,
            COUNT(*) as order_count,
            SUM(CASE WHEN status = 'DELIVERED' THEN final_amount ELSE 0 END) as revenue,
            AVG(CASE WHEN status = 'DELIVERED' THEN final_amount END) as avg_order_value,
            SUM(discount_amount) as discounts_given,
            COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as completed_orders,
            COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_orders
          FROM orders 
          WHERE created_at >= NOW() - INTERVAL '${months} MONTHS'
          GROUP BY TO_CHAR(created_at, 'YYYY-MM')
          ORDER BY month DESC
        `;

        // Sales by payment method
        const paymentMethodSales = await prisma.$queryRaw`
          SELECT 
            payment_method,
            COUNT(*) as order_count,
            SUM(CASE WHEN status = 'DELIVERED' THEN final_amount ELSE 0 END) as revenue,
            AVG(CASE WHEN status = 'DELIVERED' THEN final_amount END) as avg_order_value
          FROM orders 
          WHERE created_at >= NOW() - INTERVAL '${months} MONTHS'
          AND status = 'DELIVERED'
          GROUP BY payment_method
          ORDER BY revenue DESC
        `;

        // Sales by category
        const categorySales = await prisma.$queryRaw`
          SELECT 
            p.category,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.total_price) as total_revenue,
            COUNT(DISTINCT o.id) as order_count,
            AVG(oi.price_per_kg) as avg_price_per_kg
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          JOIN products p ON oi.product_id = p.id
          WHERE o.created_at >= NOW() - INTERVAL '${months} MONTHS'
          AND o.status = 'DELIVERED'
          GROUP BY p.category
          ORDER BY total_revenue DESC
        `;

        return {
          summary: salesSummary[0],
          monthlySales: monthlySales.map(row => ({
            month: row.month,
            orderCount: parseInt(row.order_count),
            revenue: parseFloat(row.revenue) || 0,
            avgOrderValue: parseFloat(row.avg_order_value) || 0,
            discountsGiven: parseFloat(row.discounts_given) || 0,
            completedOrders: parseInt(row.completed_orders),
            cancelledOrders: parseInt(row.cancelled_orders),
            completionRate: row.order_count > 0 ? 
              (parseInt(row.completed_orders) / parseInt(row.order_count) * 100).toFixed(2) : 0
          })),
          paymentMethods: paymentMethodSales.map(row => ({
            method: row.payment_method,
            orderCount: parseInt(row.order_count),
            revenue: parseFloat(row.revenue) || 0,
            avgOrderValue: parseFloat(row.avg_order_value) || 0
          })),
          categories: categorySales.map(row => ({
            category: row.category,
            totalQuantity: parseFloat(row.total_quantity),
            totalRevenue: parseFloat(row.total_revenue),
            orderCount: parseInt(row.order_count),
            avgPricePerKg: parseFloat(row.avg_price_per_kg)
          }))
        };
      }
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Sales totals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales analytics'
    });
  }
});

/**
 * @route GET /api/analytics/top-products
 * @desc Get top-selling products analytics
 * @access Admin
 */
router.get('/top-products', requireAdmin, async (req, res) => {
  try {
    const { 
      period = 'month',
      limit = 20,
      sortBy = 'revenue' // 'revenue', 'quantity', 'orders'
    } = req.query;

    const result = await executeCachedQuery(
      'top_products',
      { period, limit, sortBy },
      async () => {
        // Determine date filter based on period
        let dateFilter = '';
        switch (period) {
          case 'week':
            dateFilter = "AND o.created_at >= NOW() - INTERVAL '7 DAYS'";
            break;
          case 'month':
            dateFilter = "AND o.created_at >= NOW() - INTERVAL '30 DAYS'";
            break;
          case 'quarter':
            dateFilter = "AND o.created_at >= NOW() - INTERVAL '90 DAYS'";
            break;
          case 'year':
            dateFilter = "AND o.created_at >= NOW() - INTERVAL '1 YEAR'";
            break;
          default:
            dateFilter = "AND o.created_at >= NOW() - INTERVAL '30 DAYS'";
        }

        // Determine sort order
        let orderBy = '';
        switch (sortBy) {
          case 'quantity':
            orderBy = 'total_quantity DESC';
            break;
          case 'orders':
            orderBy = 'order_count DESC';
            break;
          default:
            orderBy = 'total_revenue DESC';
        }

        const topProducts = await prisma.$queryRaw`
          SELECT 
            p.id,
            p.name,
            p.category,
            p.base_price,
            p.unit,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.total_price) as total_revenue,
            COUNT(DISTINCT o.id) as order_count,
            AVG(oi.price_per_kg) as avg_selling_price,
            MIN(oi.price_per_kg) as min_price,
            MAX(oi.price_per_kg) as max_price,
            SUM(oi.quantity) / COUNT(DISTINCT o.id) as avg_quantity_per_order
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          JOIN products p ON oi.product_id = p.id
          WHERE o.status = 'DELIVERED'
          ${dateFilter}
          GROUP BY p.id, p.name, p.category, p.base_price, p.unit
          ORDER BY ${orderBy}
          LIMIT ${parseInt(limit)}
        `;

        // Get product trends (last 7 days vs previous 7 days)
        const productTrends = await prisma.$queryRaw`
          WITH current_period AS (
            SELECT 
              p.id,
              SUM(oi.quantity) as current_quantity,
              SUM(oi.total_price) as current_revenue,
              COUNT(DISTINCT o.id) as current_orders
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.status = 'DELIVERED'
            AND o.created_at >= NOW() - INTERVAL '7 DAYS'
            GROUP BY p.id
          ),
          previous_period AS (
            SELECT 
              p.id,
              SUM(oi.quantity) as previous_quantity,
              SUM(oi.total_price) as previous_revenue,
              COUNT(DISTINCT o.id) as previous_orders
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.status = 'DELIVERED'
            AND o.created_at >= NOW() - INTERVAL '14 DAYS'
            AND o.created_at < NOW() - INTERVAL '7 DAYS'
            GROUP BY p.id
          )
          SELECT 
            p.id,
            p.name,
            COALESCE(cp.current_quantity, 0) as current_quantity,
            COALESCE(pp.previous_quantity, 0) as previous_quantity,
            COALESCE(cp.current_revenue, 0) as current_revenue,
            COALESCE(pp.previous_revenue, 0) as previous_revenue,
            CASE 
              WHEN pp.previous_quantity > 0 THEN 
                ((cp.current_quantity - pp.previous_quantity) / pp.previous_quantity * 100)
              ELSE 100
            END as quantity_growth_rate,
            CASE 
              WHEN pp.previous_revenue > 0 THEN 
                ((cp.current_revenue - pp.previous_revenue) / pp.previous_revenue * 100)
              ELSE 100
            END as revenue_growth_rate
          FROM products p
          LEFT JOIN current_period cp ON p.id = cp.id
          LEFT JOIN previous_period pp ON p.id = pp.id
          WHERE cp.current_quantity > 0 OR pp.previous_quantity > 0
          ORDER BY cp.current_revenue DESC
          LIMIT 10
        `;

        return {
          period,
          sortBy,
          topProducts: topProducts.map(row => ({
            id: row.id,
            name: row.name,
            category: row.category,
            basePrice: parseFloat(row.base_price),
            unit: row.unit,
            totalQuantity: parseFloat(row.total_quantity),
            totalRevenue: parseFloat(row.total_revenue),
            orderCount: parseInt(row.order_count),
            avgSellingPrice: parseFloat(row.avg_selling_price),
            minPrice: parseFloat(row.min_price),
            maxPrice: parseFloat(row.max_price),
            avgQuantityPerOrder: parseFloat(row.avg_quantity_per_order),
            revenuePercentage: 0 // Will be calculated on frontend
          })),
          trends: productTrends.map(row => ({
            id: row.id,
            name: row.name,
            currentQuantity: parseFloat(row.current_quantity) || 0,
            previousQuantity: parseFloat(row.previous_quantity) || 0,
            currentRevenue: parseFloat(row.current_revenue) || 0,
            previousRevenue: parseFloat(row.previous_revenue) || 0,
            quantityGrowthRate: parseFloat(row.quantity_growth_rate) || 0,
            revenueGrowthRate: parseFloat(row.revenue_growth_rate) || 0
          }))
        };
      }
    );

    // Calculate revenue percentages
    const totalRevenue = result.topProducts.reduce((sum, product) => sum + product.totalRevenue, 0);
    result.topProducts.forEach(product => {
      product.revenuePercentage = totalRevenue > 0 ? 
        (product.totalRevenue / totalRevenue * 100).toFixed(2) : 0;
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top products analytics'
    });
  }
});

/**
 * @route GET /api/analytics/subscription-usage
 * @desc Get subscription usage analytics
 * @access Admin
 */
router.get('/subscription-usage', requireAdmin, async (req, res) => {
  try {
    const { months = 12 } = req.query;
    
    const result = await executeCachedQuery(
      'subscription_usage',
      { months },
      async () => {
        // Subscription overview
        const subscriptionSummary = await prisma.$queryRaw`
          SELECT 
            COUNT(*) as total_subscriptions,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_subscriptions,
            COUNT(CASE WHEN status = 'PAUSED' THEN 1 END) as paused_subscriptions,
            COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_subscriptions,
            AVG(CASE WHEN status = 'ACTIVE' THEN total_amount END) as avg_subscription_value,
            SUM(CASE WHEN status = 'ACTIVE' THEN total_amount ELSE 0 END) as monthly_recurring_revenue
          FROM subscriptions
          WHERE created_at >= NOW() - INTERVAL '${months} MONTHS'
        `;

        // Subscription growth by month
        const subscriptionGrowth = await prisma.$queryRaw`
          SELECT 
            TO_CHAR(created_at, 'YYYY-MM') as month,
            COUNT(*) as new_subscriptions,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_count,
            AVG(total_amount) as avg_value,
            SUM(total_amount) as total_value
          FROM subscriptions
          WHERE created_at >= NOW() - INTERVAL '${months} MONTHS'
          GROUP BY TO_CHAR(created_at, 'YYYY-MM')
          ORDER BY month DESC
        `;

        // Subscription by frequency
        const frequencyAnalysis = await prisma.$queryRaw`
          SELECT 
            frequency,
            COUNT(*) as subscription_count,
            AVG(total_amount) as avg_value,
            SUM(total_amount) as total_value,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_count
          FROM subscriptions
          WHERE created_at >= NOW() - INTERVAL '${months} MONTHS'
          GROUP BY frequency
          ORDER BY subscription_count DESC
        `;

        // Subscription churn analysis
        const churnAnalysis = await prisma.$queryRaw`
          WITH monthly_churn AS (
            SELECT 
              TO_CHAR(updated_at, 'YYYY-MM') as month,
              COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as churned_subscriptions,
              COUNT(*) as total_subscriptions_that_month
            FROM subscriptions
            WHERE updated_at >= NOW() - INTERVAL '${months} MONTHS'
            GROUP BY TO_CHAR(updated_at, 'YYYY-MM')
          )
          SELECT 
            month,
            churned_subscriptions,
            total_subscriptions_that_month,
            CASE 
              WHEN total_subscriptions_that_month > 0 THEN 
                (churned_subscriptions::float / total_subscriptions_that_month * 100)
              ELSE 0
            END as churn_rate
          FROM monthly_churn
          ORDER BY month DESC
        `;

        // Top subscription products
        const topSubscriptionProducts = await prisma.$queryRaw`
          SELECT 
            p.id,
            p.name,
            p.category,
            COUNT(si.id) as subscription_count,
            AVG(si.quantity) as avg_quantity,
            SUM(si.price_per_kg * si.quantity) as total_revenue
          FROM subscription_items si
          JOIN subscriptions s ON si.subscription_id = s.id
          JOIN products p ON si.product_id = p.id
          WHERE s.created_at >= NOW() - INTERVAL '${months} MONTHS'
          AND s.status = 'ACTIVE'
          GROUP BY p.id, p.name, p.category
          ORDER BY subscription_count DESC
          LIMIT 10
        `;

        return {
          summary: subscriptionSummary[0],
          growth: subscriptionGrowth.map(row => ({
            month: row.month,
            newSubscriptions: parseInt(row.new_subscriptions),
            activeCount: parseInt(row.active_count),
            avgValue: parseFloat(row.avg_value) || 0,
            totalValue: parseFloat(row.total_value) || 0
          })),
          frequency: frequencyAnalysis.map(row => ({
            frequency: row.frequency,
            subscriptionCount: parseInt(row.subscription_count),
            avgValue: parseFloat(row.avg_value) || 0,
            totalValue: parseFloat(row.total_value) || 0,
            activeCount: parseInt(row.active_count)
          })),
          churn: churnAnalysis.map(row => ({
            month: row.month,
            churnedSubscriptions: parseInt(row.churned_subscriptions),
            totalSubscriptions: parseInt(row.total_subscriptions_that_month),
            churnRate: parseFloat(row.churn_rate) || 0
          })),
          topProducts: topSubscriptionProducts.map(row => ({
            id: row.id,
            name: row.name,
            category: row.category,
            subscriptionCount: parseInt(row.subscription_count),
            avgQuantity: parseFloat(row.avg_quantity),
            totalRevenue: parseFloat(row.total_revenue)
          }))
        };
      }
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Subscription analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription analytics'
    });
  }
});

/**
 * @route GET /api/analytics/grain-stock
 * @desc Get grain stock levels across all flour mills
 * @access Admin
 */
router.get('/grain-stock', requireAdmin, async (req, res) => {
  try {
    const result = await executeCachedQuery(
      'grain_stock',
      {},
      async () => {
        // Current stock levels by mill
        const stockByMill = await prisma.$queryRaw`
          SELECT 
            fm.id as mill_id,
            fm.name as mill_name,
            fm.address,
            fm.capacity,
            COUNT(mi.id) as product_count,
            SUM(mi.current_stock) as total_stock,
            SUM(mi.current_stock * mi.unit_cost) as total_stock_value,
            AVG(mi.current_stock / mi.max_capacity * 100) as avg_capacity_utilization,
            COUNT(CASE WHEN mi.current_stock <= mi.min_threshold THEN 1 END) as low_stock_products,
            COUNT(CASE WHEN mi.current_stock = 0 THEN 1 END) as out_of_stock_products
          FROM flour_mills fm
          LEFT JOIN mill_inventory mi ON fm.id = mi.mill_id
          WHERE fm.is_active = true
          GROUP BY fm.id, fm.name, fm.address, fm.capacity
          ORDER BY total_stock DESC
        `;

        // Stock levels by product across all mills
        const stockByProduct = await prisma.$queryRaw`
          SELECT 
            p.id as product_id,
            p.name as product_name,
            p.category,
            p.unit,
            SUM(mi.current_stock) as total_stock,
            AVG(mi.current_stock) as avg_stock_per_mill,
            SUM(mi.min_threshold) as total_min_threshold,
            SUM(mi.max_capacity) as total_max_capacity,
            COUNT(mi.id) as mill_count,
            COUNT(CASE WHEN mi.current_stock <= mi.min_threshold THEN 1 END) as mills_with_low_stock,
            COUNT(CASE WHEN mi.current_stock = 0 THEN 1 END) as mills_out_of_stock,
            AVG(mi.unit_cost) as avg_unit_cost,
            SUM(mi.current_stock * mi.unit_cost) as total_value
          FROM products p
          LEFT JOIN mill_inventory mi ON p.id = mi.product_id
          WHERE p.is_active = true
          GROUP BY p.id, p.name, p.category, p.unit
          ORDER BY total_stock DESC
        `;

        // Stock alerts by severity
        const stockAlerts = await prisma.$queryRaw`
          SELECT 
            severity,
            COUNT(*) as alert_count,
            array_agg(DISTINCT fm.name) as affected_mills,
            array_agg(DISTINCT p.name) as affected_products
          FROM stock_alerts sa
          JOIN flour_mills fm ON sa.mill_id = fm.id
          JOIN products p ON sa.product_id = p.id
          WHERE sa.is_resolved = false
          GROUP BY severity
          ORDER BY 
            CASE severity
              WHEN 'CRITICAL' THEN 1
              WHEN 'HIGH' THEN 2
              WHEN 'MEDIUM' THEN 3
              WHEN 'LOW' THEN 4
            END
        `;

        // Stock movement trends (last 30 days)
        const stockMovements = await prisma.$queryRaw`
          SELECT 
            DATE(created_at) as date,
            SUM(CASE WHEN operation_type = 'INBOUND' THEN quantity ELSE 0 END) as stock_added,
            SUM(CASE WHEN operation_type = 'OUTBOUND' THEN quantity ELSE 0 END) as stock_consumed,
            COUNT(CASE WHEN operation_type = 'INBOUND' THEN 1 END) as inbound_transactions,
            COUNT(CASE WHEN operation_type = 'OUTBOUND' THEN 1 END) as outbound_transactions
          FROM stock_movements
          WHERE created_at >= NOW() - INTERVAL '30 DAYS'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `;

        // Expiring stock alerts
        const expiringStock = await prisma.$queryRaw`
          SELECT 
            fm.name as mill_name,
            p.name as product_name,
            mi.batch_number,
            mi.expiry_date,
            mi.current_stock,
            mi.unit_cost,
            (mi.current_stock * mi.unit_cost) as potential_loss,
            EXTRACT(DAYS FROM (mi.expiry_date - NOW())) as days_to_expiry
          FROM mill_inventory mi
          JOIN flour_mills fm ON mi.mill_id = fm.id
          JOIN products p ON mi.product_id = p.id
          WHERE mi.expiry_date IS NOT NULL
          AND mi.expiry_date <= NOW() + INTERVAL '30 DAYS'
          AND mi.current_stock > 0
          ORDER BY mi.expiry_date ASC
        `;

        return {
          stockByMill: stockByMill.map(row => ({
            millId: row.mill_id,
            millName: row.mill_name,
            address: row.address,
            capacity: parseFloat(row.capacity),
            productCount: parseInt(row.product_count),
            totalStock: parseFloat(row.total_stock) || 0,
            totalStockValue: parseFloat(row.total_stock_value) || 0,
            avgCapacityUtilization: parseFloat(row.avg_capacity_utilization) || 0,
            lowStockProducts: parseInt(row.low_stock_products),
            outOfStockProducts: parseInt(row.out_of_stock_products)
          })),
          stockByProduct: stockByProduct.map(row => ({
            productId: row.product_id,
            productName: row.product_name,
            category: row.category,
            unit: row.unit,
            totalStock: parseFloat(row.total_stock) || 0,
            avgStockPerMill: parseFloat(row.avg_stock_per_mill) || 0,
            totalMinThreshold: parseFloat(row.total_min_threshold) || 0,
            totalMaxCapacity: parseFloat(row.total_max_capacity) || 0,
            millCount: parseInt(row.mill_count),
            millsWithLowStock: parseInt(row.mills_with_low_stock),
            millsOutOfStock: parseInt(row.mills_out_of_stock),
            avgUnitCost: parseFloat(row.avg_unit_cost) || 0,
            totalValue: parseFloat(row.total_value) || 0
          })),
          alerts: stockAlerts.map(row => ({
            severity: row.severity,
            alertCount: parseInt(row.alert_count),
            affectedMills: row.affected_mills || [],
            affectedProducts: row.affected_products || []
          })),
          movements: stockMovements.map(row => ({
            date: row.date,
            stockAdded: parseFloat(row.stock_added) || 0,
            stockConsumed: parseFloat(row.stock_consumed) || 0,
            inboundTransactions: parseInt(row.inbound_transactions),
            outboundTransactions: parseInt(row.outbound_transactions),
            netChange: (parseFloat(row.stock_added) || 0) - (parseFloat(row.stock_consumed) || 0)
          })),
          expiringStock: expiringStock.map(row => ({
            millName: row.mill_name,
            productName: row.product_name,
            batchNumber: row.batch_number,
            expiryDate: row.expiry_date,
            currentStock: parseFloat(row.current_stock),
            unitCost: parseFloat(row.unit_cost),
            potentialLoss: parseFloat(row.potential_loss),
            daysToExpiry: parseInt(row.days_to_expiry)
          }))
        };
      }
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Grain stock analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grain stock analytics'
    });
  }
});

/**
 * @route GET /api/analytics/delivery-metrics
 * @desc Get delivery times and delay rates
 * @access Admin
 */
router.get('/delivery-metrics', requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await executeCachedQuery(
      'delivery_metrics',
      { days },
      async () => {
        // Overall delivery metrics
        const deliveryOverview = await prisma.$queryRaw`
          SELECT 
            COUNT(*) as total_deliveries,
            AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/3600) as avg_delivery_time_hours,
            COUNT(CASE WHEN delivered_at <= estimated_delivery_time THEN 1 END) as on_time_deliveries,
            COUNT(CASE WHEN delivered_at > estimated_delivery_time THEN 1 END) as delayed_deliveries,
            AVG(CASE WHEN delivered_at > estimated_delivery_time THEN 
              EXTRACT(EPOCH FROM (delivered_at - estimated_delivery_time))/3600 ELSE 0 END) as avg_delay_hours,
            MAX(EXTRACT(EPOCH FROM (delivered_at - created_at))/3600) as max_delivery_time_hours,
            MIN(EXTRACT(EPOCH FROM (delivered_at - created_at))/3600) as min_delivery_time_hours
          FROM orders
          WHERE status = 'DELIVERED'
          AND delivered_at IS NOT NULL
          AND created_at >= NOW() - INTERVAL '${days} DAYS'
        `;

        // Delivery metrics by partner
        const partnerMetrics = await prisma.$queryRaw`
          SELECT 
            dp.id as partner_id,
            dp.name as partner_name,
            dp.vehicle_type,
            COUNT(o.id) as total_deliveries,
            AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at))/3600) as avg_delivery_time_hours,
            COUNT(CASE WHEN o.delivered_at <= o.estimated_delivery_time THEN 1 END) as on_time_deliveries,
            COUNT(CASE WHEN o.delivered_at > o.estimated_delivery_time THEN 1 END) as delayed_deliveries,
            AVG(CASE WHEN o.delivered_at > o.estimated_delivery_time THEN 
              EXTRACT(EPOCH FROM (o.delivered_at - o.estimated_delivery_time))/3600 ELSE 0 END) as avg_delay_hours,
            AVG(o.final_amount) as avg_order_value,
            SUM(o.final_amount) as total_revenue_delivered
          FROM delivery_partners dp
          LEFT JOIN orders o ON dp.id = o.assigned_partner_id
          WHERE o.status = 'DELIVERED'
          AND o.delivered_at IS NOT NULL
          AND o.created_at >= NOW() - INTERVAL '${days} DAYS'
          GROUP BY dp.id, dp.name, dp.vehicle_type
          HAVING COUNT(o.id) > 0
          ORDER BY on_time_deliveries DESC, avg_delivery_time_hours ASC
        `;

        // Daily delivery performance
        const dailyMetrics = await prisma.$queryRaw`
          SELECT 
            DATE(delivered_at) as delivery_date,
            COUNT(*) as total_deliveries,
            AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/3600) as avg_delivery_time_hours,
            COUNT(CASE WHEN delivered_at <= estimated_delivery_time THEN 1 END) as on_time_deliveries,
            COUNT(CASE WHEN delivered_at > estimated_delivery_time THEN 1 END) as delayed_deliveries,
            AVG(final_amount) as avg_order_value
          FROM orders
          WHERE status = 'DELIVERED'
          AND delivered_at IS NOT NULL
          AND created_at >= NOW() - INTERVAL '${days} DAYS'
          GROUP BY DATE(delivered_at)
          ORDER BY delivery_date DESC
        `;

        // Delivery time distribution
        const timeDistribution = await prisma.$queryRaw`
          SELECT 
            CASE 
              WHEN EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 <= 2 THEN '0-2 hours'
              WHEN EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 <= 4 THEN '2-4 hours'
              WHEN EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 <= 8 THEN '4-8 hours'
              WHEN EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 <= 24 THEN '8-24 hours'
              ELSE '24+ hours'
            END as time_range,
            COUNT(*) as delivery_count,
            COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
          FROM orders
          WHERE status = 'DELIVERED'
          AND delivered_at IS NOT NULL
          AND created_at >= NOW() - INTERVAL '${days} DAYS'
          GROUP BY 
            CASE 
              WHEN EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 <= 2 THEN '0-2 hours'
              WHEN EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 <= 4 THEN '2-4 hours'
              WHEN EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 <= 8 THEN '4-8 hours'
              WHEN EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 <= 24 THEN '8-24 hours'
              ELSE '24+ hours'
            END
          ORDER BY 
            CASE 
              WHEN time_range = '0-2 hours' THEN 1
              WHEN time_range = '2-4 hours' THEN 2
              WHEN time_range = '4-8 hours' THEN 3
              WHEN time_range = '8-24 hours' THEN 4
              ELSE 5
            END
        `;

        return {
          overview: {
            totalDeliveries: parseInt(deliveryOverview[0].total_deliveries),
            avgDeliveryTimeHours: parseFloat(deliveryOverview[0].avg_delivery_time_hours) || 0,
            onTimeDeliveries: parseInt(deliveryOverview[0].on_time_deliveries),
            delayedDeliveries: parseInt(deliveryOverview[0].delayed_deliveries),
            onTimeRate: deliveryOverview[0].total_deliveries > 0 ? 
              (parseInt(deliveryOverview[0].on_time_deliveries) / parseInt(deliveryOverview[0].total_deliveries) * 100).toFixed(2) : 0,
            avgDelayHours: parseFloat(deliveryOverview[0].avg_delay_hours) || 0,
            maxDeliveryTimeHours: parseFloat(deliveryOverview[0].max_delivery_time_hours) || 0,
            minDeliveryTimeHours: parseFloat(deliveryOverview[0].min_delivery_time_hours) || 0
          },
          partnerMetrics: partnerMetrics.map(row => ({
            partnerId: row.partner_id,
            partnerName: row.partner_name,
            vehicleType: row.vehicle_type,
            totalDeliveries: parseInt(row.total_deliveries),
            avgDeliveryTimeHours: parseFloat(row.avg_delivery_time_hours) || 0,
            onTimeDeliveries: parseInt(row.on_time_deliveries),
            delayedDeliveries: parseInt(row.delayed_deliveries),
            onTimeRate: row.total_deliveries > 0 ? 
              (parseInt(row.on_time_deliveries) / parseInt(row.total_deliveries) * 100).toFixed(2) : 0,
            avgDelayHours: parseFloat(row.avg_delay_hours) || 0,
            avgOrderValue: parseFloat(row.avg_order_value) || 0,
            totalRevenueDelivered: parseFloat(row.total_revenue_delivered) || 0
          })),
          dailyMetrics: dailyMetrics.map(row => ({
            date: row.delivery_date,
            totalDeliveries: parseInt(row.total_deliveries),
            avgDeliveryTimeHours: parseFloat(row.avg_delivery_time_hours) || 0,
            onTimeDeliveries: parseInt(row.on_time_deliveries),
            delayedDeliveries: parseInt(row.delayed_deliveries),
            onTimeRate: row.total_deliveries > 0 ? 
              (parseInt(row.on_time_deliveries) / parseInt(row.total_deliveries) * 100).toFixed(2) : 0,
            avgOrderValue: parseFloat(row.avg_order_value) || 0
          })),
          timeDistribution: timeDistribution.map(row => ({
            timeRange: row.time_range,
            deliveryCount: parseInt(row.delivery_count),
            percentage: parseFloat(row.percentage).toFixed(1)
          }))
        };
      }
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Delivery metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery metrics'
    });
  }
});

/**
 * @route GET /api/analytics/real-time-insights
 * @desc Get real-time insights from Firestore (current deliveries, live orders, etc.)
 * @access Admin
 */
router.get('/real-time-insights', requireAdmin, async (req, res) => {
  try {
    // Get real-time data from Firestore
    const realTimeData = {};

    // Current active deliveries
    const deliveryLocationsRef = firestore.collection('delivery_locations');
    const deliverySnapshot = await deliveryLocationsRef.get();
    
    const activeDeliveries = [];
    deliverySnapshot.forEach(doc => {
      const data = doc.data();
      const lastUpdate = new Date(data.timestamp);
      const now = new Date();
      const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);
      
      // Consider active if updated within last 10 minutes
      if (minutesSinceUpdate <= 10) {
        activeDeliveries.push({
          partnerId: doc.id,
          ...data,
          lastUpdateMinutes: Math.round(minutesSinceUpdate)
        });
      }
    });

    // Recent order status updates (last hour)
    const orderUpdatesRef = firestore.collection('order_status_updates');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentUpdatesSnapshot = await orderUpdatesRef
      .where('timestamp', '>=', oneHourAgo.toISOString())
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const recentOrderUpdates = [];
    recentUpdatesSnapshot.forEach(doc => {
      recentOrderUpdates.push({
        orderId: doc.id,
        ...doc.data()
      });
    });

    // Live delivery metrics from PostgreSQL for comparison
    const currentDeliveryStats = await prisma.$queryRaw`
      SELECT 
        COUNT(CASE WHEN status = 'OUT_FOR_DELIVERY' THEN 1 END) as out_for_delivery,
        COUNT(CASE WHEN status = 'DELIVERED' AND DATE(delivered_at) = CURRENT_DATE THEN 1 END) as delivered_today,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as orders_today,
        AVG(CASE WHEN status = 'DELIVERED' AND DATE(delivered_at) = CURRENT_DATE THEN final_amount END) as avg_order_value_today
      FROM orders
    `;

    realTimeData.activeDeliveries = {
      count: activeDeliveries.length,
      deliveries: activeDeliveries
    };

    realTimeData.recentUpdates = {
      count: recentOrderUpdates.length,
      updates: recentOrderUpdates
    };

    realTimeData.currentStats = {
      outForDelivery: parseInt(currentDeliveryStats[0].out_for_delivery) || 0,
      deliveredToday: parseInt(currentDeliveryStats[0].delivered_today) || 0,
      ordersToday: parseInt(currentDeliveryStats[0].orders_today) || 0,
      avgOrderValueToday: parseFloat(currentDeliveryStats[0].avg_order_value_today) || 0
    };

    // System health metrics
    realTimeData.systemHealth = {
      timestamp: new Date().toISOString(),
      activePartners: activeDeliveries.length,
      ordersInProgress: realTimeData.currentStats.outForDelivery,
      avgResponseTime: 150, // This would come from application monitoring
      errorRate: 0.02 // This would come from error tracking
    };

    res.json({
      success: true,
      data: realTimeData,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Real-time insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch real-time insights'
    });
  }
});

/**
 * @route DELETE /api/analytics/cache
 * @desc Clear analytics cache
 * @access Admin
 */
router.delete('/cache', requireAdmin, async (req, res) => {
  try {
    const { type = 'all' } = req.query;

    let clearedCount = 0;
    if (type === 'all') {
      // Clear all analytics cache
      clearedCount = await cacheService.clearAnalyticsCache();
    } else {
      // Clear specific cache type
      clearedCount = await cacheService.clearAnalyticsCache(type);
    }

    res.json({
      success: true,
      message: `Cache cleared for ${type === 'all' ? 'all analytics' : type}`,
      clearedCount
    });

  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache'
    });
  }
});

/**
 * @route GET /api/analytics/health
 * @desc Get analytics system health status
 * @access Admin
 */
router.get('/health', requireAdmin, async (req, res) => {
  try {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {}
    };

    // Check cache health
    try {
      const cacheHealth = await cacheService.healthCheck();
      healthStatus.services.cache = cacheHealth;
      
      if (cacheHealth.status === 'error') {
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      healthStatus.services.cache = {
        status: 'error',
        message: error.message
      };
      healthStatus.status = 'degraded';
    }

    // Check database health
    try {
      await prisma.$queryRaw`SELECT 1 as test`;
      healthStatus.services.database = {
        status: 'healthy',
        message: 'Database connection successful'
      };
    } catch (error) {
      healthStatus.services.database = {
        status: 'error',
        message: 'Database connection failed: ' + error.message
      };
      healthStatus.status = 'error';
    }

    // Check Firestore health
    try {
      const testDoc = firestore.collection('health_check').doc('test');
      await testDoc.set({ timestamp: new Date().toISOString() });
      await testDoc.delete();
      
      healthStatus.services.firestore = {
        status: 'healthy',
        message: 'Firestore connection successful'
      };
    } catch (error) {
      healthStatus.services.firestore = {
        status: 'error',
        message: 'Firestore connection failed: ' + error.message
      };
      healthStatus.status = 'degraded';
    }

    // Get cache statistics
    try {
      const cacheStats = await cacheService.getStats();
      if (cacheStats) {
        healthStatus.services.cache.stats = cacheStats;
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    }

    // Check materialized view freshness
    try {
      const viewStats = await prisma.$queryRaw`
        SELECT 
          schemaname,
          matviewname,
          hasindexes,
          ispopulated
        FROM pg_matviews 
        WHERE schemaname = 'public'
        AND matviewname IN ('daily_order_stats', 'product_performance_stats', 'mill_performance_stats')
      `;
      
      healthStatus.services.materialized_views = {
        status: 'healthy',
        views: viewStats
      };
    } catch (error) {
      healthStatus.services.materialized_views = {
        status: 'error',
        message: 'Failed to check materialized views: ' + error.message
      };
    }

    // Set appropriate HTTP status
    const httpStatus = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 206 : 503;

    res.status(httpStatus).json({
      success: healthStatus.status !== 'error',
      data: healthStatus
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      success: false,
      data: {
        timestamp: new Date().toISOString(),
        status: 'error',
        message: 'Health check failed',
        error: error.message
      }
    });
  }
});

module.exports = router;