'use client';

import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

interface ChatSession {
  id: string;
  name?: string;
  provider: string;
  model: string;
  totalTokens: number;
  totalCost: number;
  active: boolean;
  createdAt: string;
}

interface AgentConfig {
  provider: 'gemini' | 'openrouter';
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
}

interface ChatResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    parameters: any;
    result: any;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  model: string;
  finishReason: string;
}

interface StreamChunk {
  delta?: string;
  toolCalls?: any[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  finishReason?: string;
}

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const getApiUrl = () => {
    return process.env.NODE_ENV === 'development' 
      ? 'http://localhost:4000' 
      : process.env.REACT_APP_BACKEND_URL || '';
  };

  const createSession = useCallback(async (config: AgentConfig): Promise<string> => {
    try {
      setError(null);
      const response = await axios.post(`${getApiUrl()}/api/chat/sessions`, {
        config,
        workspaceDir: '/tmp/shadow-workspace', // TODO: Make configurable
      });

      const sessionId = response.data.sessionId;
      setCurrentSessionId(sessionId);
      
      // Refresh sessions list
      await loadSessions();
      
      return sessionId;
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to create chat session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const sendMessage = useCallback(async (
    sessionId: string, 
    message: string,
    usePrompt?: string,
    promptVariables?: Record<string, any>
  ): Promise<ChatResponse> => {
    try {
      setLoading(true);
      setError(null);

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await axios.post(`${getApiUrl()}/api/chat/sessions/${sessionId}/messages`, {
        message,
        usePrompt,
        promptVariables,
      }, {
        signal: controller.signal,
        timeout: 60000, // 60 second timeout
      });

      return response.data;
    } catch (err) {
      if (axios.isCancel(err)) {
        throw new Error('Request cancelled');
      }
      
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to send message';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const streamMessage = useCallback(async function* (
    sessionId: string, 
    message: string,
    usePrompt?: string,
    promptVariables?: Record<string, any>
  ): AsyncGenerator<StreamChunk> {
    try {
      setLoading(true);
      setError(null);

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(`${getApiUrl()}/api/chat/sessions/${sessionId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          usePrompt,
          promptVariables,
        }),
        signal: controller.signal,
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
            
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                return;
              }

              try {
                const chunk: StreamChunk = JSON.parse(data);
                yield chunk;
              } catch (parseError) {
                console.error('Failed to parse stream chunk:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to stream message';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const loadSessions = useCallback(async (): Promise<ChatSession[]> => {
    try {
      const response = await axios.get(`${getApiUrl()}/api/chat/sessions`);
      const sessions = response.data.sessions;
      setSessions(sessions);
      return sessions;
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to load sessions';
      setError(errorMessage);
      return [];
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      await axios.delete(`${getApiUrl()}/api/chat/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) 
        ? err.response?.data?.message || err.message 
        : 'Failed to delete session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [currentSessionId]);

  const getCurrentSession = useCallback((): ChatSession | null => {
    return sessions.find(s => s.id === currentSessionId) || null;
  }, [sessions, currentSessionId]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    // State
    sessions,
    currentSessionId,
    loading,
    error,

    // Actions
    createSession,
    sendMessage,
    streamMessage,
    loadSessions,
    deleteSession,
    getCurrentSession,
    cancelRequest,
    
    // Setters
    setCurrentSessionId,
    setError,
  };
}