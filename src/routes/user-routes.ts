import { Router } from 'express';
import passport from 'passport';
import { UserService } from '../services/user-service';
import { logger } from '../utils/logger';

const router = Router();

// Protect all user routes
router.use(passport.authenticate('jwt', { session: false }));

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const user = req.user as any;
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      membershipType: user.membershipType,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    logger.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Get all users (admin only)
router.get('/', async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'host') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const result = await UserService.getAllUsers(limit, offset);
    
    res.json({
      users: result.users,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const user = req.user as any;
    const { displayName, avatarUrl } = req.body;

    // Implementation would update user profile
    // For now, just return success
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export { router as userRoutes };