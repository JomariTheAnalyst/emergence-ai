import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const workspaceDir = process.env.WORKSPACE_DIR || '/tmp/shadow-workspace';
    
    // Check if workspace directory exists and is accessible
    const workspaceExists = await fs.pathExists(workspaceDir);
    const workspaceStats = workspaceExists ? await fs.stat(workspaceDir) : null;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.0',
      environment: process.env.NODE_ENV || 'development',
      workspace: {
        directory: workspaceDir,
        exists: workspaceExists,
        accessible: workspaceStats?.isDirectory() || false,
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