import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { UserService } from '../services/user-service';
import { MessageService } from '../services/message-service';
import { logger } from '../utils/logger';

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
      const user = await UserService.findById(decoded.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      (socket as any).user = user;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    logger.info(`User connected: ${user.email}`);

    // Join user to their rooms
    socket.on('join-rooms', async (roomIds: string[]) => {
      for (const roomId of roomIds) {
        socket.join(roomId);
      }
    });

    // Handle new message
    socket.on('send-message', async (data) => {
      try {
        const { chatId, content, messageType = 'text', replyTo } = data;

        const message = await MessageService.sendMessage({
          chatId,
          senderId: user.id,
          senderName: user.displayName || user.email,
          content,
          messageType,
          replyTo
        });

        // Broadcast to all users in the chat room
        io.to(chatId).emit('new-message', message);
      } catch (error) {
        logger.error('Error handling send-message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (data) => {
      socket.to(data.chatId).emit('user-typing', {
        userId: user.id,
        userName: user.displayName || user.email
      });
    });

    socket.on('typing-stop', (data) => {
      socket.to(data.chatId).emit('user-stopped-typing', {
        userId: user.id
      });
    });

    // Handle message editing
    socket.on('edit-message', async (data) => {
      try {
        const { messageId, content } = data;
        const success = await MessageService.editMessage(messageId, user.id, content);
        
        if (success) {
          const message = { id: messageId, content, edited: true, editedAt: new Date() };
          socket.emit('message-edited', message);
          socket.broadcast.emit('message-edited', message);
        } else {
          socket.emit('error', { message: 'Failed to edit message' });
        }
      } catch (error) {
        logger.error('Error handling edit-message:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // Handle message deletion
    socket.on('delete-message', async (data) => {
      try {
        const { messageId } = data;
        const success = await MessageService.deleteMessage(messageId, user.id);
        
        if (success) {
          socket.emit('message-deleted', { messageId });
          socket.broadcast.emit('message-deleted', { messageId });
        } else {
          socket.emit('error', { message: 'Failed to delete message' });
        }
      } catch (error) {
        logger.error('Error handling delete-message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Handle user status
    socket.on('update-status', (status) => {
      socket.broadcast.emit('user-status-changed', {
        userId: user.id,
        status
      });
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${user.email}`);
      socket.broadcast.emit('user-offline', {
        userId: user.id
      });
    });
  });
}