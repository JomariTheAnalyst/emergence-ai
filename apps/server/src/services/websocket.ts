import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { llmService } from './llm';

interface Client {
  id: string;
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  lastSeen: Date;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  clientId?: string;
  timestamp?: string;
}

export class WebSocketManager {
  private clients: Map<string, Client> = new Map();
  private userClients: Map<string, Set<string>> = new Map();

  constructor(private wss: WebSocketServer) {
    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientId = uuidv4();
      
      const client: Client = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastSeen: new Date()
      };

      this.clients.set(clientId, client);
      console.log(`Client connected: ${clientId}`);

      // Send connection confirmation
      this.sendToClient(clientId, {
        type: 'connection',
        payload: { clientId, timestamp: new Date().toISOString() }
      });

      // Handle messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.sendToClient(clientId, {
            type: 'error',
            payload: { message: 'Invalid message format' }
          });
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        this.handleDisconnection(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleDisconnection(clientId);
      });
    });
  }

  private async handleMessage(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastSeen = new Date();

    try {
      switch (message.type) {
        case 'auth':
          await this.handleAuth(clientId, message.payload);
          break;
        
        case 'chat_message':
          await this.handleChatMessage(clientId, message.payload);
          break;
        
        case 'subscribe':
          this.handleSubscribe(clientId, message.payload);
          break;
        
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.payload);
          break;
        
        case 'terminal_command':
          await this.handleTerminalCommand(clientId, message.payload);
          break;
        
        case 'file_list':
        case 'file_read':
        case 'file_create':
          await this.handleFileOperation(clientId, message.type, message.payload);
          break;
        
        case 'task_create':
        case 'task_action':
          await this.handleTaskOperation(clientId, message.type, message.payload);
          break;

        case 'llm_config_update':
          await this.handleLLMConfigUpdate(clientId, message.payload);
          break;
        
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message type ${message.type}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        payload: { message: 'Failed to process message' }
      });
    }
  }

  private async handleAuth(clientId: string, payload: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { userId } = payload;
    client.userId = userId;

    // Track user clients
    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set());
    }
    this.userClients.get(userId)!.add(clientId);

    this.sendToClient(clientId, {
      type: 'auth_success',
      payload: { userId, clientId }
    });

    console.log(`Client ${clientId} authenticated as user ${userId}`);
  }

  private async handleChatMessage(clientId: string, payload: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { content, sessionId, config } = payload;
    
    try {
      // Send acknowledgment
      this.sendToClient(clientId, {
        type: 'chat_message_received',
        payload: { sessionId, timestamp: new Date().toISOString() }
      });

      // Get AI response
      const response = await llmService.sendChatMessage(
        sessionId || `session_${clientId}`,
        content,
        config
      );

      // Send AI response
      this.sendToClient(clientId, {
        type: 'chat_response',
        payload: {
          content: response,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          sessionId
        }
      });

    } catch (error) {
      console.error('Chat error:', error);
      this.sendToClient(clientId, {
        type: 'chat_error',
        payload: { message: 'Failed to get AI response' }
      });
    }
  }

  private handleSubscribe(clientId: string, payload: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = payload;
    channels.forEach((channel: string) => {
      client.subscriptions.add(channel);
    });

    this.sendToClient(clientId, {
      type: 'subscribed',
      payload: { channels }
    });
  }

  private handleUnsubscribe(clientId: string, payload: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = payload;
    channels.forEach((channel: string) => {
      client.subscriptions.delete(channel);
    });

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      payload: { channels }
    });
  }

  private async handleTerminalCommand(clientId: string, payload: any) {
    const { command, workingDir, sessionId } = payload;
    
    // Mock terminal execution for demo
    this.sendToClient(clientId, {
      type: 'terminal_output',
      payload: {
        sessionId,
        output: `$ ${command}\nExecuting command...\nCommand completed successfully.\n`,
        exitCode: 0
      }
    });
  }

  private async handleFileOperation(clientId: string, operation: string, payload: any) {
    // Mock file operations for demo
    switch (operation) {
      case 'file_list':
        this.sendToClient(clientId, {
          type: 'file_list_response',
          payload: {
            path: payload.path,
            files: [
              { name: 'README.md', type: 'file', size: 1024 },
              { name: 'src', type: 'directory' },
              { name: 'package.json', type: 'file', size: 512 }
            ]
          }
        });
        break;
      
      case 'file_read':
        this.sendToClient(clientId, {
          type: 'file_content',
          payload: {
            path: payload.path,
            content: '// Demo file content\nconsole.log("Hello from Shadow!");',
            language: 'javascript'
          }
        });
        break;
      
      case 'file_create':
        this.sendToClient(clientId, {
          type: 'file_created',
          payload: {
            path: payload.path,
            type: payload.type
          }
        });
        break;
    }
  }

  private async handleTaskOperation(clientId: string, operation: string, payload: any) {
    // Mock task operations for demo
    switch (operation) {
      case 'task_create':
        this.sendToClient(clientId, {
          type: 'task_created',
          payload: {
            ...payload,
            id: Date.now().toString(),
            status: 'pending',
            createdAt: new Date().toISOString()
          }
        });
        break;
      
      case 'task_action':
        this.sendToClient(clientId, {
          type: 'task_updated',
          payload: {
            taskId: payload.taskId,
            action: payload.action,
            timestamp: new Date().toISOString()
          }
        });
        break;
    }
  }

  private async handleLLMConfigUpdate(clientId: string, payload: any) {
    const { sessionId, config } = payload;
    
    try {
      llmService.updateConfig(sessionId || `session_${clientId}`, config);
      
      this.sendToClient(clientId, {
        type: 'llm_config_updated',
        payload: { 
          message: 'LLM configuration updated successfully',
          config 
        }
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'llm_config_error',
        payload: { message: 'Failed to update LLM configuration' }
      });
    }
  }

  private handleDisconnection(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from user clients
    if (client.userId) {
      const userClientSet = this.userClients.get(client.userId);
      if (userClientSet) {
        userClientSet.delete(clientId);
        if (userClientSet.size === 0) {
          this.userClients.delete(client.userId);
        }
      }
    }

    this.clients.delete(clientId);
    console.log(`Client disconnected: ${clientId}`);
  }

  private sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    }
  }

  public broadcast(message: WebSocketMessage, channel?: string) {
    this.clients.forEach((client, clientId) => {
      if (channel && !client.subscriptions.has(channel)) return;
      this.sendToClient(clientId, message);
    });
  }

  public sendToUser(userId: string, message: WebSocketMessage) {
    const userClientSet = this.userClients.get(userId);
    if (!userClientSet) return;

    userClientSet.forEach(clientId => {
      this.sendToClient(clientId, message);
    });
  }

  private startHeartbeat() {
    setInterval(() => {
      const now = new Date();
      const staleClients: string[] = [];

      this.clients.forEach((client, clientId) => {
        const timeSinceLastSeen = now.getTime() - client.lastSeen.getTime();
        
        if (timeSinceLastSeen > 5 * 60 * 1000) { // 5 minutes
          staleClients.push(clientId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          // Send ping
          client.ws.ping();
        }
      });

      // Remove stale clients
      staleClients.forEach(clientId => {
        this.handleDisconnection(clientId);
      });
    }, 30000); // Check every 30 seconds
  }

  public getStats() {
    return {
      totalClients: this.clients.size,
      authenticatedUsers: this.userClients.size,
      clientsByUser: Object.fromEntries(
        Array.from(this.userClients.entries()).map(([userId, clients]) => [userId, clients.size])
      )
    };
  }
}