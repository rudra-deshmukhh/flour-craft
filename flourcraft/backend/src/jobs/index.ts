import cron from 'node-cron';
import { dispatchOrders } from './orderDispatch';
import { checkInventoryLevels } from './inventoryAlert';
import { cleanupOldData } from './dataCleanup';
import { processSubscriptions } from './subscriptionProcessor';

export const initializeJobs = () => {
  console.log('🔄 Initializing background jobs...');

  // Auto-dispatch orders after grinding completion (every 10 minutes)
  cron.schedule('*/10 * * * *', async () => {
    console.log('⚡ Running order dispatch job...');
    try {
      await dispatchOrders();
    } catch (error) {
      console.error('❌ Order dispatch job failed:', error);
    }
  });

  // Check inventory levels (every 30 minutes)
  cron.schedule('*/30 * * * *', async () => {
    console.log('📦 Running inventory check job...');
    try {
      await checkInventoryLevels();
    } catch (error) {
      console.error('❌ Inventory check job failed:', error);
    }
  });

  // Process subscriptions (daily at 6 AM)
  cron.schedule('0 6 * * *', async () => {
    console.log('🔄 Running subscription processing job...');
    try {
      await processSubscriptions();
    } catch (error) {
      console.error('❌ Subscription processing job failed:', error);
    }
  });

  // Clean up old data (daily at 2 AM)
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Running data cleanup job...');
    try {
      await cleanupOldData();
    } catch (error) {
      console.error('❌ Data cleanup job failed:', error);
    }
  });

  console.log('✅ Background jobs initialized successfully');
};