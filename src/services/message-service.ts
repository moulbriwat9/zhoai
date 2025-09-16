import { getMongoDb } from '../config/database';
import { EncryptionService } from '../utils/encryption';
import { logger } from '../utils/logger';

export interface Message {
  _id?: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  encryptedContent?: string;
  messageType: 'text' | 'file' | 'image' | 'system';
  timestamp: Date;
  edited?: boolean;
  editedAt?: Date;
  replyTo?: string;
  reactions?: { [emoji: string]: string[] };
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface ChatRoom {
  _id?: string;
  name: string;
  description?: string;
  participants: string[];
  createdBy: string;
  createdAt: Date;
  isPrivate: boolean;
  encryptionKey?: string;
}

export class MessageService {
  private static encryptionKey = EncryptionService.generateKey();

  static async createChatRoom(roomData: Omit<ChatRoom, '_id' | 'createdAt'>): Promise<ChatRoom> {
    try {
      const db = getMongoDb();
      const room: ChatRoom = {
        ...roomData,
        createdAt: new Date(),
        encryptionKey: this.encryptionKey
      };

      const result = await db.collection('chatrooms').insertOne(room);
      room._id = result.insertedId.toString();
      
      logger.info(`Chat room created: ${room._id}`);
      return room;
    } catch (error) {
      logger.error('Error creating chat room:', error);
      throw error;
    }
  }

  static async getChatRoom(roomId: string): Promise<ChatRoom | null> {
    try {
      const db = getMongoDb();
      const room = await db.collection('chatrooms').findOne({ _id: roomId });
      return room as ChatRoom || null;
    } catch (error) {
      logger.error('Error getting chat room:', error);
      throw error;
    }
  }

  static async getUserChatRooms(userId: string): Promise<ChatRoom[]> {
    try {
      const db = getMongoDb();
      const rooms = await db.collection('chatrooms')
        .find({ participants: userId })
        .sort({ createdAt: -1 })
        .toArray();
      
      return rooms as ChatRoom[];
    } catch (error) {
      logger.error('Error getting user chat rooms:', error);
      throw error;
    }
  }

  static async sendMessage(messageData: Omit<Message, '_id' | 'timestamp'>): Promise<Message> {
    try {
      const db = getMongoDb();
      
      // Encrypt message content
      const room = await this.getChatRoom(messageData.chatId);
      if (!room?.encryptionKey) {
        throw new Error('Chat room encryption key not found');
      }

      const encrypted = EncryptionService.encrypt(messageData.content, room.encryptionKey);
      
      const message: Message = {
        ...messageData,
        encryptedContent: JSON.stringify(encrypted),
        timestamp: new Date()
      };

      const result = await db.collection('messages').insertOne(message);
      message._id = result.insertedId.toString();
      
      logger.info(`Message sent: ${message._id}`);
      return message;
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  static async getMessages(chatId: string, limit = 50, skip = 0): Promise<Message[]> {
    try {
      const db = getMongoDb();
      const messages = await db.collection('messages')
        .find({ chatId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();

      // Decrypt messages
      const room = await this.getChatRoom(chatId);
      if (room?.encryptionKey) {
        messages.forEach(message => {
          if (message.encryptedContent) {
            try {
              const encryptedData = JSON.parse(message.encryptedContent);
              message.content = EncryptionService.decrypt(encryptedData, room.encryptionKey!);
            } catch (error) {
              logger.error('Error decrypting message:', error);
              message.content = '[Encrypted message - decryption failed]';
            }
          }
        });
      }

      return messages.reverse() as Message[];
    } catch (error) {
      logger.error('Error getting messages:', error);
      throw error;
    }
  }

  static async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const db = getMongoDb();
      const result = await db.collection('messages').deleteOne({
        _id: messageId,
        senderId: userId
      });

      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Error deleting message:', error);
      throw error;
    }
  }

  static async editMessage(messageId: string, userId: string, newContent: string): Promise<boolean> {
    try {
      const db = getMongoDb();
      
      // Get the message to find the chat room
      const message = await db.collection('messages').findOne({ _id: messageId, senderId: userId });
      if (!message) return false;

      // Get encryption key
      const room = await this.getChatRoom(message.chatId);
      if (!room?.encryptionKey) return false;

      // Encrypt new content
      const encrypted = EncryptionService.encrypt(newContent, room.encryptionKey);

      const result = await db.collection('messages').updateOne(
        { _id: messageId, senderId: userId },
        {
          $set: {
            content: newContent,
            encryptedContent: JSON.stringify(encrypted),
            edited: true,
            editedAt: new Date()
          }
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Error editing message:', error);
      throw error;
    }
  }
}