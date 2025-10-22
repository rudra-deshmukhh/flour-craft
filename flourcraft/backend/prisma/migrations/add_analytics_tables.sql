-- Add Stock Movements table for tracking inventory changes
CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    mill_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'TRANSFER')),
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(10,2),
    reference_type TEXT, -- 'ORDER', 'PURCHASE', 'ADJUSTMENT', 'TRANSFER'
    reference_id TEXT,   -- Order ID, Purchase ID, etc.
    notes TEXT,
    batch_number TEXT,
    performed_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (mill_id) REFERENCES flour_mills(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_mill_product ON stock_movements(mill_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_operation_type ON stock_movements(operation_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- Add analytics materialized views for better performance
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_order_stats AS
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
GROUP BY DATE(created_at)
ORDER BY order_date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_order_stats_date ON daily_order_stats(order_date);

-- Product performance materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS product_performance_stats AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.category,
    DATE_TRUNC('month', o.created_at) as month,
    SUM(oi.quantity) as total_quantity,
    SUM(oi.total_price) as total_revenue,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(DISTINCT o.customer_id) as unique_customers,
    AVG(oi.price_per_kg) as avg_selling_price,
    SUM(oi.quantity) / COUNT(DISTINCT o.id) as avg_quantity_per_order
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN products p ON oi.product_id = p.id
WHERE o.status = 'DELIVERED'
AND o.created_at >= CURRENT_DATE - INTERVAL '24 MONTHS'
GROUP BY p.id, p.name, p.category, DATE_TRUNC('month', o.created_at);

CREATE INDEX IF NOT EXISTS idx_product_performance_product_month ON product_performance_stats(product_id, month);
CREATE INDEX IF NOT EXISTS idx_product_performance_month ON product_performance_stats(month);

-- Mill performance materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mill_performance_stats AS
SELECT 
    fm.id as mill_id,
    fm.name as mill_name,
    DATE_TRUNC('month', o.created_at) as month,
    COUNT(o.id) as orders_processed,
    AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at))/3600) as avg_processing_time_hours,
    SUM(o.final_amount) as total_revenue,
    COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END) as cancelled_orders,
    (COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END)::FLOAT / COUNT(o.id) * 100) as completion_rate
FROM orders o
JOIN flour_mills fm ON o.assigned_mill_id = fm.id
WHERE o.created_at >= CURRENT_DATE - INTERVAL '24 MONTHS'
GROUP BY fm.id, fm.name, DATE_TRUNC('month', o.created_at);

CREATE INDEX IF NOT EXISTS idx_mill_performance_mill_month ON mill_performance_stats(mill_id, month);

-- Delivery partner performance materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS partner_performance_stats AS
SELECT 
    dp.id as partner_id,
    dp.name as partner_name,
    dp.vehicle_type,
    DATE_TRUNC('month', o.delivered_at) as month,
    COUNT(o.id) as deliveries_completed,
    AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at))/3600) as avg_delivery_time_hours,
    COUNT(CASE WHEN o.delivered_at <= o.estimated_delivery_time THEN 1 END) as on_time_deliveries,
    COUNT(CASE WHEN o.delivered_at > o.estimated_delivery_time THEN 1 END) as delayed_deliveries,
    SUM(o.final_amount) as total_revenue_delivered,
    AVG(o.final_amount) as avg_order_value
FROM orders o
JOIN delivery_partners dp ON o.assigned_partner_id = dp.id
WHERE o.status = 'DELIVERED'
AND o.delivered_at IS NOT NULL
AND o.delivered_at >= CURRENT_DATE - INTERVAL '24 MONTHS'
GROUP BY dp.id, dp.name, dp.vehicle_type, DATE_TRUNC('month', o.delivered_at);

CREATE INDEX IF NOT EXISTS idx_partner_performance_partner_month ON partner_performance_stats(partner_id, month);

