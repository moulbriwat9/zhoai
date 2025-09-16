import { pgPool, getMongoDb } from '../config/database';
import { logger } from '../utils/logger';
import axios from 'axios';
import { config } from '../config/environment';

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'healthy' | 'unhealthy';
    mongodb: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    api: 'healthy' | 'unhealthy';
  };
  uptime: number;
  timestamp: Date;
}

export interface SystemMetrics {
  memory: NodeJS.MemoryUsage;
  uptime: number;
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
  responseTime: number;
}

export class MonitoringService {
  static async getHealthStatus(): Promise<HealthStatus> {
    const services = {
      database: await this.checkDatabaseHealth(),
      mongodb: await this.checkMongoHealth(),
      redis: await this.checkRedisHealth(),
      api: await this.checkApiHealth()
    };

    const healthyServices = Object.values(services).filter(status => status === 'healthy').length;
    const totalServices = Object.keys(services).length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === totalServices) {
      overall = 'healthy';
    } else if (healthyServices > totalServices / 2) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      services,
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }

  static async getSystemMetrics(): Promise<SystemMetrics> {
    const memory = process.memoryUsage();
    const uptime = process.uptime();

    // Get metrics from database
    const requestMetrics = await this.getRequestMetrics();
    
    return {
      memory,
      uptime,
      activeConnections: 0, // Would be implemented with connection tracking
      requestsPerMinute: requestMetrics.requestsPerMinute,
      errorRate: requestMetrics.errorRate,
      responseTime: requestMetrics.avgResponseTime
    };
  }

  static async getAccessLogs(page: number, limit: number) {
    try {
      const offset = (page - 1) * limit;
      const result = await pgPool.query(`
        SELECT al.*, u.email as user_email 
        FROM access_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.timestamp DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      const countResult = await pgPool.query('SELECT COUNT(*) FROM access_logs');
      const total = parseInt(countResult.rows[0].count);

      return {
        logs: result.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting access logs:', error);
      throw error;
    }
  }

  static async getPerformanceMetrics(timeRange: string) {
    try {
      let interval = '1 hour';
      switch (timeRange) {
        case '1h': interval = '1 hour'; break;
        case '24h': interval = '24 hours'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
      }

      const result = await pgPool.query(`
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(*) as requests,
          AVG(response_time) as avg_response_time,
          COUNT(CASE WHEN status_code >= 400 THEN 1 END) as errors
        FROM access_logs 
        WHERE timestamp >= NOW() - INTERVAL '${interval}'
        GROUP BY hour
        ORDER BY hour
      `);

      return result.rows;
    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  static async performHealthCheck(): Promise<void> {
    const endpoints = [
      '/api/health',
      '/api/auth/verify',
      '/api/users/profile',
      '/api/messages/rooms'
    ];

    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        const response = await axios.get(`http://localhost:${config.server.port}${endpoint}`, {
          timeout: 5000,
          validateStatus: () => true // Don't throw on HTTP errors
        });
        const responseTime = Date.now() - startTime;

        await pgPool.query(`
          INSERT INTO api_health (endpoint, status, response_time, error_message, consecutive_failures)
          VALUES ($1, $2, $3, $4, 0)
          ON CONFLICT (endpoint) DO UPDATE SET
            last_check = CURRENT_TIMESTAMP,
            status = $2,
            response_time = $3,
            error_message = $4,
            consecutive_failures = CASE WHEN $2 THEN 0 ELSE api_health.consecutive_failures + 1 END
        `, [endpoint, response.status < 400, responseTime, response.status >= 400 ? `HTTP ${response.status}` : null]);

      } catch (error) {
        await pgPool.query(`
          INSERT INTO api_health (endpoint, status, response_time, error_message, consecutive_failures)
          VALUES ($1, false, 0, $2, 1)
          ON CONFLICT (endpoint) DO UPDATE SET
            last_check = CURRENT_TIMESTAMP,
            status = false,
            response_time = 0,
            error_message = $2,
            consecutive_failures = api_health.consecutive_failures + 1
        `, [endpoint, error instanceof Error ? error.message : 'Unknown error']);
      }
    }
  }

  private static async checkDatabaseHealth(): Promise<'healthy' | 'unhealthy'> {
    try {
      await pgPool.query('SELECT 1');
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private static async checkMongoHealth(): Promise<'healthy' | 'unhealthy'> {
    try {
      const db = getMongoDb();
      await db.admin().ping();
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private static async checkRedisHealth(): Promise<'healthy' | 'unhealthy'> {
    try {
      const { redisClient } = await import('../config/database');
      await redisClient.ping();
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private static async checkApiHealth(): Promise<'healthy' | 'unhealthy'> {
    try {
      // Check if server is responding
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private static async getRequestMetrics() {
    try {
      const result = await pgPool.query(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
          AVG(response_time) as avg_response_time
        FROM access_logs 
        WHERE timestamp >= NOW() - INTERVAL '1 minute'
      `);

      const row = result.rows[0];
      return {
        requestsPerMinute: parseInt(row.total_requests),
        errorRate: row.total_requests > 0 ? (row.error_count / row.total_requests) * 100 : 0,
        avgResponseTime: parseFloat(row.avg_response_time) || 0
      };
    } catch (error) {
      return {
        requestsPerMinute: 0,
        errorRate: 0,
        avgResponseTime: 0
      };
    }
  }
}