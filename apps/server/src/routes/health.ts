import { Router } from 'express';
import { prisma } from '@shadow/db';
import axios from 'axios';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const checks = await Promise.allSettled([
      // Database check
      prisma.$queryRaw`SELECT 1`,
      
      // Sidecar service check
      axios.get(`${process.env.SIDECAR_URL}/api/health`, { timeout: 5000 }),
    ]);

    const dbHealthy = checks[0].status === 'fulfilled';
    const sidecarHealthy = checks[1].status === 'fulfilled';

    const status = dbHealthy && sidecarHealthy ? 'healthy' : 'degraded';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        sidecar: sidecarHealthy ? 'healthy' : 'unhealthy',
      },
      configuration: {
        agentMode: process.env.AGENT_MODE || 'local',
        workspace: process.env.WORKSPACE_DIR || '/tmp/shadow-workspace',
        sidecarUrl: process.env.SIDECAR_URL || 'http://localhost:4001',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as healthRoutes };