'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CpuChipIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  PlusIcon,
  EyeIcon,
  CodeBracketIcon,
  DocumentIcon,
  CogIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useWebSocket } from '@/providers/WebSocketProvider';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  type: 'code_analysis' | 'code_generation' | 'debugging' | 'testing' | 'refactoring' | 'documentation';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  tools?: string[];
  output?: string;
  error?: string;
}

const taskTypeIcons = {
  code_analysis: CpuChipIcon,
  code_generation: CodeBracketIcon,
  debugging: ExclamationTriangleIcon,
  testing: CheckCircleIcon,
  refactoring: CogIcon,
  documentation: DocumentIcon,
};

const statusColors = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  running: 'text-blue-400 bg-blue-400/10',
  completed: 'text-green-400 bg-green-400/10',
  failed: 'text-red-400 bg-red-400/10',
  paused: 'text-gray-400 bg-gray-400/10',
};

const priorityColors = {
  low: 'border-l-green-500',
  medium: 'border-l-yellow-500',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500',
};

export function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'priority'>('updated');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'code_analysis' as Task['type'],
    priority: 'medium' as Task['priority']
  });
  const { isConnected, sendMessage } = useWebSocket();

  // Mock task data for demo
  const mockTasks: Task[] = [
    {
      id: '1',
      title: 'Analyze React Components',
      description: 'Perform static analysis on all React components in the src/components directory',
      status: 'running',
      type: 'code_analysis',
      priority: 'high',
      progress: 65,
      createdAt: new Date(Date.now() - 1000 * 60 * 30),
      updatedAt: new Date(Date.now() - 1000 * 60 * 5),
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
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      updatedAt: new Date(Date.now() - 1000 * 60 * 10),
      estimatedDuration: 30,
      actualDuration: 28,
      tools: ['swagger', 'jsdoc'],
      output: 'Successfully generated documentation for 24 endpoints'
    },
    {
      id: '3',
      title: 'Fix Authentication Bug',
      description: 'Debug and fix the JWT token refresh mechanism that is causing intermittent auth failures',
      status: 'failed',
      type: 'debugging',
      priority: 'urgent',
      progress: 45,
      createdAt: new Date(Date.now() - 1000 * 60 * 60),
      updatedAt: new Date(Date.now() - 1000 * 60 * 15),
      estimatedDuration: 60,
      tools: ['debugger', 'jwt-decode'],
      error: 'Unable to reproduce the issue in current environment'
    },
    {
      id: '4',
      title: 'Optimize Database Queries',
      description: 'Analyze and optimize slow database queries in the user management module',
      status: 'pending',
      type: 'refactoring',
      priority: 'medium',
      progress: 0,
      createdAt: new Date(Date.now() - 1000 * 60 * 20),
      updatedAt: new Date(Date.now() - 1000 * 60 * 20),
      estimatedDuration: 90,
      tools: ['sql-profiler', 'query-analyzer']
    }
  ];

  useEffect(() => {
    // Load tasks from demo data
    setTasks(mockTasks);
  }, []);

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-4 w-4" />;
      case 'running':
        return <PlayIcon className="h-4 w-4" />;
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'failed':
        return <XCircleIcon className="h-4 w-4" />;
      case 'paused':
        return <PauseIcon className="h-4 w-4" />;
    }
  };

  const handleTaskAction = (taskId: string, action: 'start' | 'pause' | 'stop' | 'delete') => {
    setTasks(prev => {
      return prev.map(task => {
        if (task.id === taskId) {
          switch (action) {
            case 'start':
              return { ...task, status: 'running' as const, updatedAt: new Date() };
            case 'pause':
              return { ...task, status: 'paused' as const, updatedAt: new Date() };
            case 'stop':
              return { ...task, status: 'pending' as const, progress: 0, updatedAt: new Date() };
            case 'delete':
              return null;
            default:
              return task;
          }
        }
        return task;
      }).filter(Boolean) as Task[];
    });

    if (action === 'delete' && selectedTask?.id === taskId) {
      setSelectedTask(null);
    }

    // Send action via WebSocket
    if (isConnected) {
      sendMessage({
        type: 'task_action',
        payload: { taskId, action }
      });
    }
  };

  const createTask = () => {
    if (!newTask.title.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      status: 'pending',
      type: newTask.type,
      priority: newTask.priority,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setTasks(prev => [task, ...prev]);
    setNewTask({ title: '', description: '', type: 'code_analysis', priority: 'medium' });
    setIsCreatingTask(false);

    // Send create task via WebSocket
    if (isConnected) {
      sendMessage({
        type: 'task_create',
        payload: task
      });
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (sortBy) {
      case 'created':
        return b.createdAt.getTime() - a.createdAt.getTime();
      case 'updated':
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      case 'priority':
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      default:
        return 0;
    }
  });

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="flex h-full bg-shadow-950">
      {/* Task List Panel */}
      <div className="w-1/2 border-r border-shadow-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-shadow-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Task Manager</h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCreatingTask(true)}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
            </motion.button>
          </div>

          {/* Filters */}
          <div className="flex space-x-2 mb-3">
            {(['all', 'running', 'completed', 'failed'] as const).map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors capitalize ${
                  filter === filterOption
                    ? 'bg-blue-600 text-white'
                    : 'bg-shadow-700 text-shadow-300 hover:bg-shadow-600'
                }`}
              >
                {filterOption}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 bg-shadow-800 border border-shadow-700 rounded-lg text-shadow-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="updated">Sort by Updated</option>
            <option value="created">Sort by Created</option>
            <option value="priority">Sort by Priority</option>
          </select>
        </div>

        {/* Create Task Form */}
        <AnimatePresence>
          {isCreatingTask && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-shadow-900 border-b border-shadow-800"
            >
              <div className="space-y-3">
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Task title..."
                  className="w-full px-3 py-2 bg-shadow-800 border border-shadow-700 rounded text-shadow-100 placeholder-shadow-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Task description..."
                  rows={2}
                  className="w-full px-3 py-2 bg-shadow-800 border border-shadow-700 rounded text-shadow-100 placeholder-shadow-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                
                <div className="flex space-x-2">
                  <select
                    value={newTask.type}
                    onChange={(e) => setNewTask(prev => ({ ...prev, type: e.target.value as Task['type'] }))}
                    className="flex-1 px-3 py-2 bg-shadow-800 border border-shadow-700 rounded text-shadow-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="code_analysis">Code Analysis</option>
                    <option value="code_generation">Code Generation</option>
                    <option value="debugging">Debugging</option>
                    <option value="testing">Testing</option>
                    <option value="refactoring">Refactoring</option>
                    <option value="documentation">Documentation</option>
                  </select>
                  
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                    className="flex-1 px-3 py-2 bg-shadow-800 border border-shadow-700 rounded text-shadow-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={createTask}
                    disabled={!newTask.title.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-shadow-700 text-white rounded transition-colors"
                  >
                    Create Task
                  </button>
                  <button
                    onClick={() => setIsCreatingTask(false)}
                    className="px-4 py-2 bg-shadow-700 hover:bg-shadow-600 text-white rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto">
          {sortedTasks.map((task) => {
            const TypeIcon = taskTypeIcons[task.type];
            return (
              <motion.div
                key={task.id}
                whileHover={{ backgroundColor: 'rgba(51, 65, 85, 0.3)' }}
                onClick={() => setSelectedTask(task)}
                className={`p-4 border-l-4 border-b border-shadow-800 cursor-pointer transition-colors ${
                  priorityColors[task.priority]
                } ${selectedTask?.id === task.id ? 'bg-blue-600/10' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <TypeIcon className="h-4 w-4 text-shadow-400" />
                    <h3 className="font-medium text-shadow-100 truncate">{task.title}</h3>
                  </div>
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${statusColors[task.status]}`}>
                    {getStatusIcon(task.status)}
                    <span className="capitalize">{task.status}</span>
                  </div>
                </div>
                
                <p className="text-sm text-shadow-400 mb-3 line-clamp-2">{task.description}</p>
                
                {task.status === 'running' && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-shadow-400 mb-1">
                      <span>Progress</span>
                      <span>{task.progress}%</span>
                    </div>
                    <div className="w-full bg-shadow-800 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${task.progress}%` }}
                        className="bg-blue-500 h-2 rounded-full"
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs text-shadow-500">
                  <span className="capitalize">{task.type.replace('_', ' ')}</span>
                  <span>{formatTimeAgo(task.updatedAt)}</span>
                </div>
              </motion.div>
            );
          })}
          
          {sortedTasks.length === 0 && (
            <div className="p-8 text-center">
              <CpuChipIcon className="h-12 w-12 text-shadow-600 mx-auto mb-3" />
              <p className="text-shadow-400">
                {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Task Details Panel */}
      <div className="w-1/2 flex flex-col">
        {selectedTask ? (
          <>
            {/* Task Header */}
            <div className="p-4 border-b border-shadow-800">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {(() => {
                    const TypeIcon = taskTypeIcons[selectedTask.type];
                    return <TypeIcon className="h-6 w-6 text-blue-500" />;
                  })()}
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedTask.title}</h3>
                    <div className={`flex items-center space-x-2 mt-1 px-2 py-1 rounded-full text-xs w-fit ${statusColors[selectedTask.status]}`}>
                      {getStatusIcon(selectedTask.status)}
                      <span className="capitalize">{selectedTask.status}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  {selectedTask.status === 'pending' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTaskAction(selectedTask.id, 'start')}
                      className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      title="Start task"
                    >
                      <PlayIcon className="h-4 w-4" />
                    </motion.button>
                  )}
                  
                  {selectedTask.status === 'running' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTaskAction(selectedTask.id, 'pause')}
                      className="p-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                      title="Pause task"
                    >
                      <PauseIcon className="h-4 w-4" />
                    </motion.button>
                  )}
                  
                  {(selectedTask.status === 'running' || selectedTask.status === 'paused') && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTaskAction(selectedTask.id, 'stop')}
                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      title="Stop task"
                    >
                      <StopIcon className="h-4 w-4" />
                    </motion.button>
                  )}
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTaskAction(selectedTask.id, 'delete')}
                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    title="Delete task"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
              
              <p className="text-shadow-300 mb-4">{selectedTask.description}</p>
              
              {/* Progress for running tasks */}
              {selectedTask.status === 'running' && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-shadow-400 mb-2">
                    <span>Progress</span>
                    <span>{selectedTask.progress}%</span>
                  </div>
                  <div className="w-full bg-shadow-800 rounded-full h-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedTask.progress}%` }}
                      className="bg-blue-500 h-3 rounded-full"
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}
              
              {/* Task Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-shadow-400">Type:</span>
                  <span className="text-shadow-200 ml-2 capitalize">{selectedTask.type.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-shadow-400">Priority:</span>
                  <span className="text-shadow-200 ml-2 capitalize">{selectedTask.priority}</span>
                </div>
                <div>
                  <span className="text-shadow-400">Created:</span>
                  <span className="text-shadow-200 ml-2">{formatTimeAgo(selectedTask.createdAt)}</span>
                </div>
                <div>
                  <span className="text-shadow-400">Updated:</span>
                  <span className="text-shadow-200 ml-2">{formatTimeAgo(selectedTask.updatedAt)}</span>
                </div>
                {selectedTask.estimatedDuration && (
                  <div>
                    <span className="text-shadow-400">Estimated:</span>
                    <span className="text-shadow-200 ml-2">{formatDuration(selectedTask.estimatedDuration)}</span>
                  </div>
                )}
                {selectedTask.actualDuration && (
                  <div>
                    <span className="text-shadow-400">Actual:</span>
                    <span className="text-shadow-200 ml-2">{formatDuration(selectedTask.actualDuration)}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Task Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Tools Used */}
              {selectedTask.tools && selectedTask.tools.length > 0 && (
                <div className="p-4 border-b border-shadow-800">
                  <h4 className="text-sm font-medium text-shadow-200 mb-2">Tools Used</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.tools.map((tool) => (
                      <span
                        key={tool}
                        className="px-2 py-1 bg-shadow-800 text-shadow-300 rounded text-xs"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Output */}
              {selectedTask.output && (
                <div className="p-4 border-b border-shadow-800">
                  <h4 className="text-sm font-medium text-shadow-200 mb-2">Output</h4>
                  <div className="bg-shadow-900 rounded-lg p-3">
                    <pre className="text-sm text-shadow-300 whitespace-pre-wrap font-mono">
                      {selectedTask.output}
                    </pre>
                  </div>
                </div>
              )}
              
              {/* Error */}
              {selectedTask.error && (
                <div className="p-4">
                  <h4 className="text-sm font-medium text-red-400 mb-2">Error</h4>
                  <div className="bg-red-950/20 border border-red-800 rounded-lg p-3">
                    <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono">
                      {selectedTask.error}
                    </pre>
                  </div>
                </div>
              )}
              
              {/* Running task live output placeholder */}
              {selectedTask.status === 'running' && (
                <div className="p-4">
                  <h4 className="text-sm font-medium text-shadow-200 mb-2">Live Output</h4>
                  <div className="bg-shadow-900 rounded-lg p-3 min-h-32">
                    <div className="flex items-center space-x-2 text-sm text-shadow-400">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span>Task is running... Output will appear here in real-time</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <CpuChipIcon className="h-16 w-16 text-shadow-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Task Selected</h3>
              <p className="text-shadow-400">
                Select a task from the left panel to view its details and manage its execution.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}