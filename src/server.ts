import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { connectDatabases } from './config/database';
import { initializeAuth } from './auth/auth-config';
import { setupRoutes } from './routes';
import { setupSocketHandlers } from './socket/socket-handlers';
import { initializeMonitoring } from './monitoring/health-monitor';
import { securityMiddleware } from './middleware/security';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.cors.allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(securityMiddleware);

// Serve static files in production
if (config.server.environment === 'production') {
  app.use(express.static('dist/client'));
}

async function startServer() {
  try {
    // Connect to databases
    await connectDatabases();
    logger.info('Connected to all databases');

    // Initialize authentication
    initializeAuth(app);
    logger.info('Authentication initialized');

    // Setup routes
    setupRoutes(app);
    logger.info('Routes configured');

    // Setup socket handlers
    setupSocketHandlers(io);
    logger.info('Socket.IO configured');

    // Initialize monitoring
    await initializeMonitoring();
    logger.info('Health monitoring initialized');

    // Start server
    server.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port}`);
      logger.info(`Environment: ${config.server.environment}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

startServer();

export { app, server, io };