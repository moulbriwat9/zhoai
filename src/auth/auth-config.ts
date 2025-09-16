import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Application } from 'express';
import { config } from '../config/environment';
import { UserService } from '../services/user-service';
import { logger } from '../utils/logger';

export function initializeAuth(app: Application) {
  app.use(passport.initialize());

  // JWT Strategy
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.auth.jwtSecret
  }, async (payload, done) => {
    try {
      const user = await UserService.findById(payload.userId);
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      logger.error('JWT Strategy error:', error);
      return done(error, false);
    }
  }));

  // Google OAuth Strategy
  if (config.auth.google.clientId && config.auth.google.clientSecret) {
    passport.use(new GoogleStrategy({
      clientID: config.auth.google.clientId,
      clientSecret: config.auth.google.clientSecret,
      callbackURL: '/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await UserService.findByOAuth('google', profile.id);
        
        if (!user) {
          user = await UserService.createOAuthUser({
            email: profile.emails?.[0]?.value || '',
            displayName: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
            oauthProvider: 'google',
            oauthId: profile.id
          });
        }
        
        return done(null, user);
      } catch (error) {
        logger.error('Google OAuth error:', error);
        return done(error, null);
      }
    }));
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await UserService.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}