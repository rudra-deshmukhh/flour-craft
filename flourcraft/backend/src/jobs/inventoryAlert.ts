import { prisma } from '../config/database';
import firestoreService from '../services/firestoreService';

export const checkInventoryLevels = async () => {
  try {
    // Find all inventory items below threshold
    const lowStockItems = await prisma.inventory.findMany({
      where: {
        currentStock: {
          lte: prisma.inventory.fields.threshold
        }
      },
      include: {
        product: true,
        flourMill: {
          include: {
            user: true
          }
        }
      }
    });

    if (lowStockItems.length === 0) {
      console.log('📦 All inventory levels are adequate');
      return;
    }

    console.log(`⚠️ Found ${lowStockItems.length} low stock items`);

    // Get all admin users
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true
      }
    });

    // Create notifications for each low stock item
    for (const item of lowStockItems) {
      const notificationTitle = '⚠️ Low Stock Alert';
      const notificationBody = `${item.product.name} at ${item.flourMill.name} is running low. Current stock: ${item.currentStock}kg (Threshold: ${item.threshold}kg)`;

      // Send notification to all admins
      for (const admin of adminUsers) {
        try {
          await firestoreService.createNotification({
            userId: admin.id,
            title: notificationTitle,
            body: notificationBody,
            type: 'GENERAL',
            data: {
              type: 'LOW_STOCK',
              inventoryId: item.id,
              productId: item.productId,
              flourMillId: item.flourMillId,
              currentStock: item.currentStock,
              threshold: item.threshold
            },
            read: false
          });
        } catch (error) {
          console.error(`❌ Failed to send notification to admin ${admin.id}:`, error);
        }
      }

      console.log(`⚠️ Low stock alert sent for ${item.product.name} at ${item.flourMill.name}`);
    }

    console.log(`✅ Inventory check completed. ${lowStockItems.length} alerts sent.`);
  } catch (error) {
    console.error('❌ Inventory check job failed:', error);
    throw error;
  }
};