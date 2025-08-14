import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execAsync = promisify(exec);
const workspaceDir = process.env.WORKSPACE_DIR || '/tmp/shadow-workspace';

// Search for files by name
router.get('/files', async (req, res) => {
  try {
    const { query, path: searchPath = '.' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const fullPath = path.resolve(workspaceDir, searchPath as string);
    
    // Security check
    if (!fullPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Use find command to search for files
    const command = `find "${fullPath}" -name "*${query}*" -type f`;
    const { stdout } = await execAsync(command);
    
    const files = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(filePath => ({
        name: path.basename(filePath),
        path: path.relative(workspaceDir, filePath),
        directory: path.dirname(path.relative(workspaceDir, filePath))
      }));
    
    res.json({ files, query, searchPath });
  } catch (error) {
    console.error('Error searching files:', error);
    res.status(500).json({ error: 'Failed to search files' });
  }
});

// Search for content within files (grep)
router.get('/content', async (req, res) => {
  try {
    const { query, path: searchPath = '.', fileType = '*' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const fullPath = path.resolve(workspaceDir, searchPath as string);
    
    // Security check
    if (!fullPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Use grep to search for content
    const command = `grep -r -n -H "${query}" "${fullPath}" --include="*.${fileType === '*' ? '*' : fileType}"`;
    
    try {
      const { stdout } = await execAsync(command);
      
      const matches = stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [filePath, lineNumber, ...content] = line.split(':');
          return {
            file: path.relative(workspaceDir, filePath),
            line: parseInt(lineNumber),
            content: content.join(':').trim(),
            match: query
          };
        });
      
      res.json({ matches, query, searchPath, fileType });
    } catch (grepError) {
      // grep returns exit code 1 when no matches found
      res.json({ matches: [], query, searchPath, fileType });
    }
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ error: 'Failed to search content' });
  }
});

export { router as searchRoutes };