import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { CommandValidator, PathValidator } from '@shadow/command-security';
import { FileInfo, FileContent, SecurityError } from '@shadow/types';
import mime from 'mime-types';
import chokidar from 'chokidar';

const router = Router();
const workspaceDir = process.env.WORKSPACE_DIR || '/tmp/shadow-workspace';
const validator = new CommandValidator(workspaceDir);

// Ensure workspace directory exists
fs.ensureDirSync(workspaceDir);

// File watcher for live updates
const watcher = chokidar.watch(workspaceDir, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true,
});

watcher
  .on('add', path => console.log(`File ${path} has been added`))
  .on('change', path => console.log(`File ${path} has been changed`))
  .on('unlink', path => console.log(`File ${path} has been removed`));

// GET /api/files/list - List directory contents
router.get('/list', async (req, res) => {
  try {
    const dirPath = req.query.path as string || '';
    const fullPath = path.resolve(workspaceDir, dirPath);

    // Validate path
    const pathValidation = validator.validatePath(fullPath);
    if (!pathValidation.valid) {
      return res.status(403).json({ error: pathValidation.error });
    }

    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    const stat = await fs.stat(fullPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const files: FileInfo[] = [];

    for (const entry of entries) {
      const entryPath = path.join(fullPath, entry.name);
      const entryStat = await fs.stat(entryPath);
      const relativePath = path.relative(workspaceDir, entryPath);

      files.push({
        path: relativePath,
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: entry.isFile() ? entryStat.size : undefined,
        lastModified: entryStat.mtime,
        permissions: (entryStat.mode & parseInt('777', 8)).toString(8),
      });
    }

    // Sort: directories first, then files, both alphabetically
    files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    res.json({ files });
  } catch (error) {
    console.error('Error listing directory:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/files/read - Read file contents
router.get('/read', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = path.resolve(workspaceDir, filePath);

    // Validate path
    const pathValidation = validator.validatePath(fullPath);
    if (!pathValidation.valid) {
      return res.status(403).json({ error: pathValidation.error });
    }

    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    // Check if file is too large (> 10MB)
    if (stat.size > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large to read' });
    }

    // Determine encoding based on file type
    const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
    const isText = mimeType.startsWith('text/') || 
                   mimeType.includes('json') || 
                   mimeType.includes('javascript') ||
                   mimeType.includes('typescript') ||
                   ['.md', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf'].some(ext => 
                     fullPath.toLowerCase().endsWith(ext)
                   );

    const encoding = isText ? 'utf8' : 'base64';
    const content = await fs.readFile(fullPath, encoding as any);

    const fileContent: FileContent = {
      path: filePath,
      content,
      encoding,
      size: stat.size,
    };

    res.json(fileContent);
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/files/write - Write file contents
router.post('/write', async (req, res) => {
  try {
    const { path: filePath, content, encoding = 'utf8' } = req.body;

    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'File path and content are required' });
    }

    const fullPath = path.resolve(workspaceDir, filePath);

    // Validate path
    const pathValidation = validator.validatePath(fullPath);
    if (!pathValidation.valid) {
      return res.status(403).json({ error: pathValidation.error });
    }

    // Validate filename
    const filename = path.basename(fullPath);
    const filenameValidation = PathValidator.validateFilename(filename);
    if (!filenameValidation.valid) {
      return res.status(403).json({ error: filenameValidation.error });
    }

    // Ensure parent directory exists
    await fs.ensureDir(path.dirname(fullPath));

    // Write file
    await fs.writeFile(fullPath, content, encoding as any);

    const stat = await fs.stat(fullPath);

    res.json({
      message: 'File written successfully',
      path: filePath,
      size: stat.size,
    });
  } catch (error) {
    console.error('Error writing file:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/files/create-directory - Create directory
router.post('/create-directory', async (req, res) => {
  try {
    const { path: dirPath } = req.body;

    if (!dirPath) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const fullPath = path.resolve(workspaceDir, dirPath);

    // Validate path
    const pathValidation = validator.validatePath(fullPath);
    if (!pathValidation.valid) {
      return res.status(403).json({ error: pathValidation.error });
    }

    await fs.ensureDir(fullPath);

    res.json({
      message: 'Directory created successfully',
      path: dirPath,
    });
  } catch (error) {
    console.error('Error creating directory:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// DELETE /api/files/delete - Delete file or directory
router.delete('/delete', async (req, res) => {
  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = path.resolve(workspaceDir, filePath);

    // Validate path
    const pathValidation = validator.validatePath(fullPath);
    if (!pathValidation.valid) {
      return res.status(403).json({ error: pathValidation.error });
    }

    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      return res.status(404).json({ error: 'File or directory not found' });
    }

    await fs.remove(fullPath);

    res.json({
      message: 'File or directory deleted successfully',
      path: filePath,
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/files/move - Move/rename file or directory
router.post('/move', async (req, res) => {
  try {
    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({ error: 'Source and destination paths are required' });
    }

    const fromPath = path.resolve(workspaceDir, from);
    const toPath = path.resolve(workspaceDir, to);

    // Validate both paths
    const fromValidation = validator.validatePath(fromPath);
    if (!fromValidation.valid) {
      return res.status(403).json({ error: fromValidation.error });
    }

    const toValidation = validator.validatePath(toPath);
    if (!toValidation.valid) {
      return res.status(403).json({ error: toValidation.error });
    }

    const exists = await fs.pathExists(fromPath);
    if (!exists) {
      return res.status(404).json({ error: 'Source file or directory not found' });
    }

    // Ensure destination directory exists
    await fs.ensureDir(path.dirname(toPath));

    await fs.move(fromPath, toPath);

    res.json({
      message: 'File or directory moved successfully',
      from,
      to,
    });
  } catch (error) {
    console.error('Error moving file:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/files/copy - Copy file or directory
router.post('/copy', async (req, res) => {
  try {
    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({ error: 'Source and destination paths are required' });
    }

    const fromPath = path.resolve(workspaceDir, from);
    const toPath = path.resolve(workspaceDir, to);

    // Validate both paths
    const fromValidation = validator.validatePath(fromPath);
    if (!fromValidation.valid) {
      return res.status(403).json({ error: fromValidation.error });
    }

    const toValidation = validator.validatePath(toPath);
    if (!toValidation.valid) {
      return res.status(403).json({ error: toValidation.error });
    }

    const exists = await fs.pathExists(fromPath);
    if (!exists) {
      return res.status(404).json({ error: 'Source file or directory not found' });
    }

    // Ensure destination directory exists
    await fs.ensureDir(path.dirname(toPath));

    await fs.copy(fromPath, toPath);

    res.json({
      message: 'File or directory copied successfully',
      from,
      to,
    });
  } catch (error) {
    console.error('Error copying file:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export { router as fileRoutes };