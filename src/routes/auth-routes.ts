import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import { UserService } from '../services/user-service';
import { config } from '../config/environment';
import { validateRequest } from '../middleware/security';
import { logger } from '../utils/logger';

const router = Router();

// Local login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], validateRequest, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await UserService.verifyPassword(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await UserService.updateLastLogin(user.id);

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        membershipType: user.membershipType
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Local registration
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('displayName').optional().isLength({ min: 2, max: 50 })
], validateRequest, async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = await UserService.createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0]
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        membershipType: user.membershipType
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      const user = req.user as any;
      await UserService.updateLastLogin(user.id);

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.auth.jwtSecret,
        { expiresIn: config.auth.jwtExpiresIn }
      );

      // Redirect to frontend with token
      res.redirect(`${config.cors.allowedOrigins[0]}/auth/callback?token=${token}`);
    } catch (error) {
      logger.error('Google OAuth callback error:', error);
      res.redirect(`${config.cors.allowedOrigins[0]}/auth/error`);
    }
  }
);

// Token verification
router.get('/verify', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({
    user: {
      id: (req.user as any).id,
      email: (req.user as any).email,
      displayName: (req.user as any).displayName,
      avatarUrl: (req.user as any).avatarUrl,
      role: (req.user as any).role,
      membershipType: (req.user as any).membershipType
    }
  });
});

// Logout
router.post('/logout', (req, res) => {
  // In a stateless JWT setup, logout is handled on the client side
  res.json({ message: 'Logged out successfully' });
});

export { router as authRoutes };