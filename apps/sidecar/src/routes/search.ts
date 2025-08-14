import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { CommandValidator } from '@shadow/command-security';
import { SearchResult } from '@shadow/types';
import { spawn } from 'child_process';

const router = Router();
const workspaceDir = process.env.WORKSPACE_DIR || '/tmp/shadow-workspace';
const validator = new CommandValidator(workspaceDir);

// POST /api/search/grep - Search files using grep
router.post('/grep', async (req, res) => {
  try {
    const { pattern, path: searchPath = '', caseSensitive = false, wholeWord = false } = req.body;

    if (!pattern) {
      return res.status(400).json({ error: 'Search pattern is required' });
    }

    const fullPath = path.resolve(workspaceDir, searchPath);

    // Validate path
    const pathValidation = validator.validatePath(fullPath);
    if (!pathValidation.valid) {
      return res.status(403).json({ error: pathValidation.error });
    }

    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      return res.status(404).json({ error: 'Search path not found' });
    }

    // Build grep command
    const grepArgs = [
      '-r',  // recursive
      '-n',  // line numbers
      '-H',  // print filename
    ];

    if (!caseSensitive) {
      grepArgs.push('-i');
    }

    if (wholeWord) {
      grepArgs.push('-w');
    }

    grepArgs.push(pattern, fullPath);

    // Execute grep
    const grep = spawn('grep', grepArgs);
    let output = '';
    let error = '';

    grep.stdout.on('data', (data) => {
      output += data.toString();
    });

    grep.stderr.on('data', (data) => {
      error += data.toString();
    });

    grep.on('close', (code) => {
      if (code !== 0 && code !== 1) { // 1 means no matches found, which is not an error
        return res.status(500).json({ error: `grep failed: ${error}` });
      }

      const results: SearchResult[] = [];
      const lines = output.trim().split('\n').filter(line => line);

      for (const line of lines) {
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (match) {
          const [, filePath, lineNumber, content] = match;
          const relativePath = path.relative(workspaceDir, filePath);

          results.push({
            file: relativePath,
            line: parseInt(lineNumber, 10),
            content: content.trim(),
          });
        }
      }

      res.json({ results });
    });
  } catch (error) {
    console.error('Error searching files:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/search/files - Search for files by name
router.post('/files', async (req, res) => {
  try {
    const { pattern, path: searchPath = '' } = req.body;

    if (!pattern) {
      return res.status(400).json({ error: 'Search pattern is required' });
    }

    const fullPath = path.resolve(workspaceDir, searchPath);

    // Validate path
    const pathValidation = validator.validatePath(fullPath);
    if (!pathValidation.valid) {
      return res.status(403).json({ error: pathValidation.error });
    }

    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      return res.status(404).json({ error: 'Search path not found' });
    }

    // Use find command to search for files
    const find = spawn('find', [fullPath, '-name', `*${pattern}*`, '-type', 'f']);
    let output = '';
    let error = '';

    find.stdout.on('data', (data) => {
      output += data.toString();
    });

    find.stderr.on('data', (data) => {
      error += data.toString();
    });

    find.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: `find failed: ${error}` });
      }

      const files = output.trim().split('\n')
        .filter(line => line)
        .map(filePath => path.relative(workspaceDir, filePath))
        .sort();

      res.json({ files });
    });
  } catch (error) {
    console.error('Error searching for files:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/search/content - Search for content within files (alternative to grep)
router.post('/content', async (req, res) => {
  try {
    const { query, extensions = [], maxResults = 100 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results: SearchResult[] = [];
    const searchPattern = new RegExp(query, 'gi');

    async function searchInDirectory(dirPath: string) {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults) break;

          const entryPath = path.join(dirPath, entry.name);
          const relativePath = path.relative(workspaceDir, entryPath);

          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await searchInDirectory(entryPath);
          } else if (entry.isFile()) {
            // Check file extension if specified
            if (extensions.length > 0) {
              const ext = path.extname(entry.name).toLowerCase();
              if (!extensions.includes(ext)) continue;
            }

            try {
              const stat = await fs.stat(entryPath);
              // Skip files larger than 1MB
              if (stat.size > 1024 * 1024) continue;

              const content = await fs.readFile(entryPath, 'utf8');
              const lines = content.split('\n');

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (searchPattern.test(line)) {
                  results.push({
                    file: relativePath,
                    line: i + 1,
                    content: line.trim(),
                    context: [
                      lines[i - 1]?.trim() || '',
                      lines[i + 1]?.trim() || '',
                    ].filter(Boolean),
                  });

                  if (results.length >= maxResults) break;
                }
              }
            } catch (fileError) {
              // Skip files that can't be read as text
              continue;
            }
          }
        }
      } catch (dirError) {
        console.error(`Error reading directory ${dirPath}:`, dirError);
      }
    }

    await searchInDirectory(workspaceDir);

    res.json({ results: results.slice(0, maxResults) });
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export { router as searchRoutes };