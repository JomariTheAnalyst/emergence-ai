import { Router } from 'express';
import { spawn, ChildProcess } from 'child_process';
import { CommandValidator } from '@shadow/command-security';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const workspaceDir = process.env.WORKSPACE_DIR || '/tmp/shadow-workspace';
const validator = new CommandValidator(workspaceDir);

// Store active terminal sessions
const activeSessions = new Map<string, {
  process?: ChildProcess;
  workingDir: string;
  environment: Record<string, string>;
}>();

// POST /api/terminal/execute - Execute a command
router.post('/execute', async (req, res) => {
  try {
    const { command, sessionId, workingDir } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // Validate command
    const commandValidation = validator.validateCommand(command);
    if (!commandValidation.valid) {
      return res.status(403).json({ error: commandValidation.error });
    }

    const cwd = workingDir ? `${workspaceDir}/${workingDir}` : workspaceDir;

    // Validate working directory
    const pathValidation = validator.validatePath(cwd);
    if (!pathValidation.valid) {
      return res.status(403).json({ error: pathValidation.error });
    }

    // Set up response for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    let output = '';
    let exitCode = 0;

    // Parse command and arguments
    const [cmd, ...args] = command.trim().split(/\s+/);

    // Spawn process
    const childProcess = spawn(cmd, args, {
      cwd,
      env: {
        ...process.env,
        PATH: process.env.PATH,
        PWD: cwd,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Store session if sessionId provided
    if (sessionId) {
      activeSessions.set(sessionId, {
        process: childProcess,
        workingDir: cwd,
        environment: process.env as Record<string, string>,
      });
    }

    // Handle stdout
    childProcess.stdout?.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      res.write(JSON.stringify({ type: 'stdout', data: chunk }) + '\n');
    });

    // Handle stderr
    childProcess.stderr?.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      res.write(JSON.stringify({ type: 'stderr', data: chunk }) + '\n');
    });

    // Handle process exit
    childProcess.on('close', (code) => {
      exitCode = code || 0;
      
      // Clean up session
      if (sessionId) {
        activeSessions.delete(sessionId);
      }

      // Send final result
      res.write(JSON.stringify({
        type: 'exit',
        code: exitCode,
        output,
        success: exitCode === 0,
      }) + '\n');
      
      res.end();
    });

    // Handle errors
    childProcess.on('error', (error) => {
      console.error('Command execution error:', error);
      
      if (sessionId) {
        activeSessions.delete(sessionId);
      }

      res.write(JSON.stringify({
        type: 'error',
        error: error.message,
        success: false,
      }) + '\n');
      
      res.end();
    });

    // Handle timeout (30 seconds)
    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM');
      
      if (sessionId) {
        activeSessions.delete(sessionId);
      }

      res.write(JSON.stringify({
        type: 'timeout',
        error: 'Command timed out after 30 seconds',
        success: false,
      }) + '\n');
      
      res.end();
    }, 30000);

    childProcess.on('close', () => {
      clearTimeout(timeout);
    });

  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/terminal/kill - Kill a running command
router.post('/kill', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = activeSessions.get(sessionId);
    if (!session || !session.process) {
      return res.status(404).json({ error: 'Session not found or not active' });
    }

    session.process.kill('SIGTERM');
    activeSessions.delete(sessionId);

    res.json({ message: 'Command terminated successfully' });
  } catch (error) {
    console.error('Error killing command:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/terminal/sessions - List active sessions
router.get('/sessions', (req, res) => {
  try {
    const sessions = Array.from(activeSessions.entries()).map(([id, session]) => ({
      id,
      workingDir: session.workingDir,
      active: session.process && !session.process.killed,
    }));

    res.json({ sessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/terminal/validate - Validate a command without executing
router.post('/validate', (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const validation = validator.validateCommand(command);
    
    res.json({
      valid: validation.valid,
      error: validation.error,
      sanitized: validator.sanitizeCommand(command),
    });
  } catch (error) {
    console.error('Error validating command:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export { router as terminalRoutes };