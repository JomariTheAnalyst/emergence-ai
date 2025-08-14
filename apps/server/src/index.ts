import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

import { authRoutes } from './routes/auth';
import { taskRoutes } from './routes/tasks';
import { repositoryRoutes } from './routes/repositories';
import { chatRoutes } from './routes/chat';
import { healthRoutes } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { WebSocketManager } from './services/websocket';
import { AgentOrchestrator } from './services/agent';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/repositories', repositoryRoutes);
app.use('/api/chat', chatRoutes);

// Error handling
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Initialize WebSocket manager
const wsManager = new WebSocketManager(wss);

// Initialize agent orchestrator
const agentOrchestrator = new AgentOrchestrator(wsManager);

// Start server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Agent mode: ${process.env.AGENT_MODE}`);
  console.log(`Workspace: ${process.env.WORKSPACE_DIR}`);
  console.log(`Sidecar URL: ${process.env.SIDECAR_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

export default app;