'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
  id?: string;
}

interface UseWebSocketOptions {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    onConnect,
    onDisconnect,
    onMessage,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectCountRef = useRef(0);
  const messageHandlersRef = useRef<Map<string, (data: any) => void>>(new Map());

  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'development' 
      ? 'localhost:4000' 
      : window.location.host;
    return `${protocol}//${host}/ws`;
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionState('connecting');
    
    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionState('connected');
        reconnectCountRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle specific message types
          if (message.type && messageHandlersRef.current.has(message.type)) {
            messageHandlersRef.current.get(message.type)!(message.data);
          }
          
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionState('disconnected');
        wsRef.current = null;
        onDisconnect?.();

        // Attempt reconnection if not a manual close
        if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          console.log(`Attempting to reconnect (${reconnectCountRef.current}/${reconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval * reconnectCountRef.current);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionState('error');
        onError?.(error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionState('error');
    }
  }, [reconnectAttempts, reconnectInterval, onConnect, onDisconnect, onMessage, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionState('disconnected');
    reconnectCountRef.current = 0;
  }, []);

  const sendMessage = useCallback((type: string, data: any, id?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = { type, data, id };
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket is not connected. Message not sent:', { type, data, id });
    return false;
  }, []);

  const subscribe = useCallback((messageType: string, handler: (data: any) => void) => {
    messageHandlersRef.current.set(messageType, handler);
    
    return () => {
      messageHandlersRef.current.delete(messageType);
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionState,
    connect,
    disconnect,
    sendMessage,
    subscribe,
  };
}