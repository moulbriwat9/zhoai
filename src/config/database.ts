import { Pool } from 'pg';
import { MongoClient, Db } from 'mongodb';
import { createClient } from 'redis';
import { config } from './environment';
import { logger } from '../utils/logger';

// PostgreSQL connection
export const pgPool = new Pool({
  host: config.database.postgres.host,
  port: config.database.postgres.port,
  database: config.database.postgres.database,
  user: config.database.postgres.username,
  password: config.database.postgres.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// MongoDB connection
let mongoDb: Db;
const mongoClient = new MongoClient(config.database.mongodb.uri);

// Redis connection
export const redisClient = createClient({
  socket: {
    host: config.database.redis.host,
    port: config.database.redis.port
  },
  password: config.database.redis.password
});

export async function connectDatabases() {
  try {
    // Test PostgreSQL connection
    const pgClient = await pgPool.connect();
    await pgClient.query('SELECT NOW()');
    pgClient.release();
    logger.info('PostgreSQL connected successfully');

    // Initialize PostgreSQL schema
    await initializePostgresSchema();

    // Connect to MongoDB
    await mongoClient.connect();
    mongoDb = mongoClient.db();
    logger.info('MongoDB connected successfully');

    // Initialize MongoDB collections
    await initializeMongoCollections();

    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected successfully');

  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

async function initializePostgresSchema() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT,
      display_name VARCHAR(255),
      avatar_url TEXT,
      role VARCHAR(50) DEFAULT 'guest',
      membership_type VARCHAR(50) DEFAULT 'free',
      oauth_provider VARCHAR(50),
      oauth_id VARCHAR(255),
      is_verified BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP,
      is_active BOOLEAN DEFAULT true
    );
  `;

  const createAccessLogsTable = `
    CREATE TABLE IF NOT EXISTS access_logs (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      ip_address INET,
      user_agent TEXT,
      endpoint VARCHAR(255),
      method VARCHAR(10),
      status_code INTEGER,
      response_time INTEGER,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createApiHealthTable = `
    CREATE TABLE IF NOT EXISTS api_health (
      endpoint VARCHAR(255) PRIMARY KEY,
      last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status BOOLEAN,
      response_time INTEGER,
      error_message TEXT,
      consecutive_failures INTEGER DEFAULT 0
    );
  `;

  const createRateLimitTable = `
    CREATE TABLE IF NOT EXISTS rate_limits (
      id SERIAL PRIMARY KEY,
      ip_address INET,
      endpoint VARCHAR(255),
      requests_count INTEGER DEFAULT 1,
      window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      blocked_until TIMESTAMP
    );
  `;

  try {
    await pgPool.query(createUsersTable);
    await pgPool.query(createAccessLogsTable);
    await pgPool.query(createApiHealthTable);
    await pgPool.query(createRateLimitTable);
    logger.info('PostgreSQL schema initialized');
  } catch (error) {
    logger.error('Failed to initialize PostgreSQL schema:', error);
    throw error;
  }
}

async function initializeMongoCollections() {
  try {
    // Create messages collection with indexes
    const messagesCollection = mongoDb.collection('messages');
    await messagesCollection.createIndex({ chatId: 1, timestamp: -1 });
    await messagesCollection.createIndex({ senderId: 1 });
    await messagesCollection.createIndex({ timestamp: -1 });

    // Create chat rooms collection
    const chatRoomsCollection = mongoDb.collection('chatrooms');
    await chatRoomsCollection.createIndex({ participants: 1 });
    await chatRoomsCollection.createIndex({ createdAt: -1 });

    // Create system metrics collection
    const metricsCollection = mongoDb.collection('system_metrics');
    await metricsCollection.createIndex({ timestamp: -1 });
    await metricsCollection.createIndex({ type: 1, timestamp: -1 });

    logger.info('MongoDB collections initialized');
  } catch (error) {
    logger.error('Failed to initialize MongoDB collections:', error);
    throw error;
  }
}

export function getMongoDb(): Db {
  if (!mongoDb) {
    throw new Error('MongoDB not connected');
  }
  return mongoDb;
}

export { mongoClient };