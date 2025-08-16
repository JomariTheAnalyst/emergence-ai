import { useState, useEffect, useCallback, useRef } from 'react';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseWebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  onOpen?: (event: WebSocketEventMap['open']) => void;
  onClose?: (event: WebSocketEventMap['close']) => void;
  onMessage?: (event: WebSocketEventMap['message']) => void;
  onError?: (event: WebSocketEventMap['error']) => void;
}

export function useWebSocket({
  url = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`,
  reconnectInterval = 3000,
  reconnectAttempts = 5,
  onOpen,
  onClose,
  onMessage,
  onError,
}: UseWebSocketOptions = {}) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Clean up any existing connection
    if (websocketRef.current) {
      websocketRef.current.close();
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      setConnectionStatus('connecting');
      const ws = new WebSocket(url);
      websocketRef.current = ws;

      ws.onopen = (event) => {
        setConnectionStatus('connected');
        reconnectCountRef.current = 0;
        onOpen?.(event);
      };

      ws.onclose = (event) => {
        setConnectionStatus('disconnected');
        onClose?.(event);

        // Attempt to reconnect if not closed cleanly
        if (!event.wasClean && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onmessage = (event) => {
        setLastMessage(event.data);
        onMessage?.(event);
      };

      ws.onerror = (event) => {
        onError?.(event);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('disconnected');
    }
  }, [url, reconnectInterval, reconnectAttempts, onOpen, onClose, onMessage, onError]);

  // Send a message
  const sendMessage = useCallback(
    (message: string) => {
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(message);
        return true;
      }
      return false;
    },
    []
  );

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    connectionStatus,
    lastMessage,
    sendMessage,
    reconnect: connect,
  };
}

