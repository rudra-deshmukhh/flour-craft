import cron from 'node-cron';
import { processSubscriptions, getSubscriptionAnalytics } from './subscriptionProcessor';
import { processOrderDispatch } from './orderDispatch';
import { processInventoryAlerts } from './inventoryAlerts';
import { cleanupOldData } from './dataCleanup';
import { startOrderProcessingJob } from './orderProcessingJob';

// Job configurations
const JOB_CONFIGS = {
  SUBSCRIPTION_PROCESSING: {
    schedule: '0 6 * * *', // Every day at 6:00 AM
    timezone: 'Asia/Kolkata',
    enabled: true
  },
  ORDER_DISPATCH: {
    schedule: '*/15 * * * *', // Every 15 minutes
    timezone: 'Asia/Kolkata',
    enabled: true
  },
  INVENTORY_ALERTS: {
    schedule: '0 9,18 * * *', // Twice daily at 9 AM and 6 PM
    timezone: 'Asia/Kolkata',
    enabled: true
  },
  DATA_CLEANUP: {
    schedule: '0 2 * * 0', // Every Sunday at 2:00 AM
    timezone: 'Asia/Kolkata',
    enabled: true
  },
  SUBSCRIPTION_ANALYTICS: {
    schedule: '0 23 * * *', // Every day at 11:00 PM
    timezone: 'Asia/Kolkata',
    enabled: true
  },
  ORDER_PROCESSING: {
    schedule: '*/5 * * * *', // Every 5 minutes
    timezone: 'Asia/Kolkata',
    enabled: true
  }
} as const;

// Job status tracking
interface JobStatus {
  name: string;
  lastRun?: Date;
  lastSuccess?: Date;
  lastError?: Date;
  isRunning: boolean;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
}

const jobStatuses: Map<string, JobStatus> = new Map();

// Initialize job status
function initializeJobStatus(jobName: string): JobStatus {
  const status: JobStatus = {
    name: jobName,
    isRunning: false,
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0
  };
  
  jobStatuses.set(jobName, status);
  return status;
}

// Update job status
function updateJobStatus(jobName: string, success: boolean, error?: Error): void {
  const status = jobStatuses.get(jobName);
  if (!status) return;

  status.lastRun = new Date();
  status.isRunning = false;
  status.totalRuns++;

  if (success) {
    status.lastSuccess = new Date();
    status.successfulRuns++;
  } else {
    status.lastError = new Date();
    status.failedRuns++;
    console.error(`❌ Job ${jobName} failed:`, error);
  }
}

// Generic job wrapper with error handling and status tracking
function createJobWrapper(jobName: string, jobFunction: () => Promise<void>) {
  return async () => {
    const status = jobStatuses.get(jobName) || initializeJobStatus(jobName);
    
    if (status.isRunning) {
      console.log(`⏭️ Job ${jobName} is already running, skipping...`);
      return;
    }

    status.isRunning = true;
    console.log(`🚀 Starting job: ${jobName} at ${new Date().toISOString()}`);

    try {
      await jobFunction();
      updateJobStatus(jobName, true);
      console.log(`✅ Job ${jobName} completed successfully`);
    } catch (error) {
      updateJobStatus(jobName, false, error as Error);
      console.error(`❌ Job ${jobName} failed:`, error);
      
      // Send alert for critical job failures
      await sendJobFailureAlert(jobName, error as Error);
    }
  };
}

// Send job failure alerts
async function sendJobFailureAlert(jobName: string, error: Error): Promise<void> {
  try {
    // Here you would integrate with your notification service
    // For example: Slack, Discord, Email, SMS, etc.
    
    const alertMessage = `
🚨 **FlourCraft Job Failure Alert**

**Job:** ${jobName}
**Time:** ${new Date().toISOString()}
**Error:** ${error.message}
**Stack:** ${error.stack}

Please check the server logs for more details.
    `;

    console.error('JOB FAILURE ALERT:', alertMessage);
    
    // TODO: Implement actual notification service
    // await slackService.sendAlert(alertMessage);
    // await emailService.sendAdminAlert(alertMessage);
  } catch (alertError) {
    console.error('Failed to send job failure alert:', alertError);
  }
}

