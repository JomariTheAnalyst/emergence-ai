import React, { useState, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { MessageProps } from './Message';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { PlusCircle, Settings, RefreshCw, Download, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useWebSocket } from '../../hooks/useWebSocket';

export interface ChatInterfaceProps {
  sessionId?: string;
  repositoryId?: string;
  className?: string;
}

export function ChatInterface({
  sessionId: initialSessionId,
  repositoryId,
  className,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string>(initialSessionId || `session-${Date.now()}`);
  const [sessions, setSessions] = useState<Array<{ id: string; name: string }>>([]);
  const { sendMessage, lastMessage, connectionStatus } = useWebSocket();

  // Initialize sessions
  useEffect(() => {
    if (initialSessionId) {
      setSessions([{ id: initialSessionId, name: 'Current Session' }]);
    } else {
      setSessions([{ id: sessionId, name: 'New Session' }]);
    }
  }, [initialSessionId, sessionId]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const data = JSON.parse(lastMessage);

      switch (data.type) {
        case 'agent_typing':
          if (data.payload.sessionId === sessionId) {
            setIsTyping(data.payload.typing);
          }
          break;

        case 'agent_response':
          if (data.payload.sessionId === sessionId) {
            setIsTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: data.payload.message,
                timestamp: new Date(),
                toolCalls: data.payload.toolCalls,
              },
            ]);
          }
          break;

        case 'agent_error':
          if (data.payload.sessionId === sessionId) {
            setIsTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                role: 'system',
                content: `Error: ${data.payload.error}`,
                timestamp: new Date(),
              },
            ]);
          }
          break;

        case 'session_history':
          if (data.payload.sessionId === sessionId) {
            setMessages(
              data.payload.messages.map((msg: any) => ({
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp),
                toolCalls: msg.toolCalls,
              }))
            );
          }
          break;

        case 'sessions_list':
          setSessions(data.payload.sessions);
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [lastMessage, sessionId]);

  // Request session history when session changes
  useEffect(() => {
    if (connectionStatus === 'connected' && sessionId) {
      sendMessage(
        JSON.stringify({
          type: 'get_session_history',
          payload: {
            sessionId,
          },
        })
      );
    }
  }, [connectionStatus, sessionId, sendMessage]);

  // Handle sending a message
  const handleSendMessage = (content: string) => {
    // Add user message to the UI immediately
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content,
        timestamp: new Date(),
      },
    ]);

    // Send message to server
    sendMessage(
      JSON.stringify({
        type: 'user_message',
        payload: {
          sessionId,
          message: content,
          repositoryId,
        },
      })
    );

    // Show typing indicator
    setIsTyping(true);
  };

  // Handle file upload
  const handleSendFile = (file: File) => {
    // This would be implemented with actual file upload logic
    console.log('File upload:', file);
    
    // For now, just add a message about the file
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: `Uploaded file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
        timestamp: new Date(),
      },
    ]);
  };

  // Create a new session
  const handleNewSession = () => {
    const newSessionId = `session-${Date.now()}`;
    setSessionId(newSessionId);
    setMessages([]);
    setSessions((prev) => [...prev, { id: newSessionId, name: 'New Session' }]);
  };

  // Clear current session
  const handleClearSession = () => {
    setMessages([]);
    
    // Send clear session request to server
    sendMessage(
      JSON.stringify({
        type: 'clear_session',
        payload: {
          sessionId,
        },
      })
    );
  };

  return (
    <Card className={cn('flex h-full flex-col overflow-hidden', className)}>
      <CardHeader className="border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Chat</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleNewSession}>
              <PlusCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <Tabs defaultValue={sessionId} className="flex-1 overflow-hidden">
        <TabsList className="border-b px-4 py-2">
          {sessions.map((session) => (
            <TabsTrigger
              key={session.id}
              value={session.id}
              onClick={() => setSessionId(session.id)}
              className="data-[state=active]:bg-muted"
            >
              {session.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {sessions.map((session) => (
          <TabsContent
            key={session.id}
            value={session.id}
            className="flex h-full flex-col data-[state=inactive]:hidden"
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="text-sm text-muted-foreground">
                {connectionStatus === 'connected' ? (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                    Connecting...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Refresh
                </Button>
                <Button variant="ghost" size="sm">
                  <Download className="mr-1 h-4 w-4" />
                  Export
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearSession}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>

            <CardContent className="flex-1 overflow-hidden p-0">
              <div className="flex h-full flex-col">
                <MessageList
                  messages={session.id === sessionId ? messages : []}
                  isTyping={session.id === sessionId && isTyping}
                  className="flex-1"
                />
                <MessageInput
                  onSendMessage={handleSendMessage}
                  onSendFile={handleSendFile}
                  isDisabled={connectionStatus !== 'connected' || isTyping}
                  className="border-t"
                />
              </div>
            </CardContent>
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}

