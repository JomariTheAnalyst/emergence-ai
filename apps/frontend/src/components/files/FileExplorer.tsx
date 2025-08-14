'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FolderIcon, 
  DocumentIcon, 
  CodeBracketIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  FolderPlusIcon
} from '@heroicons/react/24/outline';
import { useWebSocket } from '@/providers/WebSocketProvider';

interface FileSystemItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  modified?: Date;
  children?: FileSystemItem[];
}

interface FileContent {
  content: string;
  language: string;
}

export function FileExplorer() {
  const [currentPath, setCurrentPath] = useState('/tmp/shadow-workspace');
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'file' | 'directory'>('file');
  const { isConnected, sendMessage } = useWebSocket();

  // Mock file system data for demo
  const mockFileSystem: FileSystemItem[] = [
    {
      name: 'src',
      type: 'directory',
      path: '/tmp/shadow-workspace/src',
      children: [
        { name: 'components', type: 'directory', path: '/tmp/shadow-workspace/src/components' },
        { name: 'utils', type: 'directory', path: '/tmp/shadow-workspace/src/utils' },
        { name: 'index.ts', type: 'file', path: '/tmp/shadow-workspace/src/index.ts', size: 1024 },
        { name: 'app.ts', type: 'file', path: '/tmp/shadow-workspace/src/app.ts', size: 2048 }
      ]
    },
    {
      name: 'package.json',
      type: 'file',
      path: '/tmp/shadow-workspace/package.json',
      size: 512,
      modified: new Date()
    },
    {
      name: 'README.md',
      type: 'file',
      path: '/tmp/shadow-workspace/README.md',
      size: 1536,
      modified: new Date()
    },
    {
      name: 'tsconfig.json',
      type: 'file',
      path: '/tmp/shadow-workspace/tsconfig.json',
      size: 256,
      modified: new Date()
    }
  ];

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  const loadDirectory = async (path: string) => {
    setIsLoading(true);
    
    try {
      // For demo, use mock data
      if (path === '/tmp/shadow-workspace') {
        setItems(mockFileSystem);
      } else {
        // Find children for subdirectories
        const pathParts = path.replace('/tmp/shadow-workspace/', '').split('/');
        let currentItems = mockFileSystem;
        
        for (const part of pathParts) {
          const item = currentItems.find(i => i.name === part && i.type === 'directory');
          if (item && item.children) {
            currentItems = item.children;
          }
        }
        
        setItems(currentItems);
      }
      
      // Send request via WebSocket if connected
      if (isConnected) {
        sendMessage({
          type: 'file_list',
          payload: { path }
        });
      }
      
    } catch (error) {
      console.error('Error loading directory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = async (item: FileSystemItem) => {
    setSelectedItem(item);
    
    if (item.type === 'directory') {
      setCurrentPath(item.path);
    } else {
      // Load file content
      setIsLoading(true);
      
      try {
        // Mock file content for demo
        const mockContent = `// ${item.name}
// This is a demo file content
// File path: ${item.path}

export default function ${item.name.replace(/\.[^/.]+$/, "")}() {
  console.log('Hello from ${item.name}');
  
  return {
    message: 'This is mock content for demonstration',
    timestamp: new Date().toISOString(),
    features: [
      'File reading',
      'Code syntax highlighting', 
      'Real-time editing',
      'Auto-save functionality'
    ]
  };
}`;

        setFileContent({
          content: mockContent,
          language: getLanguageFromExtension(item.name)
        });
        
        // Send file read request via WebSocket
        if (isConnected) {
          sendMessage({
            type: 'file_read',
            payload: { path: item.path }
          });
        }
        
      } catch (error) {
        console.error('Error reading file:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getLanguageFromExtension = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'py': return 'python';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'sql': return 'sql';
      default: return 'text';
    }
  };

  const getFileIcon = (item: FileSystemItem) => {
    if (item.type === 'directory') {
      return <FolderIcon className="h-5 w-5 text-blue-500" />;
    }
    
    const ext = item.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': case 'js': case 'jsx': case 'py':
        return <CodeBracketIcon className="h-5 w-5 text-green-500" />;
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg':
        return <PhotoIcon className="h-5 w-5 text-purple-500" />;
      default:
        return <DocumentIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const navigateUp = () => {
    const pathParts = currentPath.split('/');
    if (pathParts.length > 4) { // Don't go above workspace root
      pathParts.pop();
      setCurrentPath(pathParts.join('/'));
    }
  };

  const handleCreateItem = () => {
    if (!newItemName.trim()) return;
    
    // Mock creating item for demo
    const newItem: FileSystemItem = {
      name: newItemName,
      type: newItemType,
      path: `${currentPath}/${newItemName}`,
      size: newItemType === 'file' ? 0 : undefined,
      modified: new Date()
    };
    
    setItems(prev => [...prev, newItem]);
    setNewItemName('');
    setIsCreating(false);
    
    // Send create request via WebSocket
    if (isConnected) {
      sendMessage({
        type: 'file_create',
        payload: {
          path: newItem.path,
          type: newItemType,
          content: newItemType === 'file' ? '' : undefined
        }
      });
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full bg-shadow-950">
      {/* File Tree Panel */}
      <div className="w-1/2 border-r border-shadow-800 flex flex-col">
        {/* File Explorer Header */}
        <div className="p-4 border-b border-shadow-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">File Explorer</h2>
            <div className="flex space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => loadDirectory(currentPath)}
                className="p-2 bg-shadow-700 hover:bg-shadow-600 text-white rounded-lg transition-colors"
                title="Refresh"
              >
                <ArrowPathIcon className="h-4 w-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsCreating(true)}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                title="Create new file/folder"
              >
                <PlusIcon className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-shadow-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-10 pr-4 py-2 bg-shadow-800 border border-shadow-700 rounded-lg text-shadow-100 placeholder-shadow-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Path Navigation */}
        <div className="px-4 py-2 bg-shadow-900 border-b border-shadow-800">
          <div className="flex items-center space-x-2 text-sm">
            <button
              onClick={navigateUp}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              ↑
            </button>
            <span className="text-shadow-400">{currentPath}</span>
          </div>
        </div>

        {/* Create New Item Form */}
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 bg-shadow-900 border-b border-shadow-800"
          >
            <div className="space-y-3">
              <div className="flex space-x-2">
                <button
                  onClick={() => setNewItemType('file')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    newItemType === 'file' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-shadow-700 text-shadow-300 hover:bg-shadow-600'
                  }`}
                >
                  File
                </button>
                <button
                  onClick={() => setNewItemType('directory')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    newItemType === 'directory' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-shadow-700 text-shadow-300 hover:bg-shadow-600'
                  }`}
                >
                  Folder
                </button>
              </div>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`${newItemType === 'file' ? 'File' : 'Folder'} name...`}
                className="w-full px-3 py-2 bg-shadow-800 border border-shadow-700 rounded text-shadow-100 placeholder-shadow-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateItem()}
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateItem}
                  disabled={!newItemName.trim()}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-shadow-700 text-white rounded text-sm transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => { setIsCreating(false); setNewItemName(''); }}
                  className="px-3 py-1 bg-shadow-700 hover:bg-shadow-600 text-white rounded text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-shadow-400 mt-2">Loading...</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.path}
                  whileHover={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedItem?.path === item.path ? 'bg-blue-600/20 border border-blue-500/50' : ''
                  }`}
                >
                  {getFileIcon(item)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-shadow-100 truncate">
                      {item.name}
                    </p>
                    {item.size !== undefined && (
                      <p className="text-xs text-shadow-400">
                        {formatFileSize(item.size)}
                      </p>
                    )}
                  </div>
                  {item.type === 'directory' && (
                    <div className="text-shadow-400">→</div>
                  )}
                </motion.div>
              ))}
              
              {filteredItems.length === 0 && (
                <div className="p-8 text-center">
                  <FolderIcon className="h-12 w-12 text-shadow-600 mx-auto mb-3" />
                  <p className="text-shadow-400">
                    {searchQuery ? 'No files found matching your search' : 'This directory is empty'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* File Content Panel */}
      <div className="w-1/2 flex flex-col">
        {selectedItem ? (
          <>
            {/* File Header */}
            <div className="p-4 border-b border-shadow-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getFileIcon(selectedItem)}
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedItem.name}</h3>
                    <p className="text-sm text-shadow-400">{selectedItem.path}</p>
                  </div>
                </div>
                
                {selectedItem.type === 'file' && (
                  <div className="flex space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      title="Edit file"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      title="Delete file"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                )}
              </div>
            </div>

            {/* File Content */}
            <div className="flex-1 overflow-hidden">
              {selectedItem.type === 'directory' ? (
                <div className="p-8 text-center">
                  <FolderIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Directory Selected</h3>
                  <p className="text-shadow-400">
                    This is a directory. Click to navigate into it or select a file to view its contents.
                  </p>
                </div>
              ) : fileContent ? (
                <div className="h-full">
                  <div className="h-full bg-shadow-900 p-4 overflow-auto">
                    <pre className="text-sm text-shadow-100 font-mono whitespace-pre-wrap">
                      {fileContent.content}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-shadow-400 mt-2">Loading file content...</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <DocumentIcon className="h-16 w-16 text-shadow-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No File Selected</h3>
              <p className="text-shadow-400">
                Select a file or directory from the left panel to view its contents.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}