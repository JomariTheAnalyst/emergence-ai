import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import mime from 'mime-types';

const router = Router();
const workspaceDir = process.env.WORKSPACE_DIR || '/tmp/shadow-workspace';

// Ensure workspace directory exists
fs.ensureDirSync(workspaceDir);

// List files in directory
router.get('/list', async (req, res) => {
  try {
    const { path: requestPath = '.' } = req.query;
    const fullPath = path.resolve(workspaceDir, requestPath as string);
    
    // Security check - ensure path is within workspace
    if (!fullPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const stats = await fs.stat(fullPath);
    
    if (stats.isDirectory()) {
      const items = await fs.readdir(fullPath);
      const fileList = await Promise.all(
        items.map(async (item) => {
          const itemPath = path.join(fullPath, item);
          const itemStats = await fs.stat(itemPath);
          
          return {
            name: item,
            type: itemStats.isDirectory() ? 'directory' : 'file',
            size: itemStats.isFile() ? itemStats.size : undefined,
            modified: itemStats.mtime,
            path: path.relative(workspaceDir, itemPath)
          };
        })
      );
      
      res.json({ files: fileList, path: path.relative(workspaceDir, fullPath) });
    } else {
      res.status(400).json({ error: 'Path is not a directory' });
    }
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Read file content
router.get('/read', async (req, res) => {
  try {
    const { path: requestPath } = req.query;
    
    if (!requestPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const fullPath = path.resolve(workspaceDir, requestPath as string);
    
    // Security check
    if (!fullPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const content = await fs.readFile(fullPath, 'utf-8');
    const mimeType = mime.lookup(fullPath) || 'text/plain';
    
    res.json({
      content,
      path: path.relative(workspaceDir, fullPath),
      mimeType,
      size: content.length
    });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Write file
router.post('/write', async (req, res) => {
  try {
    const { path: requestPath, content } = req.body;
    
    if (!requestPath || content === undefined) {
      return res.status(400).json({ error: 'Path and content are required' });
    }
    
    const fullPath = path.resolve(workspaceDir, requestPath);
    
    // Security check
    if (!fullPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(fullPath));
    
    await fs.writeFile(fullPath, content, 'utf-8');
    
    res.json({
      message: 'File written successfully',
      path: path.relative(workspaceDir, fullPath),
      size: content.length
    });
  } catch (error) {
    console.error('Error writing file:', error);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// Create directory
router.post('/mkdir', async (req, res) => {
  try {
    const { path: requestPath } = req.body;
    
    if (!requestPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const fullPath = path.resolve(workspaceDir, requestPath);
    
    // Security check
    if (!fullPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await fs.ensureDir(fullPath);
    
    res.json({
      message: 'Directory created successfully',
      path: path.relative(workspaceDir, fullPath)
    });
  } catch (error) {
    console.error('Error creating directory:', error);
    res.status(500).json({ error: 'Failed to create directory' });
  }
});

// Delete file or directory
router.delete('/delete', async (req, res) => {
  try {
    const { path: requestPath } = req.body;
    
    if (!requestPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const fullPath = path.resolve(workspaceDir, requestPath);
    
    // Security check
    if (!fullPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await fs.remove(fullPath);
    
    res.json({
      message: 'File/directory deleted successfully',
      path: path.relative(workspaceDir, fullPath)
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export { router as fileRoutes };