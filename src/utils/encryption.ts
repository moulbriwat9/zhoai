import crypto from 'crypto';
import { config } from '../config/environment';

export class EncryptionService {
  private static algorithm = config.encryption.algorithm;
  private static keyLength = config.encryption.keyLength;
  private static ivLength = config.encryption.ivLength;

  static generateKey(): string {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  static encrypt(text: string, key: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, Buffer.from(key, 'hex'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = (cipher as any).getAuthTag ? (cipher as any).getAuthTag().toString('hex') : '';
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag
    };
  }

  static decrypt(encryptedData: { encrypted: string; iv: string; tag?: string }, key: string): string {
    const decipher = crypto.createDecipher(this.algorithm, Buffer.from(key, 'hex'));
    
    if (encryptedData.tag) {
      (decipher as any).setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    }
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  static hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(32).toString('hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });
  }

  static verifyPassword(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(':');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(key === derivedKey.toString('hex'));
      });
    });
  }
}