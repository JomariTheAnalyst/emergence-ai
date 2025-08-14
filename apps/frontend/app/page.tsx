'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ChatBubbleLeftRightIcon, 
  CommandLineIcon, 
  FolderIcon,
  CpuChipIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { TerminalEmulator } from '@/components/terminal/TerminalEmulator';
import { FileExplorer } from '@/components/files/FileExplorer';
import { TaskManager } from '@/components/tasks/TaskManager';
import { WebSocketProvider } from '@/providers/WebSocketProvider';

const tabs = [
  { id: 'chat', name: 'Chat', icon: ChatBubbleLeftRightIcon },
  { id: 'terminal', name: 'Terminal', icon: CommandLineIcon },
  { id: 'files', name: 'Files', icon: FolderIcon },
  { id: 'tasks', name: 'Tasks', icon: CpuChipIcon },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('chat');
  const [isConnected, setIsConnected] = useState(false);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatInterface />;
      case 'terminal':
        return <TerminalEmulator />;
      case 'files':
        return <FileExplorer />;
      case 'tasks':
        return <TaskManager />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <WebSocketProvider onConnectionChange={setIsConnected}>
      <div className="min-h-screen bg-gradient-to-br from-shadow-950 via-shadow-900 to-shadow-950">
        {/* Header */}
        <header className="border-b border-shadow-800 bg-shadow-900/50 backdrop-blur-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <SparklesIcon className="h-8 w-8 text-blue-500" />
                  <div className="absolute inset-0 h-8 w-8 bg-blue-500/20 rounded-full animate-pulse"></div>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Shadow</h1>
                  <p className="text-sm text-shadow-400">AI Coding Agent</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm text-shadow-400">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex h-[calc(100vh-80px)]">
          {/* Sidebar Navigation */}
          <nav className="w-64 bg-shadow-900/30 border-r border-shadow-800 p-4">
            <div className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-shadow-300 hover:bg-shadow-800 hover:text-white'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{tab.name}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Agent Status */}
            <div className="mt-8 p-4 bg-shadow-800/50 rounded-lg">
              <h3 className="text-sm font-medium text-shadow-200 mb-2">Agent Status</h3>
              <div className="space-y-2 text-xs text-shadow-400">
                <div className="flex justify-between">
                  <span>Mode:</span>
                  <span className="text-shadow-300">Local</span>
                </div>
                <div className="flex justify-between">
                  <span>Workspace:</span>
                  <span className="text-shadow-300">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Tasks:</span>
                  <span className="text-shadow-300">0</span>
                </div>
              </div>
            </div>
          </nav>

          {/* Content Area */}
          <main className="flex-1 overflow-hidden">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {renderTabContent()}
            </motion.div>
          </main>
        </div>
      </div>
    </WebSocketProvider>
  );
}