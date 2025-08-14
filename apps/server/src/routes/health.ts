import { Router } from 'express';

const router = Router();

// Health check endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'shadow-server',
    version: '0.1.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Detailed health check
router.get('/detailed', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'shadow-server',
    version: '0.1.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    },
    services: {
      llm: {
        status: 'available',
        provider: 'emergent'
      },
      websocket: {
        status: 'active'
      }
    }
  };

  res.json(healthData);
});

export { router as healthRoutes };