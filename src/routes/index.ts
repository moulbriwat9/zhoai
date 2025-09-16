import { Application } from 'express';
import { authRoutes } from './auth-routes';
import { userRoutes } from './user-routes';
import { messageRoutes } from './message-routes';
import { monitoringRoutes } from './monitoring-routes';
import { advancedSecurityHeaders } from '../middleware/security';

export function setupRoutes(app: Application) {
  app.use(advancedSecurityHeaders);
  
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/monitoring', monitoringRoutes);
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // Catch-all route for SPA
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'API endpoint not found' });
    } else {
      res.sendFile('index.html', { root: 'dist/client' });
    }
  });
}