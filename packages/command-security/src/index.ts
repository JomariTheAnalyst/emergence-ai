import { SecurityError } from '@shadow/types';

// Dangerous commands that should be blocked
const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'sudo rm',
  'format',
  'fdisk',
  'mkfs',
  'dd',
  'kill -9',
  'killall',
  'shutdown',
  'reboot',
  'halt',
  'init 0',
  'init 6',
  'mount',
  'umount',
  'chown -R',
  'chmod -R 777',
  'chmod -R 755 /',
  'find / -delete',
  'find / -exec rm',
  ':(){ :|:& };:',  // Fork bomb
  'wget http',
  'curl http',
  'nc -l',
  'netcat -l',
];

// Dangerous paths that should be protected
const PROTECTED_PATHS = [
  '/',
  '/bin',
  '/sbin',
  '/usr',
  '/etc',
  '/var',
  '/lib',
  '/boot',
  '/sys',
  '/proc',
  '/dev',
  '/root',
  '/home',
];

// File extensions that could be dangerous to execute
const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.pif',
  '.vbs',
  '.jar',
];

export class CommandValidator {
  private workspaceDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
  }

  /**
   * Validates if a command is safe to execute
   */
  validateCommand(command: string): { valid: boolean; error?: SecurityError } {
    const normalizedCommand = command.toLowerCase().trim();

    // Check for dangerous commands
    for (const dangerous of DANGEROUS_COMMANDS) {
      if (normalizedCommand.includes(dangerous.toLowerCase())) {
        return {
          valid: false,
          error: {
            code: 'DANGEROUS_COMMAND',
            message: `Command contains dangerous operation: ${dangerous}`,
            operation: 'command_validation',
            reason: 'Command blocked for security reasons',
          },
        };
      }
    }

    // Check for attempts to break out of workspace
    if (this.containsPathTraversal(command)) {
      return {
        valid: false,
        error: {
          code: 'PATH_TRAVERSAL',
          message: 'Command attempts to access paths outside workspace',
          operation: 'command_validation',
          reason: 'Path traversal detected',
        },
      };
    }

    // Check for network operations without explicit approval
    if (this.containsNetworkOperation(command)) {
      return {
        valid: false,
        error: {
          code: 'NETWORK_OPERATION',
          message: 'Command attempts network operation',
          operation: 'command_validation',
          reason: 'Network operations require explicit approval',
        },
      };
    }

    // Check for dangerous file operations
    if (this.containsDangerousFileOperation(command)) {
      return {
        valid: false,
        error: {
          code: 'DANGEROUS_FILE_OP',
          message: 'Command contains potentially dangerous file operation',
          operation: 'command_validation',
          reason: 'File operation blocked for security reasons',
        },
      };
    }

    return { valid: true };
  }

  /**
   * Validates if a file path is within the allowed workspace
   */
  validatePath(path: string): { valid: boolean; error?: SecurityError } {
    const normalizedPath = this.normalizePath(path);

    // Check if path is within workspace
    if (!normalizedPath.startsWith(this.workspaceDir)) {
      return {
        valid: false,
        error: {
          code: 'PATH_OUT_OF_BOUNDS',
          message: `Path is outside workspace: ${path}`,
          operation: 'path_validation',
          path,
          reason: 'Path must be within workspace directory',
        },
      };
    }

    // Check for protected system paths
    for (const protectedPath of PROTECTED_PATHS) {
      if (normalizedPath.startsWith(protectedPath) && !normalizedPath.startsWith(this.workspaceDir)) {
        return {
          valid: false,
          error: {
            code: 'PROTECTED_PATH',
            message: `Path accesses protected system directory: ${path}`,
            operation: 'path_validation',
            path,
            reason: 'System paths are protected',
          },
        };
      }
    }

    return { valid: true };
  }

  /**
   * Sanitizes a command by removing dangerous elements
   */
  sanitizeCommand(command: string): string {
    let sanitized = command.trim();

    // Remove shell injection attempts
    sanitized = sanitized.replace(/[;&|`$(){}[\]]/g, '');

    // Remove multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Remove leading/trailing quotes if present
    sanitized = sanitized.replace(/^["']|["']$/g, '');

    return sanitized;
  }

  /**
   * Normalizes a path by resolving relative components
   */
  private normalizePath(path: string): string {
    // Remove leading/trailing whitespace
    path = path.trim();

    // Handle relative paths
    if (path.startsWith('./')) {
      path = this.workspaceDir + '/' + path.substring(2);
    } else if (path.startsWith('../')) {
      // Count how many levels up
      const levels = path.match(/\.\.\//g)?.length || 0;
      const remaining = path.replace(/\.\.\//g, '');
      
      // Don't allow going above workspace
      const workspaceParts = this.workspaceDir.split('/').filter(Boolean);
      if (levels >= workspaceParts.length) {
        return '/'; // Would go above root
      }
      
      const newBaseParts = workspaceParts.slice(0, -levels);
      path = '/' + newBaseParts.join('/') + '/' + remaining;
    } else if (!path.startsWith('/')) {
      path = this.workspaceDir + '/' + path;
    }

    // Remove double slashes and normalize
    path = path.replace(/\/+/g, '/');

    // Remove trailing slash unless it's root
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    return path;
  }

  /**
   * Checks if command contains path traversal attempts
   */
  private containsPathTraversal(command: string): boolean {
    const traversalPatterns = [
      '../',
      '..\\',
      '..%2f',
      '..%5c',
      '%2e%2e%2f',
      '%2e%2e%5c',
    ];

    const normalizedCommand = command.toLowerCase();
    return traversalPatterns.some(pattern => normalizedCommand.includes(pattern));
  }

  /**
   * Checks if command contains network operations
   */
  private containsNetworkOperation(command: string): boolean {
    const networkPatterns = [
      'wget',
      'curl',
      'nc -l',
      'netcat -l',
      'python -m http.server',
      'python3 -m http.server',
      'node -e "require(\'http\')',
      'ssh',
      'scp',
      'rsync',
      'ftp',
      'telnet',
    ];

    const normalizedCommand = command.toLowerCase();
    return networkPatterns.some(pattern => normalizedCommand.includes(pattern));
  }

  /**
   * Checks if command contains dangerous file operations
   */
  private containsDangerousFileOperation(command: string): boolean {
    const dangerousPatterns = [
      'rm -rf',
      'rm -f /',
      'rm -r /',
      'find / -delete',
      'find / -exec rm',
      'chmod -R 777',
      'chown -R',
      '> /dev/null',
      '2>/dev/null',
    ];

    const normalizedCommand = command.toLowerCase();
    return dangerousPatterns.some(pattern => normalizedCommand.includes(pattern));
  }
}

export class PathValidator {
  /**
   * Validates if a filename is safe
   */
  static validateFilename(filename: string): { valid: boolean; error?: SecurityError } {
    // Check for null bytes
    if (filename.includes('\0')) {
      return {
        valid: false,
        error: {
          code: 'INVALID_FILENAME',
          message: 'Filename contains null bytes',
          operation: 'filename_validation',
          reason: 'Null bytes are not allowed in filenames',
        },
      };
    }

    // Check for dangerous extensions
    const extension = filename.toLowerCase().split('.').pop();
    if (extension && DANGEROUS_EXTENSIONS.includes('.' + extension)) {
      return {
        valid: false,
        error: {
          code: 'DANGEROUS_EXTENSION',
          message: `File extension .${extension} is not allowed`,
          operation: 'filename_validation',
          reason: 'File extension blocked for security reasons',
        },
      };
    }

    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const baseName = filename.split('.')[0].toUpperCase();
    if (reservedNames.includes(baseName)) {
      return {
        valid: false,
        error: {
          code: 'RESERVED_FILENAME',
          message: `Filename ${filename} is reserved`,
          operation: 'filename_validation',
          reason: 'Reserved filenames are not allowed',
        },
      };
    }

    return { valid: true };
  }

  /**
   * Sanitizes a filename by removing dangerous characters
   */
  static sanitizeFilename(filename: string): string {
    // Remove null bytes and control characters
    let sanitized = filename.replace(/[\x00-\x1f\x80-\x9f]/g, '');

    // Replace dangerous characters with underscores
    sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '_');

    // Remove leading/trailing periods and spaces
    sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

    // Ensure filename is not empty
    if (sanitized.length === 0) {
      sanitized = 'unnamed_file';
    }

    // Limit length to 255 characters
    if (sanitized.length > 255) {
      const ext = sanitized.split('.').pop();
      const base = sanitized.substring(0, 255 - (ext ? ext.length + 1 : 0));
      sanitized = ext ? `${base}.${ext}` : base;
    }

    return sanitized;
  }
}

export { SecurityError };