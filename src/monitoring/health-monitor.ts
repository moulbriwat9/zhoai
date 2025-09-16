import cron from 'node-cron';
import { MonitoringService } from '../services/monitoring-service';
import { NotificationService } from '../services/notification-service';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export async function initializeMonitoring() {
  logger.info('Initializing health monitoring...');

  // Health check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await MonitoringService.performHealthCheck();
      const healthStatus = await MonitoringService.getHealthStatus();
      
      // Check for alerts
      if (healthStatus.overall !== 'healthy') {
        await NotificationService.sendAlert({
          type: 'health',
          severity: healthStatus.overall === 'degraded' ? 'warning' : 'critical',
          message: `System health is ${healthStatus.overall}`,
          details: healthStatus.services
        });
      }
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  });

  // System metrics collection every minute
  cron.schedule('* * * * *', async () => {
    try {
      const metrics = await MonitoringService.getSystemMetrics();
      await storeMetrics(metrics);
    } catch (error) {
      logger.error('Metrics collection failed:', error);
    }
  });

  // Daily health report at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      await NotificationService.sendDailyReport();
    } catch (error) {
      logger.error('Daily report failed:', error);
    }
  });

  // Cleanup old logs weekly
  cron.schedule('0 2 * * 0', async () => {
    try {
      await cleanupOldData();
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  });

  logger.info('Health monitoring initialized successfully');
}

async function storeMetrics(metrics: any) {
  try {
    const { getMongoDb } = await import('../config/database');
    const db = getMongoDb();
    
    await db.collection('system_metrics').insertOne({
      ...metrics,
      timestamp: new Date(),
      type: 'system'
    });
  } catch (error) {
    logger.error('Error storing metrics:', error);
  }
}

async function cleanupOldData() {
  try {
    const { pgPool } = await import('../config/database');
    const { getMongoDb } = await import('../config/database');
    
    // Cleanup PostgreSQL logs older than 30 days
    await pgPool.query(`
      DELETE FROM access_logs 
      WHERE timestamp < NOW() - INTERVAL '30 days'
    `);

    // Cleanup MongoDB metrics older than 30 days
    const db = getMongoDb();
    await db.collection('system_metrics').deleteMany({
      timestamp: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    logger.info('Old data cleanup completed');
  } catch (error) {
    logger.error('Cleanup error:', error);
  }
}