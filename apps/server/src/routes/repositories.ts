import { Router } from 'express';

const router = Router();

// Mock repository storage - in production, use database
let repositories: any[] = [
  {
    id: '1',
    name: 'shadow-platform',
    url: 'https://github.com/user/shadow-platform',
    branch: 'main',
    description: 'Main Shadow AI Coding Agent Platform',
    language: 'TypeScript',
    status: 'active',
    lastSync: new Date().toISOString(),
    fileCount: 156,
    size: '2.4MB'
  },
  {
    id: '2',
    name: 'demo-project',
    url: 'https://github.com/user/demo-project',
    branch: 'develop',
    description: 'Demo project for testing Shadow capabilities',
    language: 'JavaScript',
    status: 'syncing',
    lastSync: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    fileCount: 89,
    size: '1.2MB'
  }
];

// Get all repositories
router.get('/', (req, res) => {
  res.json({ repositories });
});

// Get repository by ID
router.get('/:id', (req, res) => {
  const repository = repositories.find(r => r.id === req.params.id);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  res.json({ repository });
});

// Add new repository
router.post('/', (req, res) => {
  const { name, url, branch, description } = req.body;
  
  if (!name || !url) {
    return res.status(400).json({ 
      error: 'Name and URL are required' 
    });
  }
  
  const newRepository = {
    id: Date.now().toString(),
    name,
    url,
    branch: branch || 'main',
    description: description || '',
    language: 'Unknown',
    status: 'pending',
    lastSync: null,
    fileCount: 0,
    size: '0B'
  };
  
  repositories.unshift(newRepository);
  
  res.status(201).json({ repository: newRepository });
});

// Update repository
router.put('/:id', (req, res) => {
  const repoIndex = repositories.findIndex(r => r.id === req.params.id);
  
  if (repoIndex === -1) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  const updatedRepo = {
    ...repositories[repoIndex],
    ...req.body,
    lastSync: new Date().toISOString()
  };
  
  repositories[repoIndex] = updatedRepo;
  
  res.json({ repository: updatedRepo });
});

// Delete repository
router.delete('/:id', (req, res) => {
  const repoIndex = repositories.findIndex(r => r.id === req.params.id);
  
  if (repoIndex === -1) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  repositories.splice(repoIndex, 1);
  
  res.json({ message: 'Repository deleted successfully' });
});

// Sync repository
router.post('/:id/sync', (req, res) => {
  const repoIndex = repositories.findIndex(r => r.id === req.params.id);
  
  if (repoIndex === -1) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  const repo = repositories[repoIndex];
  repo.status = 'syncing';
  repo.lastSync = new Date().toISOString();
  
  // Simulate sync completion after 3 seconds
  setTimeout(() => {
    repo.status = 'active';
    repo.fileCount = Math.floor(Math.random() * 200) + 50;
    repo.size = `${(Math.random() * 5 + 0.5).toFixed(1)}MB`;
  }, 3000);
  
  res.json({ repository: repo });
});

export { router as repositoryRoutes };