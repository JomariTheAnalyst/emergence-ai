'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface WebSocketContextType {
  ws: WebSocket | null;
  isConnected: boolean;
  sendMessage: (message: any) => void;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  onConnectionChange?: (connected: boolean) => void;
}

export function WebSocketProvider({ children, onConnectionChange }: WebSocketProviderProps) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    let websocket: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      try {
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          setWs(websocket);
          onConnectionChange?.(true);

          // Send authentication if we have user context
          websocket?.send(JSON.stringify({
            type: 'auth',
            payload: { userId: 'demo-user' } // For now, use demo user
          }));
        };

        websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('WebSocket message:', message);
            
            // Handle different message types
            switch (message.type) {
              case 'connection':
                console.log('Connected with client ID:', message.payload.clientId);
                break;
              case 'chat_response':
                // Dispatch custom event for chat response
                window.dispatchEvent(new CustomEvent('chat_response', { detail: message.payload }));
                break;
              case 'chat_error':
                window.dispatchEvent(new CustomEvent('chat_error', { detail: message.payload }));
                break;
              case 'tool_execution':
                // Handle tool execution updates
                break;
              case 'task_update':
                // Handle task updates
                break;
              default:
                console.log('Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        websocket.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          setWs(null);
          onConnectionChange?.(false);

          // Attempt to reconnect after 3 seconds
          reconnectTimer = setTimeout(connect, 3000);
        };

        websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
          setWs(null);
          onConnectionChange?.(false);
        };

      } catch (error) {
        console.error('Error creating WebSocket:', error);
        // Retry connection after 5 seconds
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (websocket) {
        websocket.close();
      }
    };
  }, [onConnectionChange]);

  const sendMessage = (message: any) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  };

  const subscribe = (channels: string[]) => {
    sendMessage({
      type: 'subscribe',
      payload: { channels }
    });
  };

  const unsubscribe = (channels: string[]) => {
    sendMessage({
      type: 'unsubscribe',
      payload: { channels }
    });
  };

  const value: WebSocketContextType = {
    ws,
    isConnected,
    sendMessage,
    subscribe,
    unsubscribe,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}