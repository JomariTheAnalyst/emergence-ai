import { BaseLLMProvider, LLMMessage, LLMConfig, ToolDefinition } from './providers/base';
import { GeminiProvider } from './providers/gemini';
import { OpenRouterProvider } from './providers/openrouter';
import { toolRegistry } from '@shadow/tools';
import { PromptOrchestrator, PromptExecutionContext } from '@shadow/prompts';
import { prisma } from '@shadow/db';

export interface AgentConfig {
  provider: 'gemini' | 'openrouter';
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[]; // Tool names to make available
}

export interface AgentSession {
  id: string;
  userId: string;
  config: AgentConfig;
  context: {
    workspaceDir: string;
    repositoryId?: string;
    memories: Map<string, any>;
  };
  messages: LLMMessage[];
}

export interface AgentResponse {
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

export class AgentManager {
  private providers = new Map<string, BaseLLMProvider>();
  private sessions = new Map<string, AgentSession>();
  private promptOrchestrator: PromptOrchestrator;

  constructor() {
    this.promptOrchestrator = new PromptOrchestrator();
  }

  // Initialize providers with API keys
  async initialize(config: {
    gemini?: { apiKey: string };
    openrouter?: { apiKey: string };
  }) {
    if (config.gemini) {
      this.providers.set('gemini', new GeminiProvider(config.gemini.apiKey));
    }
    
    if (config.openrouter) {
      this.providers.set('openrouter', new OpenRouterProvider(config.openrouter.apiKey));
    }
  }

  // Create a new agent session
  async createSession(
    userId: string,
    config: AgentConfig,
    workspaceDir: string,
    repositoryId?: string
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Load user memories for this repository
    const memories = new Map<string, any>();
    if (repositoryId) {
      const userMemories = await prisma.memory.findMany({
        where: { userId, repositoryId },
        orderBy: { lastAccess: 'desc' },
        take: 50, // Limit to most recent/relevant memories
      });

      userMemories.forEach(memory => {
        memories.set(memory.title, {
          content: memory.content,
          type: memory.type,
          importance: memory.importance,
          tags: memory.tags,
        });
      });
    }

    const session: AgentSession = {
      id: sessionId,
      userId,
      config,
      context: {
        workspaceDir,
        repositoryId,
        memories,
      },
      messages: [],
    };

    this.sessions.set(sessionId, session);

    // Create database record
    await prisma.agentSession.create({
      data: {
        id: sessionId,
        userId,
        provider: config.provider,
        model: config.model,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 4000,
      },
    });

    return sessionId;
  }

  // Send a message to an agent
  async sendMessage(
    sessionId: string,
    message: string,
    usePrompt?: string,
    promptVariables?: Record<string, any>
  ): Promise<AgentResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const provider = this.providers.get(session.config.provider);
    if (!provider) {
      throw new Error(`Provider ${session.config.provider} not available`);
    }

    // Use prompt orchestrator if specified
    let finalMessage = message;
    if (usePrompt) {
      const promptResult = await this.promptOrchestrator.execute(usePrompt, {
        userId: session.userId,
        sessionId,
        repositoryId: session.context.repositoryId,
        workspaceDir: session.context.workspaceDir,
        variables: { ...promptVariables, user_message: message },
        memories: session.context.memories,
      });

      if (!promptResult.success) {
        throw new Error(`Prompt execution failed: ${promptResult.error}`);
      }

      finalMessage = promptResult.content || message;

      // Update memories if any were saved
      if (promptResult.memories) {
        Object.entries(promptResult.memories).forEach(([key, value]) => {
          session.context.memories.set(key, value);
        });
      }
    }

    // Add user message to session
    const userMessage: LLMMessage = {
      role: 'user',
      content: finalMessage,
    };
    session.messages.push(userMessage);

    // Prepare LLM configuration
    const llmConfig: LLMConfig = {
      model: session.config.model,
      temperature: session.config.temperature,
      maxTokens: session.config.maxTokens,
      tools: this.getToolDefinitions(session.config.tools),
    };

    // Get response from LLM
    const response = await provider.chat(session.messages, llmConfig);

    // Add assistant response to session
    const assistantMessage: LLMMessage = {
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
    };
    session.messages.push(assistantMessage);

    // Execute tool calls if present
    const toolResults: Array<{ name: string; parameters: any; result: any }> = [];
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const toolCall of response.toolCalls) {
        try {
          const toolResult = await toolRegistry.execute(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            {
              workspaceDir: session.context.workspaceDir,
              userId: session.userId,
              sessionId,
              repositoryId: session.context.repositoryId,
            }
          );

          toolResults.push({
            name: toolCall.function.name,
            parameters: JSON.parse(toolCall.function.arguments),
            result: toolResult,
          });

          // Add tool result message
          const toolMessage: LLMMessage = {
            role: 'tool',
            content: JSON.stringify(toolResult),
            name: toolCall.function.name,
            toolCallId: toolCall.id,
          };
          session.messages.push(toolMessage);

        } catch (error) {
          console.error(`Tool execution failed for ${toolCall.function.name}:`, error);
          toolResults.push({
            name: toolCall.function.name,
            parameters: JSON.parse(toolCall.function.arguments),
            result: { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
          });
        }
      }

      // If tools were called, get another response from the LLM
      if (toolResults.length > 0) {
        const followupResponse = await provider.chat(session.messages, llmConfig);
        
        // Update the final response
        response.content = followupResponse.content;
        response.usage.promptTokens += followupResponse.usage.promptTokens;
        response.usage.completionTokens += followupResponse.usage.completionTokens;
        response.usage.totalTokens += followupResponse.usage.totalTokens;
        
        // Add final assistant response
        session.messages.push({
          role: 'assistant',
          content: followupResponse.content,
        });
      }
    }

