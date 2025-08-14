// Core types for the Shadow platform
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  private: boolean;
  defaultBranch: string;
  owner: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  repositoryId: string;
  userId: string;
  assignedAgent?: string;
  progress: number;
  logs: TaskLog[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface TaskLog {
  id: string;
  taskId: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  taskId?: string;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  timestamp: Date;
}

export interface Memory {
  id: string;
  repositoryId: string;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export enum MemoryType {
  CODEBASE_SUMMARY = 'CODEBASE_SUMMARY',
  IMPORTANT_FILE = 'IMPORTANT_FILE',
  ARCHITECTURAL_DECISION = 'ARCHITECTURAL_DECISION',
  BUG_REPORT = 'BUG_REPORT',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  GENERAL = 'GENERAL'
}

// WebSocket event types
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
}

export interface ChatStreamEvent extends WebSocketMessage {
  type: 'chat_stream';
  payload: {
    messageId: string;
    content: string;
    isComplete: boolean;
  };
}

export interface ToolExecutionEvent extends WebSocketMessage {
  type: 'tool_execution';
  payload: {
    toolCall: ToolCall;
    taskId: string;
  };
}

export interface TaskUpdateEvent extends WebSocketMessage {
  type: 'task_update';
  payload: {
    taskId: string;
    status: TaskStatus;
    progress: number;
    message?: string;
  };
}

export interface TerminalOutputEvent extends WebSocketMessage {
  type: 'terminal_output';
  payload: {
    sessionId: string;
    output: string;
    isError: boolean;
  };
}

// File system types
export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: Date;
  permissions?: string;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  size: number;
}

// Tool system types
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, any>) => Promise<any>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

// Search types
export interface SearchResult {
  file: string;
  line: number;
  column?: number;
  content: string;
  context?: string[];
  score?: number;
}

export interface SemanticSearchResult extends SearchResult {
  similarity: number;
  embedding?: number[];
}

// Agent configuration
export interface AgentConfig {
  provider: 'anthropic' | 'openai' | 'openrouter';
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  tools: string[];
}

// Error types
export interface ShadowError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface ValidationError extends ShadowError {
  field: string;
  value: any;
  constraint: string;
}

export interface SecurityError extends ShadowError {
  operation: string;
  path?: string;
  reason: string;
}