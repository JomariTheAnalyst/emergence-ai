'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { motion } from 'framer-motion';
import { 
  PlayIcon, 
  StopIcon, 
  ArrowPathIcon,
  TrashIcon 
} from '@heroicons/react/24/outline';
import { useWebSocket } from '@/providers/WebSocketProvider';

export function TerminalEmulator() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const [workingDir, setWorkingDir] = useState('/tmp/shadow-workspace');
  const { isConnected, sendMessage } = useWebSocket();

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    terminal.current = new Terminal({
      theme: {
        background: 'transparent',
        foreground: '#f8fafc',
        cursor: '#64748b',
        cursorAccent: '#0f172a',
        selection: '#334155',
        black: '#0f172a',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontFamily: 'var(--font-mono), Monaco, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
    });

    // Initialize addons
    fitAddon.current = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(webLinksAddon);

    // Open terminal
    terminal.current.open(terminalRef.current);
    fitAddon.current.fit();

    // Welcome message
    terminal.current.writeln('\x1b[1;32m╭─ Shadow Terminal Emulator\x1b[0m');
    terminal.current.writeln('\x1b[1;32m│\x1b[0m  Connected to workspace: \x1b[1;34m/tmp/shadow-workspace\x1b[0m');
    terminal.current.writeln('\x1b[1;32m│\x1b[0m  Type commands below or use the input field');
    terminal.current.writeln('\x1b[1;32m╰─\x1b[0m');
    terminal.current.writeln('');
    terminal.current.write('\x1b[1;36mshadow@workspace\x1b[0m:\x1b[1;34m~\x1b[0m$ ');

    // Handle input
    let currentInput = '';
    terminal.current.onData((data) => {
      const char = data;
      
      // Handle special keys
      if (char === '\r') { // Enter
        terminal.current?.writeln('');
        if (currentInput.trim()) {
          executeCommand(currentInput.trim());
        }
        currentInput = '';
        return;
      }
      
      if (char === '\u007f') { // Backspace
        if (currentInput.length > 0) {
          currentInput = currentInput.slice(0, -1);
          terminal.current?.write('\b \b');
        }
        return;
      }
      
      if (char === '\u0003') { // Ctrl+C
        terminal.current?.writeln('^C');
        terminal.current?.write('\x1b[1;36mshadow@workspace\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
        currentInput = '';
        return;
      }
      
      // Regular characters
      if (char.charCodeAt(0) >= 32) {
        currentInput += char;
        terminal.current?.write(char);
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.current?.dispose();
    };
  }, []);

  const executeCommand = async (command: string) => {
    setIsRunning(true);
    setCurrentCommand(command);
    
    // Mock command execution for demo
    try {
      // Show command being executed
      terminal.current?.writeln(`\x1b[1;33mExecuting:\x1b[0m ${command}`);
      
      // Simulate some output based on command
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (command.startsWith('ls')) {
        terminal.current?.writeln('README.md');
        terminal.current?.writeln('package.json');
        terminal.current?.writeln('src/');
        terminal.current?.writeln('node_modules/');
      } else if (command.startsWith('pwd')) {
        terminal.current?.writeln(workingDir);
      } else if (command.startsWith('echo')) {
        const message = command.substring(5);
        terminal.current?.writeln(message);
      } else if (command === 'clear') {
        terminal.current?.clear();
      } else if (command === 'help') {
        terminal.current?.writeln('Available commands:');
        terminal.current?.writeln('  ls       - List directory contents');
        terminal.current?.writeln('  pwd      - Print working directory');
        terminal.current?.writeln('  echo     - Display message');
        terminal.current?.writeln('  clear    - Clear terminal');
        terminal.current?.writeln('  help     - Show this help');
      } else {
        terminal.current?.writeln(`\x1b[1;31mCommand not found:\x1b[0m ${command}`);
        terminal.current?.writeln('Type "help" for available commands');
      }
      
      // Send command via WebSocket if connected
      if (isConnected) {
        sendMessage({
          type: 'terminal_command',
          payload: {
            command,
            workingDir,
            sessionId: 'demo-session'
          }
        });
      }
      
    } catch (error) {
      terminal.current?.writeln(`\x1b[1;31mError:\x1b[0m ${error}`);
    } finally {
      setIsRunning(false);
      setCurrentCommand('');
      terminal.current?.write('\x1b[1;36mshadow@workspace\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
    }
  };

  const handleClear = () => {
    terminal.current?.clear();
    terminal.current?.write('\x1b[1;36mshadow@workspace\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
  };

  const handleStop = () => {
    if (isRunning) {
      terminal.current?.writeln('');
      terminal.current?.writeln('\x1b[1;31m^C Process interrupted\x1b[0m');
      terminal.current?.write('\x1b[1;36mshadow@workspace\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
      setIsRunning(false);
      setCurrentCommand('');
    }
  };

  const handleRestart = () => {
    handleClear();
    terminal.current?.writeln('\x1b[1;32m╭─ Shadow Terminal Emulator\x1b[0m');
    terminal.current?.writeln('\x1b[1;32m│\x1b[0m  Terminal restarted');
    terminal.current?.writeln('\x1b[1;32m╰─\x1b[0m');
    terminal.current?.writeln('');
    terminal.current?.write('\x1b[1;36mshadow@workspace\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
  };

  return (
    <div className="flex flex-col h-full bg-shadow-950">
      {/* Terminal Header */}
      <div className="flex items-center justify-between p-4 border-b border-shadow-800">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Terminal</h2>
            <p className="text-sm text-shadow-400">{workingDir}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isRunning && (
            <div className="flex items-center space-x-2 text-sm text-yellow-400">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              <span>Running: {currentCommand}</span>
            </div>
          )}
          
          <div className="flex space-x-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStop}
              disabled={!isRunning}
              className="p-2 bg-red-600 hover:bg-red-700 disabled:bg-shadow-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
              title="Stop current process"
            >
              <StopIcon className="h-4 w-4" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRestart}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
              title="Restart terminal"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClear}
              className="p-2 bg-shadow-700 hover:bg-shadow-600 text-white rounded-lg transition-colors duration-200"
              title="Clear terminal"
            >
              <TrashIcon className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 p-4 bg-shadow-950">
        <div
          ref={terminalRef}
          className="w-full h-full rounded-lg bg-shadow-900/50 border border-shadow-800 p-4"
          style={{ minHeight: '400px' }}
        />
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-shadow-900 border-t border-shadow-800 text-xs text-shadow-400">
        <div className="flex items-center justify-between">
          <span>Press Ctrl+C to interrupt, type "help" for commands</span>
          <div className="flex items-center space-x-4">
            <span>Session: demo-session</span>
            <span className={`flex items-center space-x-1 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}