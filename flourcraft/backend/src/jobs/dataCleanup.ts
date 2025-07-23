import firestoreService from '../services/firestoreService';

export const cleanupOldData = async () => {
  try {
    console.log('🧹 Starting data cleanup...');

    // Clean up Firestore data (older than 30 days)
    await firestoreService.cleanupOldData(30);

    console.log('✅ Data cleanup completed successfully');
  } catch (error) {
    console.error('❌ Data cleanup job failed:', error);
    throw error;
  }
};