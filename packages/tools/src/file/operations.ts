import { z } from 'zod';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as mime from 'mime-types';
import { diffLines } from 'diff';
import { BaseTool, ToolDefinition, ToolExecutionContext, ToolResult } from '../base/tool';
import { validatePath, sanitizeFilename } from '@shadow/command-security';

// Read file tool
export class ReadFileTool extends BaseTool<{ path: string; encoding?: string }, { content: string; encoding: string; size: number; mimeType: string }> {
  definition: ToolDefinition = {
    name: 'read_file',
    description: 'Read the contents of a file',
    category: 'file',
    parameters: z.object({
      path: z.string().describe('The path to the file to read'),
      encoding: z.string().optional().default('utf8').describe('File encoding (utf8, binary, base64)'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: { path: string; encoding?: string }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(context.workspaceDir, params.path);
      
      // Security validation
      if (!validatePath(fullPath, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      if (!await fs.pathExists(fullPath)) {
        return this.error('File not found');
      }

      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        return this.error('Path is a directory, not a file');
      }

      // Check file size (limit to 10MB for text files)
      if (params.encoding === 'utf8' && stats.size > 10 * 1024 * 1024) {
        return this.error('File too large (>10MB)');
      }

      const content = await fs.readFile(fullPath, params.encoding || 'utf8');
      const mimeType = mime.lookup(fullPath) || 'application/octet-stream';

      return this.success({
        content: typeof content === 'string' ? content : content.toString('base64'),
        encoding: params.encoding || 'utf8',
        size: stats.size,
        mimeType,
      });
    } catch (error) {
      return this.error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Write file tool
export class WriteFileTool extends BaseTool<{ path: string; content: string; encoding?: string; createDirs?: boolean }, { written: boolean; size: number }> {
  definition: ToolDefinition = {
    name: 'write_file',
    description: 'Write content to a file, creating or overwriting as needed',
    category: 'file',
    parameters: z.object({
      path: z.string().describe('The path where to write the file'),
      content: z.string().describe('The content to write'),
      encoding: z.string().optional().default('utf8').describe('File encoding'),
      createDirs: z.boolean().optional().default(true).describe('Create parent directories if they don\'t exist'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: { path: string; content: string; encoding?: string; createDirs?: boolean }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(context.workspaceDir, params.path);
      
      // Security validation
      if (!validatePath(fullPath, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      if (!sanitizeFilename(path.basename(params.path))) {
        return this.error('Invalid filename');
      }

      // Create parent directories if requested
      if (params.createDirs) {
        await fs.ensureDir(path.dirname(fullPath));
      }

      await fs.writeFile(fullPath, params.content, params.encoding || 'utf8');
      const stats = await fs.stat(fullPath);

      return this.success({
        written: true,
        size: stats.size,
      });
    } catch (error) {
      return this.error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Edit file tool (smart editing with diff)
export class EditFileTool extends BaseTool<{ 
  path: string; 
  content: string; 
  mode: 'replace' | 'prepend' | 'append' | 'insert'; 
  line?: number; 
  searchText?: string; 
  replaceText?: string 
}, { 
  edited: boolean; 
  diff: string; 
  linesChanged: number 
}> {
  definition: ToolDefinition = {
    name: 'edit_file',
    description: 'Intelligently edit a file with various modes (replace, append, prepend, insert, search/replace)',
    category: 'file',
    parameters: z.object({
      path: z.string().describe('The path to the file to edit'),
      content: z.string().optional().describe('Content for replace/prepend/append/insert modes'),
      mode: z.enum(['replace', 'prepend', 'append', 'insert']).describe('Edit mode'),
      line: z.number().optional().describe('Line number for insert mode (1-based)'),
      searchText: z.string().optional().describe('Text to search for in search/replace mode'),
      replaceText: z.string().optional().describe('Text to replace with in search/replace mode'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: { path: string; content?: string; mode: string; line?: number; searchText?: string; replaceText?: string }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(context.workspaceDir, params.path);
      
      if (!validatePath(fullPath, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      // Read original content if file exists
      let originalContent = '';
      if (await fs.pathExists(fullPath)) {
        originalContent = await fs.readFile(fullPath, 'utf8');
      }

      let newContent = originalContent;
      
      switch (params.mode) {
        case 'replace':
          newContent = params.content || '';
          break;
          
        case 'prepend':
          newContent = (params.content || '') + originalContent;
          break;
          
        case 'append':
          newContent = originalContent + (params.content || '');
          break;
          
        case 'insert':
          if (params.line === undefined) {
            return this.error('Line number required for insert mode');
          }
          const lines = originalContent.split('\n');
          lines.splice(params.line - 1, 0, params.content || '');
          newContent = lines.join('\n');
          break;
          
        default:
          return this.error(`Unsupported edit mode: ${params.mode}`);
      }

      // Write the new content
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, newContent, 'utf8');

      // Generate diff
      const diff = diffLines(originalContent, newContent)
        .map(part => {
          const prefix = part.added ? '+' : part.removed ? '-' : ' ';
          return part.value.split('\n')
            .filter(line => line !== '')
            .map(line => prefix + line)
            .join('\n');
        })
        .join('\n');

      const linesChanged = diffLines(originalContent, newContent)
        .filter(part => part.added || part.removed)
        .reduce((count, part) => count + part.value.split('\n').length - 1, 0);

      return this.success({
        edited: true,
        diff,
        linesChanged,
      });
    } catch (error) {
      return this.error(`Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// List directory tool
export class ListDirectoryTool extends BaseTool<{ path: string; recursive?: boolean; showHidden?: boolean }, { items: Array<{ name: string; type: 'file' | 'directory'; size: number; modified: string }> }> {
  definition: ToolDefinition = {
    name: 'list_directory',
    description: 'List the contents of a directory',
    category: 'file',
    parameters: z.object({
      path: z.string().describe('The directory path to list'),
      recursive: z.boolean().optional().default(false).describe('List files recursively'),
      showHidden: z.boolean().optional().default(false).describe('Include hidden files and directories'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: { path: string; recursive?: boolean; showHidden?: boolean }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(context.workspaceDir, params.path);
      
      if (!validatePath(fullPath, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      if (!await fs.pathExists(fullPath)) {
        return this.error('Directory not found');
      }

      const stats = await fs.stat(fullPath);
      if (!stats.isDirectory()) {
        return this.error('Path is not a directory');
      }

      const items: Array<{ name: string; type: 'file' | 'directory'; size: number; modified: string }> = [];

      const processDirectory = async (dirPath: string, relativeTo: string) => {
        const entries = await fs.readdir(dirPath);
        
        for (const entry of entries) {
          if (!params.showHidden && entry.startsWith('.')) {
            continue;
          }

          const entryPath = path.join(dirPath, entry);
          const entryStats = await fs.stat(entryPath);
          const relativePath = path.relative(relativeTo, entryPath);

          items.push({
            name: relativePath || entry,
            type: entryStats.isDirectory() ? 'directory' : 'file',
            size: entryStats.size,
            modified: entryStats.mtime.toISOString(),
          });

          if (params.recursive && entryStats.isDirectory()) {
            await processDirectory(entryPath, relativeTo);
          }
        }
      };

      await processDirectory(fullPath, fullPath);

      return this.success({ items });
    } catch (error) {
      return this.error(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Delete file tool
export class DeleteFileTool extends BaseTool<{ path: string; force?: boolean }, { deleted: boolean }> {
  definition: ToolDefinition = {
    name: 'delete_file',
    description: 'Delete a file or directory',
    category: 'file',
    parameters: z.object({
      path: z.string().describe('The path to delete'),
      force: z.boolean().optional().default(false).describe('Force deletion of directories'),
    }),
    requiresWorkspace: true,
    dangerous: true,
  };

  async execute(params: { path: string; force?: boolean }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(context.workspaceDir, params.path);
      
      if (!validatePath(fullPath, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      if (!await fs.pathExists(fullPath)) {
        return this.error('Path not found');
      }

      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory() && !params.force) {
        return this.error('Cannot delete directory without force flag');
      }

      await fs.remove(fullPath);

      return this.success({ deleted: true });
    } catch (error) {
      return this.error(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}