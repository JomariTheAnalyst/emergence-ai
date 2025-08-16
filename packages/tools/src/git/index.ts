import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolExecutionContext, ToolResult } from '../base/tool';
import { validatePath } from '@shadow/command-security';
import { prisma } from '@shadow/db';

const execAsync = promisify(exec);

/**
 * Git status tool for checking repository status
 */
export class GitStatusTool extends BaseTool<{
  repositoryPath?: string;
}, {
  branch: string;
  isClean: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}> {
  definition: ToolDefinition = {
    name: 'git_status',
    description: 'Check the status of a Git repository',
    category: 'git',
    parameters: z.object({
      repositoryPath: z.string().optional().describe('Path to the repository relative to workspace root'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: {
    repositoryPath?: string;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      // Resolve repository path
      const repoPath = params.repositoryPath
        ? path.resolve(context.workspaceDir, params.repositoryPath)
        : context.workspaceDir;
      
      // Security validation
      if (!validatePath(repoPath, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      // Check if directory exists
      if (!await fs.pathExists(repoPath)) {
        return this.error('Repository path not found');
      }

      // Check if it's a git repository
      const gitDir = path.join(repoPath, '.git');
      if (!await fs.pathExists(gitDir)) {
        return this.error('Not a git repository');
      }

      // Get current branch
      const { stdout: branchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
      const branch = branchOutput.trim();

      // Get status
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: repoPath });
      
      // Parse status output
      const lines = statusOutput.split('\n').filter(line => line.trim() !== '');
      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];
      
      for (const line of lines) {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        
        if (status.includes('?')) {
          untracked.push(file);
        } else if (status[0] !== ' ') {
          staged.push(file);
        } else if (status[1] !== ' ') {
          unstaged.push(file);
        }
      }

      return this.success({
        branch,
        isClean: lines.length === 0,
        staged,
        unstaged,
        untracked,
      });
    } catch (error) {
      return this.error(`Git status failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Git commit tool for creating commits
 */
export class GitCommitTool extends BaseTool<{
  message: string;
  repositoryPath?: string;
  addAll?: boolean;
  files?: string[];
  author?: string;
}, {
  commitHash: string;
  committed: boolean;
}> {
  definition: ToolDefinition = {
    name: 'git_commit',
    description: 'Create a git commit',
    category: 'git',
    parameters: z.object({
      message: z.string().describe('Commit message'),
      repositoryPath: z.string().optional().describe('Path to the repository relative to workspace root'),
      addAll: z.boolean().optional().default(false).describe('Whether to add all changes'),
      files: z.array(z.string()).optional().describe('Specific files to add'),
      author: z.string().optional().describe('Author name and email (format: "Name <email>")'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: {
    message: string;
    repositoryPath?: string;
    addAll?: boolean;
    files?: string[];
    author?: string;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      // Resolve repository path
      const repoPath = params.repositoryPath
        ? path.resolve(context.workspaceDir, params.repositoryPath)
        : context.workspaceDir;
      
      // Security validation
      if (!validatePath(repoPath, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      // Check if directory exists
      if (!await fs.pathExists(repoPath)) {
        return this.error('Repository path not found');
      }

      // Check if it's a git repository
      const gitDir = path.join(repoPath, '.git');
      if (!await fs.pathExists(gitDir)) {
        return this.error('Not a git repository');
      }

      // Add files
      if (params.addAll) {
        await execAsync('git add -A', { cwd: repoPath });
      } else if (params.files && params.files.length > 0) {
        // Validate and add each file
        for (const file of params.files) {
          const filePath = path.resolve(repoPath, file);
          
          // Security validation
          if (!validatePath(filePath, repoPath)) {
            return this.error(`Access denied: File outside repository: ${file}`);
          }
          
          await execAsync(`git add "${file.replace(/"/g, '\\"')}"`, { cwd: repoPath });
        }
      }

      // Create commit
      let commitCmd = 'git commit';
      
      // Add message
      commitCmd += ` -m "${params.message.replace(/"/g, '\\"')}"`;
      
      // Add author if specified
      if (params.author) {
        commitCmd += ` --author="${params.author.replace(/"/g, '\\"')}"`;
      }
      
      // Execute commit
      await execAsync(commitCmd, { cwd: repoPath });
      
      // Get commit hash
      const { stdout: hashOutput } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
      const commitHash = hashOutput.trim();

      return this.success({
        commitHash,
        committed: true,
      });
    } catch (error) {
      return this.error(`Git commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Git push tool for pushing changes to remote
 */
export class GitPushTool extends BaseTool<{
  repositoryPath?: string;
  remote?: string;
  branch?: string;
  setUpstream?: boolean;
}, {
  pushed: boolean;
  output: string;
}> {
  definition: ToolDefinition = {
    name: 'git_push',
    description: 'Push changes to remote repository',
    category: 'git',
    parameters: z.object({
      repositoryPath: z.string().optional().describe('Path to the repository relative to workspace root'),
      remote: z.string().optional().default('origin').describe('Remote name'),
      branch: z.string().optional().describe('Branch name (defaults to current branch)'),
      setUpstream: z.boolean().optional().default(false).describe('Whether to set upstream'),
    }),
    requiresWorkspace: true,
    dangerous: true,
  };

  async execute(params: {
    repositoryPath?: string;
    remote?: string;
    branch?: string;
    setUpstream?: boolean;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      // Resolve repository path
      const repoPath = params.repositoryPath
        ? path.resolve(context.workspaceDir, params.repositoryPath)
        : context.workspaceDir;
      
      // Security validation
      if (!validatePath(repoPath, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      // Check if directory exists
      if (!await fs.pathExists(repoPath)) {
        return this.error('Repository path not found');
      }

      // Check if it's a git repository
      const gitDir = path.join(repoPath, '.git');
      if (!await fs.pathExists(gitDir)) {
        return this.error('Not a git repository');
      }

      // Get current branch if not specified
      let branch = params.branch;
      if (!branch) {
        const { stdout: branchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
        branch = branchOutput.trim();
      }

      // Build push command
      let pushCmd = 'git push';
      
      // Add remote
      pushCmd += ` ${params.remote || 'origin'}`;
      
      // Add branch
      pushCmd += ` ${branch}`;
      
      // Add upstream flag if requested
      if (params.setUpstream) {
        pushCmd += ' --set-upstream';
      }
      
      // Execute push
      const { stdout, stderr } = await execAsync(pushCmd, { cwd: repoPath });
      const output = stdout + stderr;

      return this.success({
        pushed: true,
        output,
      });
    } catch (error) {
      return this.error(`Git push failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Git branch tool for branch management
 */
export class GitBranchTool extends BaseTool<{
  action: 'list' | 'create' | 'checkout' | 'delete';
  name?: string;
  startPoint?: string;
  repositoryPath?: string;
  force?: boolean;
}, {
  success: boolean;
  branches?: string[];
  current?: string;
  output?: string;
}> {
  definition: ToolDefinition = {
    name: 'git_branch',
    description: 'Manage git branches',
    category: 'git',
    parameters: z.object({
      action: z.enum(['list', 'create', 'checkout', 'delete']).describe('Branch action to perform'),
      name: z.string().optional().describe('Branch name for create/checkout/delete actions'),
      startPoint: z.string().optional().describe('Starting point for new branch (commit/branch)'),
      repositoryPath: z.string().optional().describe('Path to the repository relative to workspace root'),
      force: z.boolean().optional().default(false).describe('Force operation'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: {
    action: 'list' | 'create' | 'checkout' | 'delete';
    name?: string;
    startPoint?: string;
    repositoryPath?: string;
    force?: boolean;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      // Resolve repository path
      const repoPath = params.repositoryPath
        ? path.resolve(context.workspaceDir, params.repositoryPath)
        : context.workspaceDir;
      
      // Security validation
      if (!validatePath(repoPath, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      // Check if directory exists
      if (!await fs.pathExists(repoPath)) {
        return this.error('Repository path not found');
      }

      // Check if it's a git repository
      const gitDir = path.join(repoPath, '.git');
      if (!await fs.pathExists(gitDir)) {
        return this.error('Not a git repository');
      }

      // Perform action
      switch (params.action) {
        case 'list':
          return await this.listBranches(repoPath);
        
        case 'create':
          if (!params.name) {
            return this.error('Branch name is required for create action');
          }
          return await this.createBranch(repoPath, params.name, params.startPoint, params.force);
        
        case 'checkout':
          if (!params.name) {
            return this.error('Branch name is required for checkout action');
          }
          return await this.checkoutBranch(repoPath, params.name, params.force);
        
        case 'delete':
          if (!params.name) {
            return this.error('Branch name is required for delete action');
          }
          return await this.deleteBranch(repoPath, params.name, params.force);
        
        default:
          return this.error(`Unsupported action: ${params.action}`);
      }
    } catch (error) {
      return this.error(`Git branch operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async listBranches(repoPath: string): Promise<ToolResult> {
    const { stdout } = await execAsync('git branch', { cwd: repoPath });
    
    const branches: string[] = [];
    let current = '';
    
    stdout.split('\n').filter(line => line.trim() !== '').forEach(line => {
      const isCurrent = line.startsWith('*');
      const branch = line.replace('*', '').trim();
      
      branches.push(branch);
      
      if (isCurrent) {
        current = branch;
      }
    });
    
    return this.success({
      success: true,
      branches,
      current,
    });
  }

  private async createBranch(
    repoPath: string,
    name: string,
    startPoint?: string,
    force?: boolean
  ): Promise<ToolResult> {
    let cmd = 'git branch';
    
    if (force) {
      cmd += ' -f';
    }
    
    cmd += ` "${name.replace(/"/g, '\\"')}"`;
    
    if (startPoint) {
      cmd += ` "${startPoint.replace(/"/g, '\\"')}"`;
    }
    
    const { stdout, stderr } = await execAsync(cmd, { cwd: repoPath });
    
    return this.success({
      success: true,
      output: stdout + stderr,
    });
  }

  private async checkoutBranch(
    repoPath: string,
    name: string,
    force?: boolean
  ): Promise<ToolResult> {
    let cmd = 'git checkout';
    
    if (force) {
      cmd += ' -f';
    }
    
    cmd += ` "${name.replace(/"/g, '\\"')}"`;
    
    const { stdout, stderr } = await execAsync(cmd, { cwd: repoPath });
    
    return this.success({
      success: true,
      output: stdout + stderr,
    });
  }

  private async deleteBranch(
    repoPath: string,
    name: string,
    force?: boolean
  ): Promise<ToolResult> {
    let cmd = 'git branch';
    
    if (force) {
      cmd += ' -D';
    } else {
      cmd += ' -d';
    }
    
    cmd += ` "${name.replace(/"/g, '\\"')}"`;
    
    const { stdout, stderr } = await execAsync(cmd, { cwd: repoPath });
    
    return this.success({
      success: true,
      output: stdout + stderr,
    });
  }
}

/**
 * Create PR tool for generating pull requests
 */
export class CreatePRTool extends BaseTool<{
  title: string;
  description: string;
  baseBranch: string;
  headBranch: string;
  repositoryId: string;
  draft?: boolean;
}, {
  prNumber: number;
  url: string;
}> {
  definition: ToolDefinition = {
    name: 'create_pr',
    description: 'Create a pull request',
    category: 'git',
    parameters: z.object({
      title: z.string().describe('PR title'),
      description: z.string().describe('PR description'),
      baseBranch: z.string().describe('Base branch (target)'),
      headBranch: z.string().describe('Head branch (source)'),
      repositoryId: z.string().describe('Repository ID'),
      draft: z.boolean().optional().default(false).describe('Whether to create as draft'),
    }),
  };

  async execute(params: {
    title: string;
    description: string;
    baseBranch: string;
    headBranch: string;
    repositoryId: string;
    draft?: boolean;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      // Get repository
      const repository = await prisma.repository.findUnique({
        where: { id: params.repositoryId },
      });

      if (!repository) {
        return this.error(`Repository not found with ID: ${params.repositoryId}`);
      }

      // Create PR in database
      const pullRequest = await prisma.pullRequest.create({
        data: {
          title: params.title,
          description: params.description,
          state: params.draft ? 'DRAFT' : 'OPEN',
          baseBranch: params.baseBranch,
          headBranch: params.headBranch,
          authorId: context.userId,
          repositoryId: params.repositoryId,
          number: 1, // This would be assigned by GitHub in a real implementation
        },
      });

      // In a real implementation, this would call the GitHub API
      // For now, we'll just return the PR data
      return this.success({
        prNumber: pullRequest.number,
        url: `https://github.com/${repository.fullName}/pull/${pullRequest.number}`,
      });
    } catch (error) {
      return this.error(`Failed to create PR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