// Initialize and start all cron jobs
export function initializeJobs(): void {
  console.log('🔧 Initializing cron jobs...');

  // Subscription Processing Job
  if (JOB_CONFIGS.SUBSCRIPTION_PROCESSING.enabled) {
    const subscriptionJob = cron.schedule(
      JOB_CONFIGS.SUBSCRIPTION_PROCESSING.schedule,
      createJobWrapper('SUBSCRIPTION_PROCESSING', processSubscriptions),
      {
        scheduled: false,
        timezone: JOB_CONFIGS.SUBSCRIPTION_PROCESSING.timezone
      }
    );
    
    subscriptionJob.start();
    initializeJobStatus('SUBSCRIPTION_PROCESSING');
    console.log(`📅 Subscription processing job scheduled: ${JOB_CONFIGS.SUBSCRIPTION_PROCESSING.schedule}`);
  }

  // Order Dispatch Job
  if (JOB_CONFIGS.ORDER_DISPATCH.enabled) {
    const orderDispatchJob = cron.schedule(
      JOB_CONFIGS.ORDER_DISPATCH.schedule,
      createJobWrapper('ORDER_DISPATCH', processOrderDispatch),
      {
        scheduled: false,
        timezone: JOB_CONFIGS.ORDER_DISPATCH.timezone
      }
    );
    
    orderDispatchJob.start();
    initializeJobStatus('ORDER_DISPATCH');
    console.log(`📦 Order dispatch job scheduled: ${JOB_CONFIGS.ORDER_DISPATCH.schedule}`);
  }

  // Inventory Alerts Job
  if (JOB_CONFIGS.INVENTORY_ALERTS.enabled) {
    const inventoryJob = cron.schedule(
      JOB_CONFIGS.INVENTORY_ALERTS.schedule,
      createJobWrapper('INVENTORY_ALERTS', processInventoryAlerts),
      {
        scheduled: false,
        timezone: JOB_CONFIGS.INVENTORY_ALERTS.timezone
      }
    );
    
    inventoryJob.start();
    initializeJobStatus('INVENTORY_ALERTS');
    console.log(`📊 Inventory alerts job scheduled: ${JOB_CONFIGS.INVENTORY_ALERTS.schedule}`);
  }

  // Data Cleanup Job
  if (JOB_CONFIGS.DATA_CLEANUP.enabled) {
    const cleanupJob = cron.schedule(
      JOB_CONFIGS.DATA_CLEANUP.schedule,
      createJobWrapper('DATA_CLEANUP', cleanupOldData),
      {
        scheduled: false,
        timezone: JOB_CONFIGS.DATA_CLEANUP.timezone
      }
    );
    
    cleanupJob.start();
    initializeJobStatus('DATA_CLEANUP');
    console.log(`🧹 Data cleanup job scheduled: ${JOB_CONFIGS.DATA_CLEANUP.schedule}`);
  }

  // Subscription Analytics Job
  if (JOB_CONFIGS.SUBSCRIPTION_ANALYTICS.enabled) {
    const analyticsJob = cron.schedule(
      JOB_CONFIGS.SUBSCRIPTION_ANALYTICS.schedule,
      createJobWrapper('SUBSCRIPTION_ANALYTICS', async () => {
        const analytics = await getSubscriptionAnalytics();
        console.log('📈 Subscription Analytics:', analytics);
      }),
      {
        scheduled: false,
        timezone: JOB_CONFIGS.SUBSCRIPTION_ANALYTICS.timezone
      }
    );
    
    analyticsJob.start();
    initializeJobStatus('SUBSCRIPTION_ANALYTICS');
    console.log(`📈 Subscription analytics job scheduled: ${JOB_CONFIGS.SUBSCRIPTION_ANALYTICS.schedule}`);
  }

  // Order Processing Job (Flour Mill Automation)
  if (JOB_CONFIGS.ORDER_PROCESSING.enabled) {
    startOrderProcessingJob();
    initializeJobStatus('ORDER_PROCESSING');
    console.log(`⚙️ Order processing job scheduled: ${JOB_CONFIGS.ORDER_PROCESSING.schedule}`);
  }

  console.log('✅ All cron jobs initialized successfully!');
}

