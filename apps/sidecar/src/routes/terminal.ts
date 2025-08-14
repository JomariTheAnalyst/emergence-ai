import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';

const router = Router();
const workspaceDir = process.env.WORKSPACE_DIR || '/tmp/shadow-workspace';

// Execute terminal command
router.post('/execute', async (req, res) => {
  try {
    const { command, workingDir = '.', timeout = 30000 } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    const fullWorkingDir = path.resolve(workspaceDir, workingDir);
    
    // Security check
    if (!fullWorkingDir.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Basic command validation
    const dangerousCommands = ['rm -rf /', 'format', 'fdisk', 'dd'];
    if (dangerousCommands.some(dangerous => command.includes(dangerous))) {
      return res.status(403).json({ error: 'Dangerous command blocked' });
    }
    
    const child = spawn('bash', ['-c', command], {
      cwd: fullWorkingDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timeoutId);
      
      res.json({
        command,
        exitCode: code,
        stdout,
        stderr,
        workingDir: path.relative(workspaceDir, fullWorkingDir),
        timestamp: new Date().toISOString()
      });
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error('Command execution error:', error);
      res.status(500).json({ error: 'Failed to execute command' });
    });
    
  } catch (error) {
    console.error('Terminal error:', error);
    res.status(500).json({ error: 'Failed to process terminal command' });
  }
});

// Get current working directory info
router.get('/pwd', (req, res) => {
  try {
    const { path: requestPath = '.' } = req.query;
    const fullPath = path.resolve(workspaceDir, requestPath as string);
    
    // Security check
    if (!fullPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      workingDir: path.relative(workspaceDir, fullPath),
      absolutePath: fullPath,
      workspaceRoot: workspaceDir
    });
  } catch (error) {
    console.error('PWD error:', error);
    res.status(500).json({ error: 'Failed to get working directory' });
  }
});

export { router as terminalRoutes };