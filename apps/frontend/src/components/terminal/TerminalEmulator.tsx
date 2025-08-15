'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { motion } from 'framer-motion';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Settings, 
  Plus, 
  X,
  Terminal as TerminalIcon,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTerminal } from '@/hooks/useTerminal';

// Import xterm CSS
import '@xterm/xterm/css/xterm.css';

interface TerminalSession {
  id: string;
  name: string;
  workingDir: string;
  active: boolean;
  lastActivity: Date;
}

interface TerminalTab {
  id: string;
  name: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  active: boolean;
}

export function TerminalEmulator() {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const { isConnected, sendMessage, subscribe } = useWebSocket();
  const { 
    createSession, 
    executeCommand, 
    getSessionHistory, 
    killSession 
  } = useTerminal();

  // Initialize default terminal tab
  useEffect(() => {
    if (tabs.length === 0) {
      createNewTab();
    }
  }, []);

  // Handle terminal output from WebSocket
  useEffect(() => {
    const unsubscribe = subscribe('terminal_output', (data: {
      sessionId: string;
      output: string;
      type: 'stdout' | 'stderr';
    }) => {
      const tab = tabs.find(t => t.id === data.sessionId);
      if (tab) {
        const color = data.type === 'stderr' ? '\x1b[31m' : '\x1b[37m';
        tab.terminal.write(`${color}${data.output}\x1b[0m`);
      }
    });

    return unsubscribe;
  }, [subscribe, tabs]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      tabs.forEach(tab => {
        if (tab.active && tab.fitAddon) {
          setTimeout(() => tab.fitAddon.fit(), 100);
        }
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tabs]);

  const createNewTab = useCallback(async () => {
    try {
      const sessionId = await createSession('/tmp/shadow-workspace');
      const terminal = new Terminal({
        theme: {
          background: '#0f172a',
          foreground: '#e2e8f0',
          cursor: '#3b82f6',
          selection: '#374151',
          black: '#1e293b',
          red: '#ef4444',
          green: '#10b981',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#8b5cf6',
          cyan: '#06b6d4',
          white: '#f1f5f9',
        },
        fontSize: 14,
        fontFamily: 'JetBrains Mono, monospace',
        cursorBlink: true,
        rows: 24,
        cols: 80,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      // Handle user input
      let currentLine = '';
      terminal.onData((data) => {
        switch (data) {
          case '\r': // Enter key
            terminal.write('\r\n');
            if (currentLine.trim()) {
              executeCommand(sessionId, currentLine.trim());
            }
            currentLine = '';
            break;
            
          case '\u007f': // Backspace
            if (currentLine.length > 0) {
              currentLine = currentLine.slice(0, -1);
              terminal.write('\b \b');
            }
            break;
            
          case '\u0003': // Ctrl+C
            terminal.write('^C\r\n$ ');
            currentLine = '';
            break;
            
          default:
            if (data >= ' ' || data === '\t') {
              currentLine += data;
              terminal.write(data);
            }
        }
      });

      const newTab: TerminalTab = {
        id: sessionId,
        name: `Terminal ${tabs.length + 1}`,
        terminal,
        fitAddon,
        active: false,
      };

      setTabs(prev => [...prev, newTab]);
      setActiveTabId(sessionId);

      // Welcome message
      terminal.write('\x1b[32mWelcome to Shadow Terminal\x1b[0m\r\n');
      terminal.write('Type your commands below.\r\n\r\n$ ');

    } catch (error) {
      console.error('Failed to create terminal session:', error);
    }
  }, [tabs, createSession, executeCommand]);

  const closeTab = useCallback(async (tabId: string) => {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = tabs[tabIndex];
    tab.terminal.dispose();
    
    try {
      await killSession(tabId);
    } catch (error) {
      console.error('Failed to kill terminal session:', error);
    }

    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    // Switch to another tab if the closed tab was active
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        setActiveTabId(newTabs[0].id);
      } else {
        setActiveTabId(null);
      }
    }
  }, [tabs, activeTabId, killSession]);

  const switchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    
    // Hide all terminals
    tabs.forEach(tab => {
      const element = document.getElementById(`terminal-${tab.id}`);
      if (element) {
        element.style.display = 'none';
      }
    });

    // Show active terminal
    setTimeout(() => {
      const activeElement = document.getElementById(`terminal-${tabId}`);
      if (activeElement) {
        activeElement.style.display = 'block';
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
          tab.fitAddon.fit();
          tab.terminal.focus();
        }
      }
    }, 100);
  }, [tabs]);

  // Render terminal in container when active tab changes
  useEffect(() => {
    if (!activeTabId || !terminalContainerRef.current) return;

    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    const container = terminalContainerRef.current;
    
    // Clear container
    container.innerHTML = '';
    
    // Create terminal element
    const terminalElement = document.createElement('div');
    terminalElement.id = `terminal-${activeTab.id}`;
    terminalElement.style.width = '100%';
    terminalElement.style.height = '100%';
    container.appendChild(terminalElement);

    // Open terminal
    activeTab.terminal.open(terminalElement);
    
    // Fit to container
    setTimeout(() => {
      activeTab.fitAddon.fit();
      activeTab.terminal.focus();
    }, 100);

    return () => {
      activeTab.terminal.blur();
    };
  }, [activeTabId, tabs, isMaximized]);

  const clearTerminal = useCallback(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
      activeTab.terminal.clear();
      activeTab.terminal.write('$ ');
    }
  }, [tabs, activeTabId]);

  const restartSession = useCallback(async () => {
    if (!activeTabId) return;

    try {
      await killSession(activeTabId);
      const newSessionId = await createSession('/tmp/shadow-workspace');
      
      const tab = tabs.find(t => t.id === activeTabId);
      if (tab) {
        tab.terminal.clear();
        tab.terminal.write('\x1b[32mSession restarted\x1b[0m\r\n$ ');
      }
    } catch (error) {
      console.error('Failed to restart session:', error);
    }
  }, [activeTabId, tabs, killSession, createSession]);

  return (
    <div className={cn(
      "flex flex-col h-full bg-background",
      isMaximized && "fixed inset-0 z-50 bg-background"
    )}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-2">
          {/* Tab Bar */}
          <div className="flex items-center space-x-1 flex-1">
            {tabs.map((tab) => (
              <motion.div
                key={tab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant={activeTabId === tab.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => switchTab(tab.id)}
                  className="h-8 px-3 text-xs group relative"
                >
                  <TerminalIcon className="h-3 w-3 mr-1" />
                  {tab.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="ml-2 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Button>
              </motion.div>
            ))}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={createNewTab}
              className="h-8 w-8 p-0"
              title="New Terminal"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearTerminal}
              className="h-8 w-8 p-0"
              title="Clear Terminal"
              disabled={!activeTabId}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={restartSession}
              className="h-8 w-8 p-0"
              title="Restart Session"
              disabled={!activeTabId}
            >
              <Square className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMaximized(!isMaximized)}
              className="h-8 w-8 p-0"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8 w-8 p-0"
              title="Settings"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="px-4 py-1 text-xs text-muted-foreground border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-500" : "bg-red-500"
              )}></div>
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              {activeTabId && (
                <>
                  <span>•</span>
                  <span>Session: {activeTabId.substring(0, 8)}...</span>
                </>
              )}
            </div>
            
            {tabs.length > 0 && (
              <span>{tabs.length} terminal{tabs.length !== 1 ? 's' : ''} active</span>
            )}
          </div>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 bg-slate-900 overflow-hidden">
        {tabs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <TerminalIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Terminal Sessions</h3>
              <p className="text-muted-foreground mb-4">
                Create a new terminal session to get started
              </p>
              <Button onClick={createNewTab}>
                <Plus className="h-4 w-4 mr-2" />
                New Terminal
              </Button>
            </div>
          </div>
        ) : (
          <div 
            ref={terminalContainerRef}
            className="w-full h-full"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 border-t border-border bg-card/30 px-4 py-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>Working Directory: /tmp/shadow-workspace</span>
            <span>Shell: bash</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span>Press Ctrl+C to interrupt</span>
            <span>•</span>
            <span>Press Ctrl+D to exit</span>
          </div>
        </div>
      </div>
    </div>
  );
}