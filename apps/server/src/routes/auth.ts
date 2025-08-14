import { Router } from 'express';

const router = Router();

// Simple auth routes for demo - in production, use proper authentication
router.post('/login', (req, res) => {
  // Demo login - always succeeds
  res.json({
    user: {
      id: 'demo-user',
      name: 'Demo User',
      email: 'demo@shadow.ai'
    },
    token: 'demo-token',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.get('/profile', (req, res) => {
  // Demo profile
  res.json({
    user: {
      id: 'demo-user',
      name: 'Demo User',
      email: 'demo@shadow.ai',
      preferences: {
        theme: 'dark',
        defaultProvider: 'openai',
        defaultModel: 'gpt-4o-mini'
      }
    }
  });
});

export { router as authRoutes };