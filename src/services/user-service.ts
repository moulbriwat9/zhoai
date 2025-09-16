import { pgPool } from '../config/database';
import { EncryptionService } from '../utils/encryption';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: 'host' | 'guest';
  membershipType: 'free' | 'pro';
  oauthProvider?: string;
  oauthId?: string;
  isVerified: boolean;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface CreateUserData {
  email: string;
  password?: string;
  displayName?: string;
  avatarUrl?: string;
  oauthProvider?: string;
  oauthId?: string;
}

export class UserService {
  static async findById(id: string): Promise<User | null> {
    try {
      const result = await pgPool.query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await pgPool.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findByOAuth(provider: string, oauthId: string): Promise<User | null> {
    try {
      const result = await pgPool.query(
        'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2 AND is_active = true',
        [provider, oauthId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by OAuth:', error);
      throw error;
    }
  }

  static async createUser(userData: CreateUserData): Promise<User> {
    try {
      let passwordHash = null;
      if (userData.password) {
        passwordHash = await EncryptionService.hashPassword(userData.password);
      }

      const result = await pgPool.query(`
        INSERT INTO users (email, password_hash, display_name, avatar_url, oauth_provider, oauth_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        userData.email,
        passwordHash,
        userData.displayName,
        userData.avatarUrl,
        userData.oauthProvider,
        userData.oauthId
      ]);

      const user = result.rows[0];
      logger.info(`User created: ${user.id}`);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  static async createOAuthUser(userData: CreateUserData): Promise<User> {
    return this.createUser({
      ...userData,
      displayName: userData.displayName || userData.email.split('@')[0]
    });
  }

  static async updateLastLogin(userId: string): Promise<void> {
    try {
      await pgPool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    }
  }

  static async verifyPassword(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.findByEmail(email);
      if (!user || !user.password_hash) {
        return null;
      }

      const isValid = await EncryptionService.verifyPassword(password, user.password_hash);
      return isValid ? user : null;
    } catch (error) {
      logger.error('Error verifying password:', error);
      throw error;
    }
  }

  static async getAllUsers(limit = 50, offset = 0): Promise<{ users: User[], total: number }> {
    try {
      const countResult = await pgPool.query('SELECT COUNT(*) FROM users WHERE is_active = true');
      const total = parseInt(countResult.rows[0].count);

      const result = await pgPool.query(`
        SELECT id, email, display_name, avatar_url, role, membership_type, 
               oauth_provider, is_verified, created_at, last_login
        FROM users 
        WHERE is_active = true 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return { users: result.rows, total };
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }
}