-- Customer analytics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS customer_analytics AS
SELECT 
    u.id as customer_id,
    u.name as customer_name,
    u.email,
    COUNT(o.id) as total_orders,
    SUM(o.final_amount) as total_spent,
    AVG(o.final_amount) as avg_order_value,
    MAX(o.created_at) as last_order_date,
    MIN(o.created_at) as first_order_date,
    COUNT(CASE WHEN o.created_at >= CURRENT_DATE - INTERVAL '30 DAYS' THEN 1 END) as orders_last_30_days,
    COUNT(CASE WHEN o.created_at >= CURRENT_DATE - INTERVAL '90 DAYS' THEN 1 END) as orders_last_90_days,
    CASE 
        WHEN MAX(o.created_at) >= CURRENT_DATE - INTERVAL '30 DAYS' THEN 'ACTIVE'
        WHEN MAX(o.created_at) >= CURRENT_DATE - INTERVAL '90 DAYS' THEN 'INACTIVE'
        ELSE 'CHURNED'
    END as customer_status
FROM users u
LEFT JOIN orders o ON u.id = o.customer_id
WHERE u.role = 'CUSTOMER'
GROUP BY u.id, u.name, u.email;

CREATE INDEX IF NOT EXISTS idx_customer_analytics_status ON customer_analytics(customer_status);
CREATE INDEX IF NOT EXISTS idx_customer_analytics_last_order ON customer_analytics(last_order_date);

-- Revenue analytics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS revenue_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as revenue_date,
    SUM(CASE WHEN status = 'DELIVERED' THEN final_amount ELSE 0 END) as daily_revenue,
    COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as daily_orders,
    AVG(CASE WHEN status = 'DELIVERED' THEN final_amount END) as daily_avg_order_value,
    SUM(discount_amount) as daily_discounts,
    -- Running totals
    SUM(SUM(CASE WHEN status = 'DELIVERED' THEN final_amount ELSE 0 END)) 
        OVER (ORDER BY DATE_TRUNC('day', created_at) ROWS UNBOUNDED PRECEDING) as cumulative_revenue,
    -- Week-over-week growth
    LAG(SUM(CASE WHEN status = 'DELIVERED' THEN final_amount ELSE 0 END), 7) 
        OVER (ORDER BY DATE_TRUNC('day', created_at)) as revenue_7_days_ago
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '365 DAYS'
GROUP BY DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_analytics_date ON revenue_analytics(revenue_date);

-- Subscription analytics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS subscription_analytics AS
SELECT 
    DATE_TRUNC('month', created_at) as subscription_month,
    COUNT(*) as new_subscriptions,
    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_subscriptions,
    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_subscriptions,
    COUNT(CASE WHEN status = 'PAUSED' THEN 1 END) as paused_subscriptions,
    AVG(total_amount) as avg_subscription_value,
    SUM(CASE WHEN status = 'ACTIVE' THEN total_amount ELSE 0 END) as monthly_recurring_revenue,
    -- Calculate churn rate
    LAG(COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)) 
        OVER (ORDER BY DATE_TRUNC('month', created_at)) as prev_month_active,
    COUNT(CASE WHEN status = 'CANCELLED' AND 
        DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', created_at) THEN 1 END) as churned_this_month
FROM subscriptions
WHERE created_at >= CURRENT_DATE - INTERVAL '24 MONTHS'
GROUP BY DATE_TRUNC('month', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_analytics_month ON subscription_analytics(subscription_month);

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_order_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY product_performance_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mill_performance_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY partner_performance_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY customer_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY subscription_analytics;
END;
$$ LANGUAGE plpgsql;

-- Create a stored procedure for order analytics
CREATE OR REPLACE FUNCTION get_order_analytics(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 DAYS',
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_group_by TEXT DEFAULT 'day' -- 'hour', 'day', 'week', 'month'
)
RETURNS TABLE (
    period_start TIMESTAMP,
    order_count BIGINT,
    total_revenue NUMERIC,
    avg_order_value NUMERIC,
    completed_orders BIGINT,
    cancelled_orders BIGINT,
    completion_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN p_group_by = 'hour' THEN DATE_TRUNC('hour', o.created_at)
            WHEN p_group_by = 'day' THEN DATE_TRUNC('day', o.created_at)
            WHEN p_group_by = 'week' THEN DATE_TRUNC('week', o.created_at)
            WHEN p_group_by = 'month' THEN DATE_TRUNC('month', o.created_at)
            ELSE DATE_TRUNC('day', o.created_at)
        END as period_start,
        COUNT(*)::BIGINT as order_count,
        SUM(o.final_amount) as total_revenue,
        AVG(o.final_amount) as avg_order_value,
        COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END)::BIGINT as completed_orders,
        COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END)::BIGINT as cancelled_orders,
        ROUND(COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END)::NUMERIC / COUNT(*) * 100, 2) as completion_rate
    FROM orders o
    WHERE o.created_at >= p_start_date
    AND o.created_at <= p_end_date + INTERVAL '1 DAY'
    GROUP BY 
        CASE 
            WHEN p_group_by = 'hour' THEN DATE_TRUNC('hour', o.created_at)
            WHEN p_group_by = 'day' THEN DATE_TRUNC('day', o.created_at)
            WHEN p_group_by = 'week' THEN DATE_TRUNC('week', o.created_at)
            WHEN p_group_by = 'month' THEN DATE_TRUNC('month', o.created_at)
            ELSE DATE_TRUNC('day', o.created_at)
        END
    ORDER BY period_start;
