import { Router } from 'express';

const router = Router();

// Health check endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'shadow-sidecar',
    version: '0.1.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    workspace: process.env.WORKSPACE_DIR || '/tmp/shadow-workspace'
  });
});

export { router as healthRoutes };