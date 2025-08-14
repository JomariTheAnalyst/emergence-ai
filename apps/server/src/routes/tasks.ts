import { Router } from 'express';

const router = Router();

// Mock task storage - in production, use database
let tasks: any[] = [
  {
    id: '1',
    title: 'Analyze React Components',
    description: 'Perform static analysis on all React components in the src/components directory',
    status: 'running',
    type: 'code_analysis',
    priority: 'high',
    progress: 65,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    estimatedDuration: 45,
    tools: ['eslint', 'typescript', 'react-scanner'],
    output: 'Found 12 components, analyzing props and state usage...'
  },
  {
    id: '2',
    title: 'Generate API Documentation',
    description: 'Create comprehensive API documentation for all REST endpoints',
    status: 'completed',
    type: 'documentation',
    priority: 'medium',
    progress: 100,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    estimatedDuration: 30,
    actualDuration: 28,
    tools: ['swagger', 'jsdoc'],
    output: 'Successfully generated documentation for 24 endpoints'
  }
];

// Get all tasks
router.get('/', (req, res) => {
  const { status, type, priority } = req.query;
  
  let filteredTasks = [...tasks];
  
  if (status) {
    filteredTasks = filteredTasks.filter(task => task.status === status);
  }
  
  if (type) {
    filteredTasks = filteredTasks.filter(task => task.type === type);
  }
  
  if (priority) {
    filteredTasks = filteredTasks.filter(task => task.priority === priority);
  }
  
  res.json({ tasks: filteredTasks });
});

// Get task by ID
router.get('/:id', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  res.json({ task });
});

// Create new task
router.post('/', (req, res) => {
  const { title, description, type, priority } = req.body;
  
  if (!title || !description || !type) {
    return res.status(400).json({ 
      error: 'Title, description, and type are required' 
    });
  }
  
  const newTask = {
    id: Date.now().toString(),
    title,
    description,
    type,
    priority: priority || 'medium',
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tools: []
  };
  
  tasks.unshift(newTask);
  
  res.status(201).json({ task: newTask });
});

// Update task
router.put('/:id', (req, res) => {
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const updatedTask = {
    ...tasks[taskIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  tasks[taskIndex] = updatedTask;
  
  res.json({ task: updatedTask });
});

// Delete task
router.delete('/:id', (req, res) => {
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  tasks.splice(taskIndex, 1);
  
  res.json({ message: 'Task deleted successfully' });
});

// Task actions (start, pause, stop)
router.post('/:id/action', (req, res) => {
  const { action } = req.body;
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const task = tasks[taskIndex];
  
  switch (action) {
    case 'start':
      task.status = 'running';
      break;
    case 'pause':
      task.status = 'paused';
      break;
    case 'stop':
      task.status = 'pending';
      task.progress = 0;
      break;
    case 'complete':
      task.status = 'completed';
      task.progress = 100;
      break;
    case 'fail':
      task.status = 'failed';
      break;
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
  
  task.updatedAt = new Date().toISOString();
  tasks[taskIndex] = task;
  
  res.json({ task });
});

export { router as taskRoutes };