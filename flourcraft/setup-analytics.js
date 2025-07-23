#!/usr/bin/env node

/**
 * FlourCraft Analytics Setup Script
 * 
 * This script initializes the analytics system by:
 * 1. Running database migrations
 * 2. Creating materialized views
 * 3. Setting up indexes
 * 4. Warming the cache
 * 5. Testing system health
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const cacheService = require('./backend/src/services/CacheService');

const prisma = new PrismaClient();

async function setupAnalytics() {
  console.log('🚀 Starting FlourCraft Analytics Setup...\n');

  try {
    // Step 1: Check database connection
    console.log('1. 📊 Checking database connection...');
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('   ✅ Database connection successful\n');

    // Step 2: Run analytics migrations
    console.log('2. 🔧 Setting up analytics database schema...');
    const migrationPath = path.join(__dirname, 'backend/prisma/migrations/add_analytics_tables.sql');
    
    try {
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');
      
      // Split by statements and execute each one
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        if (statement.toLowerCase().includes('create') || 
            statement.toLowerCase().includes('insert') ||
            statement.toLowerCase().includes('alter')) {
          try {
            await prisma.$executeRawUnsafe(statement + ';');
          } catch (error) {
            // Ignore errors for objects that already exist
            if (!error.message.includes('already exists') && 
                !error.message.includes('already exists')) {
              console.warn(`   ⚠️  Warning: ${error.message}`);
            }
          }
        }
      }
      
      console.log('   ✅ Analytics schema setup complete\n');
    } catch (error) {
      console.log(`   ⚠️  Migration file not found or error: ${error.message}\n`);
    }

    // Step 3: Create and populate materialized views
    console.log('3. 📈 Creating materialized views...');
    
    try {
      // Refresh all materialized views
      await prisma.$executeRaw`SELECT refresh_analytics_views()`;
      console.log('   ✅ Materialized views refreshed\n');
    } catch (error) {
      console.log(`   ⚠️  Materialized views refresh failed: ${error.message}\n`);
    }

    // Step 4: Verify essential indexes
    console.log('4. 🔍 Verifying database indexes...');
    
    const indexChecks = [
      'idx_orders_created_at_status',
      'idx_orders_delivered_at',
      'idx_order_items_product_created',
      'idx_stock_movements_created_at'
    ];

    for (const indexName of indexChecks) {
      try {
        const indexExists = await prisma.$queryRaw`
          SELECT indexname 
          FROM pg_indexes 
          WHERE indexname = ${indexName}
        `;
        
        if (indexExists.length > 0) {
          console.log(`   ✅ Index ${indexName} exists`);
        } else {
          console.log(`   ⚠️  Index ${indexName} missing`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking index ${indexName}: ${error.message}`);
      }
    }
    console.log('');

    // Step 5: Test cache connection
    console.log('5. 🧠 Testing cache connection...');
    
    try {
      const cacheHealth = await cacheService.healthCheck();
      if (cacheHealth.status === 'healthy') {
        console.log('   ✅ Cache connection successful');
        
        // Get cache statistics
        const cacheStats = await cacheService.getStats();
        if (cacheStats) {
          console.log(`   📊 Cache memory used: ${cacheStats.memory.used}`);
          console.log(`   🔗 Connected clients: ${cacheStats.connections.connected_clients}`);
        }
      } else {
        console.log(`   ⚠️  Cache health check failed: ${cacheHealth.message}`);
      }
    } catch (error) {
      console.log(`   ❌ Cache connection failed: ${error.message}`);
    }
    console.log('');

    // Step 6: Warm the cache with essential data
    console.log('6. 🔥 Warming cache with essential analytics data...');
    
    try {
      // Define cache warming functions
      const warmingFunctions = [
        {
          key: 'analytics:sales_totals:{"months":12}',
          fetchFunction: async () => {
            const data = await prisma.$queryRaw`
              SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN status = 'DELIVERED' THEN final_amount ELSE 0 END) as total_revenue,
                AVG(CASE WHEN status = 'DELIVERED' THEN final_amount END) as avg_order_value
              FROM orders
              WHERE created_at >= NOW() - INTERVAL '12 MONTHS'
            `;
            return { summary: data[0] };
          },
          ttl: 600
        },
        {
          key: 'analytics:grain_stock:{}',
          fetchFunction: async () => {
            const data = await prisma.$queryRaw`
              SELECT 
                fm.name as mill_name,
                COUNT(mi.id) as product_count,
                SUM(mi.current_stock) as total_stock
              FROM flour_mills fm
              LEFT JOIN mill_inventory mi ON fm.id = mi.mill_id
              WHERE fm.is_active = true
              GROUP BY fm.id, fm.name
              LIMIT 5
            `;
            return { stockByMill: data };
          },
          ttl: 300
        }
      ];

      await cacheService.warmCache(warmingFunctions);
      console.log('   ✅ Cache warming completed\n');
    } catch (error) {
      console.log(`   ⚠️  Cache warming failed: ${error.message}\n`);
    }

    // Step 7: Create sample data (if needed for development)
    if (process.env.NODE_ENV === 'development') {
      console.log('7. 🎭 Creating sample analytics data (development mode)...');
      
      try {
        // Check if we have any orders
        const orderCount = await prisma.order.count();
        
        if (orderCount === 0) {
          console.log('   📝 No orders found. Consider running data seeding scripts.');
        } else {
          console.log(`   📊 Found ${orderCount} existing orders for analytics`);
        }
      } catch (error) {
        console.log(`   ⚠️  Could not check order count: ${error.message}`);
      }
      console.log('');
    }

    // Step 8: Final health check
    console.log('8. 🏥 Running final system health check...');
    
    try {
      // Test a simple analytics query
      const testQuery = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_orders
        FROM orders
      `;
      
      console.log(`   ✅ Analytics query test successful`);
      console.log(`   📊 Total orders in system: ${testQuery[0].total_orders}`);
      console.log(`   📅 Orders today: ${testQuery[0].today_orders}`);
      
    } catch (error) {
      console.log(`   ❌ Analytics query test failed: ${error.message}`);
    }

    console.log('\n🎉 Analytics setup completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('   1. Start your application server');
    console.log('   2. Visit /api/analytics/health to verify system status');
    console.log('   3. Access analytics endpoints at /api/analytics/*');
    console.log('   4. Consider setting up a cron job to refresh materialized views');
    console.log('\n📖 For full documentation, see ANALYTICS_IMPLEMENTATION.md');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure PostgreSQL is running and accessible');
    console.error('   2. Ensure Redis is running (for caching)');
    console.error('   3. Check your DATABASE_URL environment variable');
    console.error('   4. Verify database user has necessary permissions');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await cacheService.disconnect();
  }
}

// Helper function to create a simple progress bar
function createProgressBar(current, total, label) {
  const percentage = Math.round((current / total) * 100);
  const completed = Math.round((current / total) * 20);
  const remaining = 20 - completed;
  
  const bar = '█'.repeat(completed) + '░'.repeat(remaining);
  return `${label}: [${bar}] ${percentage}%`;
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupAnalytics().catch(console.error);
}

module.exports = { setupAnalytics };