END;
$$ LANGUAGE plpgsql;

-- Create a function for real-time dashboard stats
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
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(CASE WHEN DATE(o.created_at) = CURRENT_DATE THEN 1 END)::BIGINT as orders_today,
        SUM(CASE WHEN DATE(o.created_at) = CURRENT_DATE AND o.status = 'DELIVERED' THEN o.final_amount ELSE 0 END) as revenue_today,
        COUNT(CASE WHEN o.status IN ('CONFIRMED', 'ASSIGNED_TO_MILL', 'GRINDING', 'GRINDING_DONE', 'OUT_FOR_DELIVERY') THEN 1 END)::BIGINT as orders_in_progress,
        COUNT(CASE WHEN DATE(o.delivered_at) = CURRENT_DATE THEN 1 END)::BIGINT as deliveries_today,
        AVG(CASE WHEN DATE(o.created_at) = CURRENT_DATE AND o.status = 'DELIVERED' THEN o.final_amount END) as avg_order_value_today,
        (SELECT COUNT(DISTINCT customer_id) FROM orders)::BIGINT as total_customers,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'ACTIVE')::BIGINT as active_subscriptions,
        (SELECT COUNT(*) FROM stock_alerts WHERE is_resolved = false)::BIGINT as low_stock_alerts
    FROM orders o;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to automatically update stock movements when inventory changes
CREATE OR REPLACE FUNCTION log_inventory_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log stock changes to stock_movements table
    IF TG_OP = 'UPDATE' AND OLD.current_stock != NEW.current_stock THEN
        INSERT INTO stock_movements (
            mill_id,
            product_id,
            operation_type,
            quantity,
            unit_cost,
            reference_type,
            notes,
            batch_number
        ) VALUES (
            NEW.mill_id,
            NEW.product_id,
            CASE 
                WHEN NEW.current_stock > OLD.current_stock THEN 'INBOUND'
                ELSE 'OUTBOUND'
            END,
            ABS(NEW.current_stock - OLD.current_stock),
            NEW.unit_cost,
            'SYSTEM',
            'Automatic inventory adjustment',
            NEW.batch_number
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for mill inventory changes
DROP TRIGGER IF EXISTS tr_log_inventory_changes ON mill_inventory;
CREATE TRIGGER tr_log_inventory_changes
    AFTER UPDATE ON mill_inventory
    FOR EACH ROW
    EXECUTE FUNCTION log_inventory_changes();

-- Add some helpful indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_created_at_status ON orders(created_at, status);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_product_created ON order_items(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_created ON subscriptions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_mill_inventory_stock_threshold ON mill_inventory(current_stock, min_threshold);

-- Create a daily job to refresh materialized views (this would typically be scheduled via cron)
-- This is just the function - actual scheduling would be done externally
CREATE OR REPLACE FUNCTION daily_analytics_refresh()
RETURNS void AS $$
BEGIN
    -- Refresh materialized views
    PERFORM refresh_analytics_views();
    
    -- Clean up old cache entries if using database-level caching
    -- DELETE FROM cache_table WHERE created_at < NOW() - INTERVAL '1 DAY';
    
    -- Update any computed columns or summary tables
    -- This is where you'd put any daily aggregation logic
    
    RAISE NOTICE 'Daily analytics refresh completed at %', NOW();
END;
$$ LANGUAGE plpgsql;