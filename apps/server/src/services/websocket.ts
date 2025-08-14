import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketMessage, ChatStreamEvent, ToolExecutionEvent, TaskUpdateEvent, TerminalOutputEvent } from '@shadow/types';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  taskId?: string;
  subscriptions: Set<string>;
}

export class WebSocketManager {
  private clients = new Map<string, ClientConnection>();
  private userConnections = new Map<string, Set<string>>();
  private taskConnections = new Map<string, Set<string>>();

  constructor(private wss: WebSocketServer) {
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      const clientId = uuidv4();
      const client: ClientConnection = {
        id: clientId,
        ws,
        subscriptions: new Set(),
      };

      this.clients.set(clientId, client);
      console.log(`WebSocket client connected: ${clientId}`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        payload: { clientId },
        timestamp: new Date(),
      });

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
          this.sendToClient(clientId, {
            type: 'error',
            payload: { error: 'Invalid message format' },
            timestamp: new Date(),
          });
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        this.handleClientDisconnect(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleClientDisconnect(clientId);
      });
    });
  }

  private handleClientMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'auth':
        this.handleAuth(clientId, message.payload);
        break;
      
      case 'subscribe':
        this.handleSubscribe(clientId, message.payload);
        break;
      
      case 'unsubscribe':
        this.handleUnsubscribe(clientId, message.payload);
        break;
      
      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          payload: {},
          timestamp: new Date(),
        });
        break;
      
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private handleAuth(clientId: string, payload: { userId: string; taskId?: string }) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.userId = payload.userId;
    client.taskId = payload.taskId;

    // Add to user connections
    if (!this.userConnections.has(payload.userId)) {
      this.userConnections.set(payload.userId, new Set());
    }
    this.userConnections.get(payload.userId)!.add(clientId);

    // Add to task connections if specified
    if (payload.taskId) {
      if (!this.taskConnections.has(payload.taskId)) {
        this.taskConnections.set(payload.taskId, new Set());
      }
      this.taskConnections.get(payload.taskId)!.add(clientId);
    }

    this.sendToClient(clientId, {
      type: 'auth_success',
      payload: { userId: payload.userId, taskId: payload.taskId },
      timestamp: new Date(),
    });

    console.log(`Client ${clientId} authenticated as user ${payload.userId}`);
  }

  private handleSubscribe(clientId: string, payload: { channels: string[] }) {
    const client = this.clients.get(clientId);
    if (!client) return;

    payload.channels.forEach(channel => {
      client.subscriptions.add(channel);
    });

    this.sendToClient(clientId, {
      type: 'subscription_success',
      payload: { channels: payload.channels },
      timestamp: new Date(),
    });
  }

  private handleUnsubscribe(clientId: string, payload: { channels: string[] }) {
    const client = this.clients.get(clientId);
    if (!client) return;

    payload.channels.forEach(channel => {
      client.subscriptions.delete(channel);
    });

    this.sendToClient(clientId, {
      type: 'unsubscription_success',
      payload: { channels: payload.channels },
      timestamp: new Date(),
    });
  }

  private handleClientDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from user connections
    if (client.userId) {
      const userClients = this.userConnections.get(client.userId);
      if (userClients) {
        userClients.delete(clientId);
        if (userClients.size === 0) {
          this.userConnections.delete(client.userId);
        }
      }
    }

    // Remove from task connections
    if (client.taskId) {
      const taskClients = this.taskConnections.get(client.taskId);
      if (taskClients) {
        taskClients.delete(clientId);
        if (taskClients.size === 0) {
          this.taskConnections.delete(client.taskId);
        }
      }
    }

    this.clients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  }

  // Public methods for sending messages

  public sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      return false;
    }
  }

  public sendToUser(userId: string, message: WebSocketMessage) {
    const userClients = this.userConnections.get(userId);
    if (!userClients) return 0;

    let sentCount = 0;
    userClients.forEach(clientId => {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  public sendToTask(taskId: string, message: WebSocketMessage) {
    const taskClients = this.taskConnections.get(taskId);
    if (!taskClients) return 0;

    let sentCount = 0;
    taskClients.forEach(clientId => {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  public broadcast(message: WebSocketMessage, filter?: (client: ClientConnection) => boolean) {
    let sentCount = 0;
    
    this.clients.forEach(client => {
      if (filter && !filter(client)) return;
      
      if (this.sendToClient(client.id, message)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  public sendChatStream(event: ChatStreamEvent, userId?: string, taskId?: string) {
    if (taskId) {
      return this.sendToTask(taskId, event);
    } else if (userId) {
      return this.sendToUser(userId, event);
    } else {
      return this.broadcast(event);
    }
  }

  public sendToolExecution(event: ToolExecutionEvent) {
    return this.sendToTask(event.payload.taskId, event);
  }

  public sendTaskUpdate(event: TaskUpdateEvent) {
    return this.sendToTask(event.payload.taskId, event);
  }

  public sendTerminalOutput(event: TerminalOutputEvent, userId?: string) {
    if (userId) {
      return this.sendToUser(userId, event);
    } else {
      return this.broadcast(event);
    }
  }

  // Utility methods

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public getConnectedUsers(): number {
    return this.userConnections.size;
  }

  public getActiveTasks(): number {
    return this.taskConnections.size;
  }

  public getClientInfo(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  public getUserClients(userId: string): string[] {
    const userClients = this.userConnections.get(userId);
    return userClients ? Array.from(userClients) : [];
  }

  public getTaskClients(taskId: string): string[] {
    const taskClients = this.taskConnections.get(taskId);
    return taskClients ? Array.from(taskClients) : [];
  }
}