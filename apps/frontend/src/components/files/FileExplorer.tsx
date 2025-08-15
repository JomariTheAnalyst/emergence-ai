'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, 
  File, 
  FolderOpen, 
  Plus, 
  MoreHorizontal,
  Search,
  RefreshCw,
  Upload,
  Download,
  Edit3,
  Trash2,
  Copy,
  Scissors,
  Eye,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn, formatBytes, formatDate } from '@/lib/utils';
import { FileEditor } from './FileEditor';
import { FileContextMenu } from './FileContextMenu';
import { useFiles } from '@/hooks/useFiles';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size: number;
  modified: string;
  children?: FileItem[];
  expanded?: boolean;
}

interface FileTab {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  modified: boolean;
  saved: boolean;
}

export function FileExplorer() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [openTabs, setOpenTabs] = useState<FileTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [contextMenuPath, setContextMenuPath] = useState<string | null>(null);
  const [workspaceDir] = useState('/tmp/shadow-workspace');
  const [showHidden, setShowHidden] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  const {
    loadDirectory,
    readFile,
    writeFile,
    createFile,
    createDirectory,
    deleteFile,
    moveFile,
    copyFile,
    searchFiles,
    watchFile,
    loading,
    error,
  } = useFiles();

  // Load initial directory structure
  useEffect(() => {
    loadDirectoryStructure(workspaceDir);
  }, [workspaceDir, showHidden]);

  const loadDirectoryStructure = useCallback(async (path: string) => {
    try {
      const items = await loadDirectory(path, true, showHidden);
      const fileTree = buildFileTree(items, path);
      setFiles(fileTree);
    } catch (err) {
      console.error('Failed to load directory:', err);
    }
  }, [loadDirectory, showHidden]);

  const buildFileTree = (items: any[], basePath: string): FileItem[] => {
    const tree: FileItem[] = [];
    const pathMap = new Map<string, FileItem>();

    // Sort items: directories first, then files
    items.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });

    items.forEach(item => {
      const fullPath = `${basePath}/${item.name}`.replace(/\/+/g, '/');
      const fileItem: FileItem = {
        ...item,
        path: fullPath,
        children: item.type === 'directory' ? [] : undefined,
        expanded: false,
      };

      pathMap.set(fullPath, fileItem);
      
      // Find parent directory
      const parentPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
      const parent = pathMap.get(parentPath);
      
      if (parent && parent.children) {
        parent.children.push(fileItem);
      } else if (parentPath === basePath || parentPath === '') {
        tree.push(fileItem);
      }
    });

    return tree;
  };

  const toggleDirectory = async (path: string) => {
    const updateExpansion = (items: FileItem[]): FileItem[] => {
      return items.map(item => {
        if (item.path === path && item.type === 'directory') {
          if (!item.expanded && (!item.children || item.children.length === 0)) {
            // Load directory contents
            loadDirectory(path, false, showHidden)
              .then(subItems => {
                const subFileTree = buildFileTree(subItems, path);
                setFiles(prev => updateChildren(prev, path, subFileTree));
              })
              .catch(console.error);
          }
          return { ...item, expanded: !item.expanded };
        }
        if (item.children) {
          return { ...item, children: updateExpansion(item.children) };
        }
        return item;
      });
    };

    setFiles(updateExpansion);
  };

  const updateChildren = (items: FileItem[], targetPath: string, newChildren: FileItem[]): FileItem[] => {
    return items.map(item => {
      if (item.path === targetPath) {
        return { ...item, children: newChildren, expanded: true };
      }
      if (item.children) {
        return { ...item, children: updateChildren(item.children, targetPath, newChildren) };
      }
      return item;
    });
  };

  const openFile = async (filePath: string) => {
    // Check if file is already open
    const existingTab = openTabs.find(tab => tab.path === filePath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    try {
      const result = await readFile(filePath);
      if (result.success) {
        const fileExtension = filePath.split('.').pop() || '';
        const language = getLanguageFromExtension(fileExtension);
        
        const newTab: FileTab = {
          id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: filePath.split('/').pop() || 'Untitled',
          path: filePath,
          content: result.data?.content || '',
          language,
          modified: false,
          saved: true,
        };

        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);

        // Start watching for file changes
        watchFile(filePath, (newContent) => {
          setOpenTabs(prev => prev.map(tab => 
            tab.path === filePath 
              ? { ...tab, content: newContent, saved: true, modified: false }
              : tab
          ));
        });
      }
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const closeTab = (tabId: string) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (tab?.modified) {
      const confirmed = window.confirm('File has unsaved changes. Close anyway?');
      if (!confirmed) return;
    }

    const newTabs = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(newTabs);

    if (activeTabId === tabId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  const saveFile = async (tabId: string) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (!tab) return;

    try {
      const result = await writeFile(tab.path, tab.content);
      if (result.success) {
        setOpenTabs(prev => prev.map(t => 
          t.id === tabId 
            ? { ...t, modified: false, saved: true }
            : t
        ));
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const saveAllFiles = async () => {
    const unsavedTabs = openTabs.filter(tab => tab.modified);
    for (const tab of unsavedTabs) {
      await saveFile(tab.id);
    }
  };

  const onFileContentChange = (tabId: string, content: string) => {
    setOpenTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, content, modified: true, saved: false }
        : tab
    ));
  };

  const getLanguageFromExtension = (extension: string): string => {
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
      'cfg': 'ini',
      'conf': 'ini',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      'ps1': 'powershell',
      'dockerfile': 'dockerfile',
      'docker': 'dockerfile',
    };
    
    return languageMap[extension.toLowerCase()] || 'plaintext';
  };

  const getFileIcon = (item: FileItem) => {
    if (item.type === 'directory') {
      return item.expanded ? (
        <FolderOpen className="h-4 w-4 text-blue-500" />
      ) : (
        <Folder className="h-4 w-4 text-blue-600" />
      );
    }

    const extension = item.name.split('.').pop()?.toLowerCase();
    const iconColor = {
      'js': 'text-yellow-500',
      'jsx': 'text-cyan-500',
      'ts': 'text-blue-600',
      'tsx': 'text-cyan-600',
      'py': 'text-green-600',
      'java': 'text-orange-600',
      'cpp': 'text-blue-700',
      'c': 'text-blue-700',
      'html': 'text-orange-500',
      'css': 'text-blue-500',
      'json': 'text-green-500',
      'md': 'text-gray-600',
    }[extension || ''] || 'text-gray-500';

    return <File className={cn("h-4 w-4", iconColor)} />;
  };

  const renderFileTree = (items: FileItem[], depth = 0): React.ReactNode => {
    return items.map((item) => (
      <motion.div
        key={item.path}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="select-none"
      >
        <div
          className={cn(
            "flex items-center space-x-2 px-2 py-1 hover:bg-muted rounded cursor-pointer group",
            selectedPath === item.path && "bg-muted",
            "text-sm"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            setSelectedPath(item.path);
            if (item.type === 'directory') {
              toggleDirectory(item.path);
            } else {
              openFile(item.path);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenuPath(item.path);
          }}
        >
          {getFileIcon(item)}
          <span className="flex-1 truncate">{item.name}</span>
          
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1">
            <span className="text-xs text-muted-foreground">
              {item.type === 'file' && formatBytes(item.size)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setContextMenuPath(item.path);
              }}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {item.type === 'directory' && item.expanded && item.children && (
          <AnimatePresence>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderFileTree(item.children, depth + 1)}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    ));
  };

  const filteredFiles = searchQuery 
    ? files.filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  return (
    <div className="flex h-full bg-background">
      {/* File Tree Sidebar */}
      <div className="w-80 border-r border-border bg-card/30 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Files</h2>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadDirectoryStructure(workspaceDir)}
                className="h-7 w-7 p-0"
                title="Refresh"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="New File"
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Settings"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading files...</span>
            </div>
          ) : error ? (
            <div className="text-sm text-destructive p-4">
              Error: {error}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 text-center">
              No files found
            </div>
          ) : (
            renderFileTree(filteredFiles)
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>{filteredFiles.length} items</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowHidden(!showHidden)}
                className={cn(
                  "px-2 py-1 rounded hover:bg-muted",
                  showHidden && "bg-muted"
                )}
              >
                {showHidden ? 'Hide hidden' : 'Show hidden'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Tab Bar */}
        {openTabs.length > 0 && (
          <div className="border-b border-border bg-card/30">
            <div className="flex items-center overflow-x-auto">
              {openTabs.map((tab) => (
                <motion.div
                  key={tab.id}
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 border-r border-border cursor-pointer text-sm group min-w-0 flex-shrink-0",
                    activeTabId === tab.id 
                      ? "bg-background text-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <File className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate max-w-32">{tab.name}</span>
                  {tab.modified && (
                    <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground rounded p-0.5 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
              
              {/* Actions */}
              <div className="flex items-center space-x-1 px-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={saveAllFiles}
                  className="h-7 text-xs"
                  disabled={!openTabs.some(tab => tab.modified)}
                >
                  Save All
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Editor Content */}
        <div className="flex-1">
          {activeTabId && openTabs.length > 0 ? (
            <FileEditor
              tab={openTabs.find(t => t.id === activeTabId)!}
              onContentChange={onFileContentChange}
              onSave={saveFile}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <File className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No file open</h3>
                <p className="text-muted-foreground">
                  Select a file from the explorer to start editing
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenuPath && (
        <FileContextMenu
          filePath={contextMenuPath}
          onClose={() => setContextMenuPath(null)}
          onAction={(action) => {
            // Handle file actions
            console.log('File action:', action, contextMenuPath);
            setContextMenuPath(null);
          }}
        />
      )}
    </div>
  );
}