import { Router } from 'express';
import passport from 'passport';
import { MonitoringService } from '../services/monitoring-service';
import { logger } from '../utils/logger';

const router = Router();

// Protect monitoring routes (admin only)
router.use(passport.authenticate('jwt', { session: false }));
router.use((req, res, next) => {
  const user = req.user as any;
  if (user.role !== 'host') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
});

// Get system health status
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await MonitoringService.getHealthStatus();
    res.json(healthStatus);
  } catch (error) {
    logger.error('Error getting health status:', error);
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

// Get system metrics
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await MonitoringService.getSystemMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Error getting system metrics:', error);
    res.status(500).json({ error: 'Failed to get system metrics' });
  }
});

// Get access logs
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const logs = await MonitoringService.getAccessLogs(page, limit);
    res.json(logs);
  } catch (error) {
    logger.error('Error getting access logs:', error);
    res.status(500).json({ error: 'Failed to get access logs' });
  }
});

// Get performance metrics
router.get('/performance', async (req, res) => {
  try {
    const timeRange = req.query.range as string || '24h';
    const performance = await MonitoringService.getPerformanceMetrics(timeRange);
    res.json(performance);
  } catch (error) {
    logger.error('Error getting performance metrics:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

// Trigger health check
router.post('/health-check', async (req, res) => {
  try {
    await MonitoringService.performHealthCheck();
    res.json({ message: 'Health check completed' });
  } catch (error) {
    logger.error('Error performing health check:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

export { router as monitoringRoutes };