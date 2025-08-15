'use client';

import { useState, useCallback } from 'react';
import axios from 'axios';

interface TerminalSession {
  id: string;
  workingDir: string;
  environment: Record<string, string>;
  active: boolean;
  createdAt: string;
}

interface CommandResult {
  output: string;
  exitCode: number;
  duration: number;
}

interface CommandHistory {
  command: string;
  result: CommandResult;
  timestamp: string;
}

export function useTerminal() {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getApiUrl = () => {
    return process.env.NODE_ENV === 'development' 
      ? 'http://localhost:4001' // Sidecar service
      : process.env.REACT_APP_SIDECAR_URL || '';
  };

  const createSession = useCallback(async (workingDir: string = '/tmp/shadow-workspace'): Promise<string> => {
    try {
      setError(null);
      setLoading(true);

      const response = await axios.post(`${getApiUrl()}/api/terminal/sessions`, {
        workingDir,
        environment: {
          HOME: workingDir,
          PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
          SHELL: '/bin/bash',
          TERM: 'xterm-256color',
        },
      });

      const session = response.data;
      setSessions(prev => [...prev, session]);
      
      return session.sessionId;
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to create terminal session';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const executeCommand = useCallback(async (
    sessionId: string, 
    command: string
  ): Promise<CommandResult> => {
    try {
      setError(null);

      const response = await axios.post(`${getApiUrl()}/api/terminal/sessions/${sessionId}/execute`, {
        command,
      });

      return response.data;
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to execute command';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const streamCommand = useCallback(async function* (
    sessionId: string, 
    command: string
  ): AsyncGenerator<{ type: 'stdout' | 'stderr'; data: string }> {
    try {
      setError(null);

      const response = await fetch(`${getApiUrl()}/api/terminal/sessions/${sessionId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            try {
              const data = JSON.parse(line);
              yield data;
            } catch (parseError) {
              console.error('Failed to parse stream data:', parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stream command';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const getSessionHistory = useCallback(async (sessionId: string): Promise<CommandHistory[]> => {
    try {
      setError(null);

      const response = await axios.get(`${getApiUrl()}/api/terminal/sessions/${sessionId}/history`);
      return response.data.history;
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to get session history';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const killSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      setError(null);

      await axios.delete(`${getApiUrl()}/api/terminal/sessions/${sessionId}`);
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to kill session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const listSessions = useCallback(async (): Promise<TerminalSession[]> => {
    try {
      setError(null);

      const response = await axios.get(`${getApiUrl()}/api/terminal/sessions`);
      const sessions = response.data.sessions;
      setSessions(sessions);
      
      return sessions;
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to list sessions';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const uploadFile = useCallback(async (
    sessionId: string,
    file: File,
    targetPath?: string
  ): Promise<{ path: string; size: number }> => {
    try {
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      if (targetPath) {
        formData.append('targetPath', targetPath);
      }

      const response = await axios.post(
        `${getApiUrl()}/api/terminal/sessions/${sessionId}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to upload file';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const downloadFile = useCallback(async (
    sessionId: string,
    filePath: string
  ): Promise<Blob> => {
    try {
      setError(null);

      const response = await axios.get(
        `${getApiUrl()}/api/terminal/sessions/${sessionId}/download`,
        {
          params: { path: filePath },
          responseType: 'blob',
        }
      );

      return response.data;
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to download file';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  return {
    // State
    sessions,
    loading,
    error,

    // Actions
    createSession,
    executeCommand,
    streamCommand,
    getSessionHistory,
    killSession,
    listSessions,
    uploadFile,
    downloadFile,

    // Setters
    setError,
  };
}