    // Calculate cost
    const cost = provider.calculateCost(session.config.model, response.usage);

    // Save message to database
    await prisma.chatMessage.create({
      data: {
        content: finalMessage,
        role: 'user',
        userId: session.userId,
        sessionId,
      },
    });

    await prisma.chatMessage.create({
      data: {
        content: response.content,
        role: 'assistant',
        userId: session.userId,
        sessionId,
        tokens: response.usage.completionTokens,
        model: session.config.model,
        provider: session.config.provider,
      },
    });

    // Update session totals
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        totalTokens: { increment: response.usage.totalTokens },
        totalCost: { increment: cost },
        updatedAt: new Date(),
      },
    });

    // Track API usage
    await prisma.aPIUsage.create({
      data: {
        provider: session.config.provider,
        model: session.config.model,
        operation: 'chat',
        tokens: response.usage.totalTokens,
        cost,
        success: true,
      },
    });

    return {
      content: response.content,
      toolCalls: toolResults.length > 0 ? toolResults : undefined,
      usage: {
        ...response.usage,
        estimatedCost: cost,
      },
      model: response.model,
      finishReason: response.finishReason,
    };
  }

  // Stream a message to an agent
  async *streamMessage(
    sessionId: string,
    message: string,
    usePrompt?: string,
    promptVariables?: Record<string, any>
  ): AsyncGenerator<{
    delta?: string;
    toolCalls?: any[];
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number };
    finishReason?: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const provider = this.providers.get(session.config.provider);
    if (!provider) {
      throw new Error(`Provider ${session.config.provider} not available`);
    }

    // Process prompt if specified (similar to sendMessage)
    let finalMessage = message;
    if (usePrompt) {
      const promptResult = await this.promptOrchestrator.execute(usePrompt, {
        userId: session.userId,
        sessionId,
        repositoryId: session.context.repositoryId,
        workspaceDir: session.context.workspaceDir,
        variables: { ...promptVariables, user_message: message },
        memories: session.context.memories,
      });

      if (promptResult.success && promptResult.content) {
        finalMessage = promptResult.content;
      }
    }

    // Add user message
    const userMessage: LLMMessage = {
      role: 'user',
      content: finalMessage,
    };
    session.messages.push(userMessage);

    const llmConfig: LLMConfig = {
      model: session.config.model,
      temperature: session.config.temperature,
      maxTokens: session.config.maxTokens,
      tools: this.getToolDefinitions(session.config.tools),
    };

    let fullContent = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // Stream response from LLM
    for await (const chunk of provider.stream(session.messages, llmConfig)) {
      if (chunk.delta) {
        fullContent += chunk.delta;
        yield { delta: chunk.delta };
      }

      if (chunk.toolCalls) {
        yield { toolCalls: chunk.toolCalls };
      }

      if (chunk.usage) {
        usage = chunk.usage;
      }

      if (chunk.finishReason) {
        const cost = provider.calculateCost(session.config.model, usage);
        yield {
          usage: { ...usage, estimatedCost: cost },
          finishReason: chunk.finishReason,
        };
      }
    }

    // Add assistant message to session
    session.messages.push({
      role: 'assistant',
      content: fullContent,
    });

    // Save to database (similar to sendMessage)
    await this.saveMessagesToDatabase(session, finalMessage, fullContent, usage);
  }

  // Get available tools as LLM tool definitions
  private getToolDefinitions(toolNames?: string[]): ToolDefinition[] {
    if (!toolNames || toolNames.length === 0) {
      // Return all available tools
      return toolRegistry.list().map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: {}, // TODO: Convert Zod schema to JSON schema
            required: [],
          },
        },
      }));
    }

    // Return only specified tools
    return toolNames
      .map(name => toolRegistry.get(name))
      .filter(tool => tool !== undefined)
      .map(tool => ({
        type: 'function',
        function: {
          name: tool!.definition.name,
          description: tool!.definition.description,
          parameters: {
            type: 'object',
            properties: {}, // TODO: Convert Zod schema
            required: [],
          },
        },
      }));
  }

  private async saveMessagesToDatabase(
    session: AgentSession,
    userMessage: string,
    assistantMessage: string,
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  ) {
    const cost = this.providers.get(session.config.provider)!.calculateCost(session.config.model, usage);

    await prisma.chatMessage.createMany({
      data: [
        {
          content: userMessage,
          role: 'user',
          userId: session.userId,
          sessionId: session.id,
        },
        {
          content: assistantMessage,
          role: 'assistant',
          userId: session.userId,
          sessionId: session.id,
          tokens: usage.completionTokens,
          model: session.config.model,
          provider: session.config.provider,
        },
      ],
    });

    await prisma.agentSession.update({
      where: { id: session.id },
      data: {
        totalTokens: { increment: usage.totalTokens },
        totalCost: { increment: cost },
        updatedAt: new Date(),
      },
    });
  }

  // Get session info
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  // List user sessions
  async getUserSessions(userId: string): Promise<Array<{
    id: string;
    name?: string;
    provider: string;
    model: string;
    totalTokens: number;
    totalCost: number;
    active: boolean;
    createdAt: Date;
  }>> {
    const sessions = await prisma.agentSession.findMany({
      where: { userId, active: true },
      orderBy: { updatedAt: 'desc' },
    });

    return sessions.map(s => ({
      id: s.id,
      name: s.name,
      provider: s.provider,
      model: s.model,
      totalTokens: s.totalTokens,
      totalCost: s.totalCost,
      active: s.active,
      createdAt: s.createdAt,
    }));
  }

  // Close session
  async closeSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { active: false },
    });
  }
}