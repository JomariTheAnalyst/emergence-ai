import { z } from 'zod';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool, ToolDefinition, ToolExecutionContext, ToolResult } from '../base/tool';
import { validatePath } from '@shadow/command-security';

const execAsync = promisify(exec);

/**
 * Grep search tool for searching file contents
 */
export class GrepSearchTool extends BaseTool<{
  pattern: string;
  directory?: string;
  filePattern?: string;
  caseSensitive?: boolean;
  recursive?: boolean;
  maxResults?: number;
}, {
  matches: Array<{
    file: string;
    line: number;
    content: string;
  }>;
  totalMatches: number;
}> {
  definition: ToolDefinition = {
    name: 'grep_search',
    description: 'Search for a pattern in files using grep',
    category: 'search',
    parameters: z.object({
      pattern: z.string().describe('The pattern to search for'),
      directory: z.string().optional().default('.').describe('The directory to search in'),
      filePattern: z.string().optional().describe('File pattern to filter (e.g., "*.ts")'),
      caseSensitive: z.boolean().optional().default(false).describe('Whether the search is case-sensitive'),
      recursive: z.boolean().optional().default(true).describe('Whether to search recursively'),
      maxResults: z.number().optional().default(100).describe('Maximum number of results to return'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: {
    pattern: string;
    directory?: string;
    filePattern?: string;
    caseSensitive?: boolean;
    recursive?: boolean;
    maxResults?: number;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const searchDir = path.resolve(context.workspaceDir, params.directory || '.');
      
      // Security validation
      if (!validatePath(searchDir, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      if (!await fs.pathExists(searchDir)) {
        return this.error('Directory not found');
      }

      // Build grep command
      let grepCmd = 'grep';
      
      // Add options
      if (!params.caseSensitive) {
        grepCmd += ' -i';
      }
      
      if (params.recursive) {
        grepCmd += ' -r';
      }
      
      // Add line numbers
      grepCmd += ' -n';
      
      // Add pattern
      grepCmd += ` -e "${params.pattern.replace(/"/g, '\\"')}"`;
      
      // Add directory
      grepCmd += ` ${searchDir}`;
      
      // Add file pattern if specified
      if (params.filePattern) {
        grepCmd += ` --include="${params.filePattern.replace(/"/g, '\\"')}"`;
      }
      
      // Exclude node_modules and .git
      grepCmd += ' --exclude-dir=node_modules --exclude-dir=.git';

      // Execute grep command
      const { stdout, stderr } = await execAsync(grepCmd, { maxBuffer: 10 * 1024 * 1024 });
      
      if (stderr) {
        console.warn('Grep stderr:', stderr);
      }

      // Parse results
      const lines = stdout.split('\n').filter(line => line.trim() !== '');
      const matches = lines.slice(0, params.maxResults || 100).map(line => {
        // Parse grep output format: file:line:content
        const match = line.match(/^(.+?):(\d+):(.*)/);
        if (!match) return null;
        
        const [, file, lineNum, content] = match;
        const relativePath = path.relative(context.workspaceDir, file);
        
        return {
          file: relativePath,
          line: parseInt(lineNum, 10),
          content: content.trim(),
        };
      }).filter(Boolean) as Array<{
        file: string;
        line: number;
        content: string;
      }>;

      return this.success({
        matches,
        totalMatches: lines.length,
      });
    } catch (error) {
      // Handle case where grep doesn't find anything (exits with code 1)
      if (error instanceof Error && error.message.includes('Command failed with exit code 1')) {
        return this.success({
          matches: [],
          totalMatches: 0,
        });
      }
      
      return this.error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Fuzzy search tool for finding files by name
 */
export class FuzzySearchTool extends BaseTool<{
  query: string;
  directory?: string;
  maxResults?: number;
  includeHidden?: boolean;
}, {
  files: Array<{
    path: string;
    score: number;
    type: 'file' | 'directory';
  }>;
}> {
  definition: ToolDefinition = {
    name: 'fuzzy_search',
    description: 'Find files using fuzzy matching',
    category: 'search',
    parameters: z.object({
      query: z.string().describe('The search query'),
      directory: z.string().optional().default('.').describe('The directory to search in'),
      maxResults: z.number().optional().default(20).describe('Maximum number of results to return'),
      includeHidden: z.boolean().optional().default(false).describe('Whether to include hidden files'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: {
    query: string;
    directory?: string;
    maxResults?: number;
    includeHidden?: boolean;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const searchDir = path.resolve(context.workspaceDir, params.directory || '.');
      
      // Security validation
      if (!validatePath(searchDir, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      if (!await fs.pathExists(searchDir)) {
        return this.error('Directory not found');
      }

      // Build find command
      let findCmd = 'find';
      
      // Add directory
      findCmd += ` ${searchDir}`;
      
      // Exclude hidden files if not included
      if (!params.includeHidden) {
        findCmd += ' -not -path "*/\\.*"';
      }
      
      // Exclude node_modules
      findCmd += ' -not -path "*/node_modules/*"';
      
      // Execute find command
      const { stdout, stderr } = await execAsync(findCmd, { maxBuffer: 10 * 1024 * 1024 });
      
      if (stderr) {
        console.warn('Find stderr:', stderr);
      }

      // Get all files
      const allFiles = stdout.split('\n').filter(line => line.trim() !== '');
      
      // Simple fuzzy matching function
      const fuzzyMatch = (str: string, pattern: string): number => {
        const lowerStr = str.toLowerCase();
        const lowerPattern = pattern.toLowerCase();
        
        // Direct match gets highest score
        if (lowerStr.includes(lowerPattern)) {
          return 100 + (lowerPattern.length / lowerStr.length) * 100;
        }
        
        // Check if all characters in pattern appear in order in str
        let score = 0;
        let lastIndex = -1;
        let allCharsFound = true;
        
        for (const char of lowerPattern) {
          const index = lowerStr.indexOf(char, lastIndex + 1);
          if (index === -1) {
            allCharsFound = false;
            break;
          }
          
          // Characters closer together get higher score
          const distance = index - lastIndex;
          score += 10 / (distance || 1);
          lastIndex = index;
        }
        
        return allCharsFound ? score : 0;
      };
      
      // Score and sort files
      const scoredFiles = allFiles.map(file => {
        const relativePath = path.relative(context.workspaceDir, file);
        const fileName = path.basename(file);
        const isDirectory = fs.statSync(file).isDirectory();
        
        // Score based on filename and path
        const fileNameScore = fuzzyMatch(fileName, params.query) * 2; // Filename match is more important
        const pathScore = fuzzyMatch(relativePath, params.query);
        const totalScore = fileNameScore + pathScore;
        
        return {
          path: relativePath,
          score: totalScore,
          type: isDirectory ? 'directory' as const : 'file' as const,
        };
      });
      
      // Filter out zero scores and sort by score
      const results = scoredFiles
        .filter(file => file.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, params.maxResults || 20);

      return this.success({ files: results });
    } catch (error) {
      return this.error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Symbol search tool for finding code symbols
 */
export class SymbolSearchTool extends BaseTool<{
  symbol: string;
  language?: string;
  directory?: string;
  maxResults?: number;
}, {
  symbols: Array<{
    name: string;
    kind: string;
    file: string;
    line: number;
    column: number;
    signature?: string;
  }>;
}> {
  definition: ToolDefinition = {
    name: 'symbol_search',
    description: 'Find code symbols (functions, classes, variables) in the codebase',
    category: 'search',
    parameters: z.object({
      symbol: z.string().describe('The symbol name to search for'),
      language: z.string().optional().describe('Filter by programming language'),
      directory: z.string().optional().default('.').describe('The directory to search in'),
      maxResults: z.number().optional().default(20).describe('Maximum number of results to return'),
    }),
    requiresWorkspace: true,
  };

  async execute(params: {
    symbol: string;
    language?: string;
    directory?: string;
    maxResults?: number;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const searchDir = path.resolve(context.workspaceDir, params.directory || '.');
      
      // Security validation
      if (!validatePath(searchDir, context.workspaceDir)) {
        return this.error('Access denied: Path outside workspace');
      }

      if (!await fs.pathExists(searchDir)) {
        return this.error('Directory not found');
      }

      // Map language to file extensions
      const languageExtensions: Record<string, string[]> = {
        typescript: ['.ts', '.tsx'],
        javascript: ['.js', '.jsx'],
        python: ['.py'],
        java: ['.java'],
        go: ['.go'],
        rust: ['.rs'],
        cpp: ['.cpp', '.cc', '.cxx', '.h', '.hpp'],
        c: ['.c', '.h'],
        csharp: ['.cs'],
        php: ['.php'],
        ruby: ['.rb'],
      };

      // Build grep patterns based on language
      let patterns: string[] = [];
      
      if (params.language && languageExtensions[params.language.toLowerCase()]) {
        // Language-specific patterns
        const extensions = languageExtensions[params.language.toLowerCase()];
        
        switch (params.language.toLowerCase()) {
          case 'typescript':
          case 'javascript':
            patterns = [
              `function\\s+${params.symbol}\\s*\\(`, // Function declaration
              `const\\s+${params.symbol}\\s*=\\s*(async\\s+)?\\(`, // Function expression
              `class\\s+${params.symbol}\\s*[{<]`, // Class declaration
              `interface\\s+${params.symbol}\\s*[{<]`, // Interface declaration
              `type\\s+${params.symbol}\\s*=`, // Type declaration
              `enum\\s+${params.symbol}\\s*{`, // Enum declaration
              `const\\s+${params.symbol}\\s*=`, // Constant declaration
              `let\\s+${params.symbol}\\s*=`, // Variable declaration
              `var\\s+${params.symbol}\\s*=`, // Variable declaration
            ];
            break;
            
          case 'python':
            patterns = [
              `def\\s+${params.symbol}\\s*\\(`, // Function declaration
              `class\\s+${params.symbol}\\s*[\\(:]`, // Class declaration
              `${params.symbol}\\s*=`, // Variable assignment
            ];
            break;
            
          default:
            // Generic pattern
            patterns = [
              params.symbol,
            ];
        }
        
        // Build grep command for each extension
        const grepCommands = extensions.map(ext => {
          const patternStr = patterns.join('|');
          return `grep -r -n --include="*${ext}" -E "(${patternStr})" ${searchDir} --exclude-dir=node_modules --exclude-dir=.git`;
        });
        
        // Execute all grep commands
        const results = await Promise.all(
          grepCommands.map(cmd => execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 }).catch(err => ({ stdout: '', stderr: '' })))
        );
        
        // Combine results
        const stdout = results.map(r => r.stdout).join('\n');
        
        // Parse results
        const symbols = this.parseSymbols(stdout, context.workspaceDir, params.language);
        
        return this.success({
          symbols: symbols.slice(0, params.maxResults || 20),
        });
      } else {
        // Generic search across all files
        const patternStr = params.symbol;
        const grepCmd = `grep -r -n -E "\\b${patternStr}\\b" ${searchDir} --exclude-dir=node_modules --exclude-dir=.git`;
        
        const { stdout, stderr } = await execAsync(grepCmd, { maxBuffer: 10 * 1024 * 1024 }).catch(err => ({ stdout: '', stderr: '' }));
        
        // Parse results
        const symbols = this.parseSymbols(stdout, context.workspaceDir);
        
        return this.success({
          symbols: symbols.slice(0, params.maxResults || 20),
        });
      }
    } catch (error) {
      return this.error(`Symbol search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseSymbols(
    grepOutput: string,
    workspaceDir: string,
    language?: string
  ): Array<{
    name: string;
    kind: string;
    file: string;
    line: number;
    column: number;
    signature?: string;
  }> {
    const lines = grepOutput.split('\n').filter(line => line.trim() !== '');
    
    return lines.map(line => {
      // Parse grep output format: file:line:content
      const match = line.match(/^(.+?):(\d+):(.*)/);
      if (!match) return null;
      
      const [, file, lineNum, content] = match;
      const relativePath = path.relative(workspaceDir, file);
      
      // Determine symbol kind and extract signature
      let kind = 'unknown';
      let name = '';
      let signature = '';
      let column = 0;
      
      const trimmedContent = content.trim();
      
      // Try to determine symbol kind based on content
      if (trimmedContent.includes('function ') || trimmedContent.includes('def ')) {
        kind = 'function';
        
        // Extract function name and signature
        const funcMatch = trimmedContent.match(/(?:function|def)\s+(\w+)\s*(\([^)]*\))/);
        if (funcMatch) {
          name = funcMatch[1];
          signature = funcMatch[2];
          column = trimmedContent.indexOf(name);
        } else {
          name = '';
          column = 0;
        }
      } else if (trimmedContent.includes('class ')) {
        kind = 'class';
        
        // Extract class name
        const classMatch = trimmedContent.match(/class\s+(\w+)/);
        if (classMatch) {
          name = classMatch[1];
          column = trimmedContent.indexOf(name);
        } else {
          name = '';
          column = 0;
        }
      } else if (trimmedContent.includes('interface ')) {
        kind = 'interface';
        
        // Extract interface name
        const interfaceMatch = trimmedContent.match(/interface\s+(\w+)/);
        if (interfaceMatch) {
          name = interfaceMatch[1];
          column = trimmedContent.indexOf(name);
        } else {
          name = '';
          column = 0;
        }
      } else if (trimmedContent.includes('const ') || trimmedContent.includes('let ') || trimmedContent.includes('var ')) {
        kind = 'variable';
        
        // Extract variable name
        const varMatch = trimmedContent.match(/(?:const|let|var)\s+(\w+)/);
        if (varMatch) {
          name = varMatch[1];
          column = trimmedContent.indexOf(name);
        } else {
          name = '';
          column = 0;
        }
      } else {
        // If we can't determine the kind, use the search term as the name
        name = '';
        column = 0;
      }
      
      return {
        name: name || '',
        kind,
        file: relativePath,
        line: parseInt(lineNum, 10),
        column,
        signature,
      };
    }).filter(Boolean) as Array<{
      name: string;
      kind: string;
      file: string;
      line: number;
      column: number;
      signature?: string;
    }>;
  }
}