// Manual job triggers for testing/admin purposes
export async function triggerJob(jobName: string): Promise<{ success: boolean; message: string }> {
  try {
    switch (jobName.toUpperCase()) {
      case 'SUBSCRIPTION_PROCESSING':
        await createJobWrapper('SUBSCRIPTION_PROCESSING_MANUAL', processSubscriptions)();
        break;
      case 'ORDER_DISPATCH':
        await createJobWrapper('ORDER_DISPATCH_MANUAL', processOrderDispatch)();
        break;
      case 'INVENTORY_ALERTS':
        await createJobWrapper('INVENTORY_ALERTS_MANUAL', processInventoryAlerts)();
        break;
      case 'DATA_CLEANUP':
        await createJobWrapper('DATA_CLEANUP_MANUAL', cleanupOldData)();
        break;
      case 'SUBSCRIPTION_ANALYTICS':
        const analytics = await getSubscriptionAnalytics();
        console.log('📈 Manual Subscription Analytics:', analytics);
        break;
      default:
        return { success: false, message: `Unknown job: ${jobName}` };
    }

    return { success: true, message: `Job ${jobName} triggered successfully` };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to trigger job ${jobName}: ${(error as Error).message}` 
    };
  }
}

// Get job statuses for monitoring
export function getJobStatuses(): JobStatus[] {
  return Array.from(jobStatuses.values());
}

// Get specific job status
export function getJobStatus(jobName: string): JobStatus | undefined {
  return jobStatuses.get(jobName);
}

// Health check for jobs
export function getJobsHealthCheck(): {
  healthy: boolean;
  totalJobs: number;
  runningJobs: number;
  failedJobs: number;
  lastFailures: Array<{ job: string; error: string; time: Date }>;
} {
  const statuses = Array.from(jobStatuses.values());
  const runningJobs = statuses.filter(s => s.isRunning).length;
  const recentFailures = statuses
    .filter(s => s.lastError && s.lastError > new Date(Date.now() - 24 * 60 * 60 * 1000))
    .map(s => ({
      job: s.name,
      error: 'Recent failure detected',
      time: s.lastError!
    }));

  return {
    healthy: recentFailures.length === 0 && runningJobs < statuses.length,
    totalJobs: statuses.length,
    runningJobs,
    failedJobs: recentFailures.length,
    lastFailures: recentFailures
  };
}

// Graceful shutdown
export function stopAllJobs(): void {
  console.log('🛑 Stopping all cron jobs...');
  cron.getTasks().forEach((task, name) => {
    task.stop();
    console.log(`⏹️ Stopped job: ${name}`);
  });
  console.log('✅ All cron jobs stopped');
}

// Emergency subscription processing (can be called manually)
export async function emergencySubscriptionProcessing(): Promise<void> {
  console.log('🚨 Emergency subscription processing triggered');
  await createJobWrapper('EMERGENCY_SUBSCRIPTION_PROCESSING', processSubscriptions)();
}

// Process overdue subscriptions (subscriptions that should have been processed but weren't)
export async function processOverdueSubscriptions(): Promise<void> {
  console.log('⏰ Processing overdue subscriptions...');
  
  try {
    // This would be similar to processSubscriptions but with a wider date range
    // to catch any subscriptions that might have been missed
    await processSubscriptions();
    console.log('✅ Overdue subscriptions processed');
  } catch (error) {
    console.error('❌ Failed to process overdue subscriptions:', error);
    throw error;
  }
}

// Development helpers
export const devHelpers = {
  async testSubscriptionProcessing() {
    console.log('🧪 Testing subscription processing...');
    await processSubscriptions();
  },
  
  async testAllJobs() {
    console.log('🧪 Testing all jobs...');
    const jobs = ['SUBSCRIPTION_PROCESSING', 'ORDER_DISPATCH', 'INVENTORY_ALERTS'];
    
    for (const job of jobs) {
      try {
        await triggerJob(job);
        console.log(`✅ ${job} test completed`);
      } catch (error) {
        console.error(`❌ ${job} test failed:`, error);
      }
    }
  },
  
  getJobConfigs() {
    return JOB_CONFIGS;
  },
  
  async forceSubscriptionProcessing() {
    console.log('💪 Force processing all active subscriptions...');
    await emergencySubscriptionProcessing();
  }
};

// Export job configurations for reference
export { JOB_CONFIGS };

export default {
  initializeJobs,
  triggerJob,
  getJobStatuses,
  getJobStatus,
  getJobsHealthCheck,
  stopAllJobs,
  emergencySubscriptionProcessing,
  processOverdueSubscriptions,
  devHelpers
};