import { z } from 'zod';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolExecutionContext, ToolResult } from '../base/tool';
import { validateCommand } from '@shadow/command-security';

const execAsync = promisify(exec);

/**
 * Execute command tool for running shell commands
 */
export class ExecuteCommandTool extends BaseTool<{
  command: string;
  workingDir?: string;
  timeout?: number;
  env?: Record<string, string>;
}, {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}> {
  definition: ToolDefinition = {
    name: 'execute_command',
    description: 'Execute a shell command in the workspace',
    category: 'terminal',
    parameters: z.object({
      command: z.string().describe('The command to execute'),
      workingDir: z.string().optional().describe('Working directory relative to workspace root'),
      timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
      env: z.record(z.string()).optional().describe('Additional environment variables'),
    }),
    requiresWorkspace: true,
    dangerous: true,
  };

  async execute(params: {
    command: string;
    workingDir?: string;
    timeout?: number;
    env?: Record<string, string>;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      // Validate command for security
      const validationResult = validateCommand(params.command);
      if (!validationResult.valid) {
        return this.error(`Command validation failed: ${validationResult.reason}`);
      }

      // Resolve working directory
      const workingDir = params.workingDir
        ? path.resolve(context.workspaceDir, params.workingDir)
        : context.workspaceDir;
      
      // Ensure working directory is within workspace
      if (!workingDir.startsWith(context.workspaceDir)) {
        return this.error('Access denied: Working directory outside workspace');
      }

      // Ensure working directory exists
      if (!await fs.pathExists(workingDir)) {
        return this.error(`Working directory not found: ${params.workingDir}`);
      }

      // Set timeout
      const timeout = params.timeout || 30000;
      
      // Set environment variables
      const env = {
        ...process.env,
        ...params.env,
      };

      // Execute command
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(params.command, {
        cwd: workingDir,
        env,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      const duration = Date.now() - startTime;

      return this.success({
        stdout,
        stderr,
        exitCode: 0,
        duration,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ETIMEDOUT') {
        return this.error(`Command timed out after ${params.timeout || 30000}ms`);
      }
      
      // Extract exit code and output if available
      if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
        const exitCode = 'code' in error ? (error as any).code : 1;
        return this.success({
          stdout: (error as any).stdout || '',
          stderr: (error as any).stderr || '',
          exitCode,
          duration: 0,
        });
      }
      
      return this.error(`Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Run script tool for executing scripts with streaming output
 */
export class RunScriptTool extends BaseTool<{
  script: string;
  interpreter?: string;
  workingDir?: string;
  timeout?: number;
  env?: Record<string, string>;
}, {
  exitCode: number;
  duration: number;
  output: string;
}> {
  definition: ToolDefinition = {
    name: 'run_script',
    description: 'Run a script with the specified interpreter',
    category: 'terminal',
    parameters: z.object({
      script: z.string().describe('The script content to execute'),
      interpreter: z.string().optional().default('bash').describe('The interpreter to use (bash, python, node)'),
      workingDir: z.string().optional().describe('Working directory relative to workspace root'),
      timeout: z.number().optional().default(60000).describe('Timeout in milliseconds'),
      env: z.record(z.string()).optional().describe('Additional environment variables'),
    }),
    requiresWorkspace: true,
    dangerous: true,
  };

  async execute(params: {
    script: string;
    interpreter?: string;
    workingDir?: string;
    timeout?: number;
    env?: Record<string, string>;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      // Resolve working directory
      const workingDir = params.workingDir
        ? path.resolve(context.workspaceDir, params.workingDir)
        : context.workspaceDir;
      
      // Ensure working directory is within workspace
      if (!workingDir.startsWith(context.workspaceDir)) {
        return this.error('Access denied: Working directory outside workspace');
      }

      // Ensure working directory exists
      if (!await fs.pathExists(workingDir)) {
        return this.error(`Working directory not found: ${params.workingDir}`);
      }

      // Determine interpreter
      const interpreter = params.interpreter || 'bash';
      let interpreterCmd: string;
      let interpreterArgs: string[] = [];
      let scriptFile: string;
      
      // Create temporary script file
      const scriptExt = this.getScriptExtension(interpreter);
      scriptFile = path.join(workingDir, `temp_script_${Date.now()}${scriptExt}`);
      
      // Write script to file
      await fs.writeFile(scriptFile, params.script);
      
      // Make script executable
      await fs.chmod(scriptFile, '755');
      
      // Set up interpreter command and args
      switch (interpreter) {
        case 'python':
          interpreterCmd = 'python';
          interpreterArgs = [scriptFile];
          break;
        case 'node':
          interpreterCmd = 'node';
          interpreterArgs = [scriptFile];
          break;
        case 'bash':
        default:
          interpreterCmd = 'bash';
          interpreterArgs = [scriptFile];
          break;
      }

      // Set environment variables
      const env = {
        ...process.env,
        ...params.env,
      };

      // Set timeout
      const timeout = params.timeout || 60000;
      let timeoutId: NodeJS.Timeout | null = null;
      
      // Execute script
      const startTime = Date.now();
      
      return new Promise<ToolResult>((resolve) => {
        let output = '';
        let killed = false;
        
        // Start process
        const process = spawn(interpreterCmd, interpreterArgs, {
          cwd: workingDir,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        
        // Set timeout
        if (timeout > 0) {
          timeoutId = setTimeout(() => {
            if (!process.killed) {
              process.kill();
              killed = true;
              resolve(this.error(`Script execution timed out after ${timeout}ms`));
            }
          }, timeout);
        }
        
        // Collect stdout
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        // Collect stderr
        process.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        // Handle process exit
        process.on('close', async (code) => {
          if (timeoutId) clearTimeout(timeoutId);
          
          // Clean up script file
          try {
            await fs.remove(scriptFile);
          } catch (error) {
            console.error('Failed to remove temporary script file:', error);
          }
          
          if (!killed) {
            const duration = Date.now() - startTime;
            
            resolve(this.success({
              exitCode: code || 0,
              duration,
              output,
            }));
          }
        });
        
        // Handle process error
        process.on('error', (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          
          // Clean up script file
          fs.remove(scriptFile).catch(err => {
            console.error('Failed to remove temporary script file:', err);
          });
          
          resolve(this.error(`Script execution failed: ${error.message}`));
        });
      });
    } catch (error) {
      return this.error(`Script execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getScriptExtension(interpreter: string): string {
    switch (interpreter) {
      case 'python':
        return '.py';
      case 'node':
        return '.js';
      case 'bash':
      default:
        return '.sh';
    }
  }
}

/**
 * Process monitor tool for listing running processes
 */
export class ProcessMonitorTool extends BaseTool<{
  filter?: string;
}, {
  processes: Array<{
    pid: number;
    command: string;
    cpu: string;
    memory: string;
    user: string;
    time: string;
  }>;
}> {
  definition: ToolDefinition = {
    name: 'process_monitor',
    description: 'List running processes in the workspace',
    category: 'terminal',
    parameters: z.object({
      filter: z.string().optional().describe('Filter processes by command name'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: {
    filter?: string;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      // Build ps command
      let psCmd = 'ps aux';
      
      // Add filter if specified
      if (params.filter) {
        psCmd += ` | grep "${params.filter.replace(/"/g, '\\"')}" | grep -v grep`;
      }
      
      // Execute ps command
      const { stdout, stderr } = await execAsync(psCmd);
      
      if (stderr) {
        console.warn('PS stderr:', stderr);
      }

      // Parse results
      const lines = stdout.split('\n').filter(line => line.trim() !== '');
      
      // Skip header line
      const processes = lines.slice(1).map(line => {
        const parts = line.trim().split(/\s+/);
        
        return {
          user: parts[0],
          pid: parseInt(parts[1], 10),
          cpu: parts[2],
          memory: parts[3],
          time: parts[9],
          command: parts.slice(10).join(' '),
        };
      });

      return this.success({ processes });
    } catch (error) {
      return this.error(`Process monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

