import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redisClient } from '../config/database';
import { logger } from '../utils/logger';
import { pgPool } from '../config/database';

// Enhanced rate limiter using Redis
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'middleware',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60 * 5, // Block for 5 minutes if limit exceeded
});

export const securityMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  try {
    // Rate limiting
    await rateLimiter.consume(req.ip);
    
    // Log access
    const responseTime = Date.now() - startTime;
    await logAccess(req, res.statusCode, responseTime);
    
    // Input sanitization
    sanitizeInput(req);
    
    next();
  } catch (rateLimiterRes) {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000) || 1
    });
  }
};

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed:', { errors: errors.array(), ip: req.ip });
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

async function logAccess(req: Request, statusCode: number, responseTime: number) {
  try {
    await pgPool.query(`
      INSERT INTO access_logs (user_id, ip_address, user_agent, endpoint, method, status_code, response_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      req.user?.id || null,
      req.ip,
      req.get('User-Agent') || '',
      req.path,
      req.method,
      statusCode,
      responseTime
    ]);
  } catch (error) {
    logger.error('Error logging access:', error);
  }
}

function sanitizeInput(req: Request) {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
}

// Advanced security headers
export const advancedSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
};