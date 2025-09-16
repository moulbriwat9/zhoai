import { Router } from 'express';
import passport from 'passport';
import { body, param } from 'express-validator';
import { MessageService } from '../services/message-service';
import { validateRequest } from '../middleware/security';
import { logger } from '../utils/logger';

const router = Router();

// Protect all message routes
router.use(passport.authenticate('jwt', { session: false }));

// Create chat room
router.post('/rooms', [
  body('name').isLength({ min: 1, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
  body('isPrivate').isBoolean()
], validateRequest, async (req, res) => {
  try {
    const user = req.user as any;
    const { name, description, isPrivate } = req.body;

    const room = await MessageService.createChatRoom({
      name,
      description,
      participants: [user.id],
      createdBy: user.id,
      isPrivate
    });

    res.status(201).json(room);
  } catch (error) {
    logger.error('Error creating chat room:', error);
    res.status(500).json({ error: 'Failed to create chat room' });
  }
});

// Get user's chat rooms
router.get('/rooms', async (req, res) => {
  try {
    const user = req.user as any;
    const rooms = await MessageService.getUserChatRooms(user.id);
    res.json(rooms);
  } catch (error) {
    logger.error('Error getting chat rooms:', error);
    res.status(500).json({ error: 'Failed to get chat rooms' });
  }
});

// Get messages for a chat room
router.get('/rooms/:roomId/messages', [
  param('roomId').isMongoId()
], validateRequest, async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;

    const messages = await MessageService.getMessages(roomId, limit, skip);
    res.json(messages);
  } catch (error) {
    logger.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send message
router.post('/rooms/:roomId/messages', [
  param('roomId').isMongoId(),
  body('content').isLength({ min: 1, max: 5000 }),
  body('messageType').isIn(['text', 'file', 'image'])
], validateRequest, async (req, res) => {
  try {
    const user = req.user as any;
    const { roomId } = req.params;
    const { content, messageType, replyTo } = req.body;

    const message = await MessageService.sendMessage({
      chatId: roomId,
      senderId: user.id,
      senderName: user.displayName || user.email,
      content,
      messageType,
      replyTo
    });

    res.status(201).json(message);
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Edit message
router.put('/messages/:messageId', [
  param('messageId').isMongoId(),
  body('content').isLength({ min: 1, max: 5000 })
], validateRequest, async (req, res) => {
  try {
    const user = req.user as any;
    const { messageId } = req.params;
    const { content } = req.body;

    const success = await MessageService.editMessage(messageId, user.id, content);
    if (!success) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    res.json({ message: 'Message updated successfully' });
  } catch (error) {
    logger.error('Error editing message:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete message
router.delete('/messages/:messageId', [
  param('messageId').isMongoId()
], validateRequest, async (req, res) => {
  try {
    const user = req.user as any;
    const { messageId } = req.params;

    const success = await MessageService.deleteMessage(messageId, user.id);
    if (!success) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export { router as messageRoutes };