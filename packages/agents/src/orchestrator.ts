import { z } from 'zod';
import { BaseLLMProvider, LLMMessage, LLMResponse, ToolCall } from './providers/base';
import { ToolRegistry, ToolResult, ToolExecutionContext } from '@shadow/tools/base/tool';
import { prisma } from '@shadow/db';

// Agent execution context
export interface AgentContext {
  userId: string;
  sessionId: string;
  workspaceDir?: string;
  repositoryId?: string;
  maxIterations?: number;
  maxTokens?: number;
  temperature?: number;
}

// Agent execution state
export interface AgentState {
  messages: LLMMessage[];
  toolCalls: Record<string, ToolResult>;
  iterations: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
}

// Agent execution result
export interface AgentResult {
  success: boolean;
  response?: string;
  state: AgentState;
  error?: string;
}

// Agent execution options
export interface AgentOptions {
  tools?: string[];
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
}

/**
 * Agent Orchestrator - Manages the execution of AI agents with tool calling capabilities
 */
export class AgentOrchestrator {
  private llmProvider: BaseLLMProvider;
  private toolRegistry: ToolRegistry;
  
  constructor(llmProvider: BaseLLMProvider, toolRegistry: ToolRegistry) {
    this.llmProvider = llmProvider;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Run an agent with a user query and execute tools as needed
   */
  async run(
    query: string,
    context: AgentContext,
    options: AgentOptions = {}
  ): Promise<AgentResult> {
    // Initialize agent state
    const state: AgentState = {
      messages: [],
      toolCalls: {},
      iterations: 0,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      cost: 0,
    };

    // Add system message if provided
    if (options.systemPrompt) {
      state.messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    } else {
      // Default system prompt
      state.messages.push({
        role: 'system',
        content: 'You are Shadow, an AI coding agent. You understand codebases, analyze code, generate solutions, debug issues, and help with development tasks. Be concise, accurate, and helpful. Use tools when appropriate to accomplish tasks.',
      });
    }

    // Add user query
    state.messages.push({
      role: 'user',
      content: query,
    });

    // Get available tools
    const availableTools = options.tools 
      ? this.toolRegistry.list().filter(tool => options.tools!.includes(tool.name))
      : this.toolRegistry.list();

    // Convert tools to LLM format
    const llmTools = availableTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters.shape as any,
      },
    }));

    // Set execution limits
    const maxIterations = options.maxIterations || context.maxIterations || 10;
    const maxTokens = options.maxTokens || context.maxTokens || 4000;
    const temperature = options.temperature || context.temperature || 0.7;
    const model = options.model || 'gemini-1.5-pro';

    try {
      // Execute agent loop
      while (state.iterations < maxIterations) {
        state.iterations++;

        // Call LLM
        const llmResponse = await this.llmProvider.chat(state.messages, {
          model,
          temperature,
          maxTokens,
          tools: llmTools,
        });

        // Update token usage
        state.tokenUsage.promptTokens += llmResponse.usage.promptTokens;
        state.tokenUsage.completionTokens += llmResponse.usage.completionTokens;
        state.tokenUsage.totalTokens += llmResponse.usage.totalTokens;
        
        // Calculate cost
        const responseCost = this.llmProvider.calculateCost(model, {
          promptTokens: llmResponse.usage.promptTokens,
          completionTokens: llmResponse.usage.completionTokens,
        });
        state.cost += responseCost;

        // Add assistant response to messages
        state.messages.push({
          role: 'assistant',
          content: llmResponse.content || '',
          toolCalls: llmResponse.toolCalls,
        });

        // If no tool calls, we're done
        if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
          return {
            success: true,
            response: llmResponse.content,
            state,
          };
        }

        // Execute tool calls
        for (const toolCall of llmResponse.toolCalls) {
          const toolResult = await this.executeToolCall(toolCall, context);
          
          // Add tool result to messages
          state.messages.push({
            role: 'tool',
            content: JSON.stringify(toolResult.data || toolResult.error),
            toolCallId: toolCall.id,
          });

          // Store tool result
          state.toolCalls[toolCall.id] = toolResult;
        }

        // Save to database
        await this.saveAgentInteraction(context.sessionId, state, model);
      }

      // If we reach here, we've hit the iteration limit
      return {
        success: false,
        error: 'Maximum iterations reached',
        state,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        state,
      };
    }
  }

  /**
   * Execute a tool call and return the result
   */
  private async executeToolCall(
    toolCall: ToolCall,
    context: AgentContext
  ): Promise<ToolResult> {
    try {
      // Parse tool call arguments
      const args = JSON.parse(toolCall.function.arguments);

      // Create tool execution context
      const toolContext: ToolExecutionContext = {
        userId: context.userId,
        sessionId: context.sessionId,
        workspaceDir: context.workspaceDir || '',
        repositoryId: context.repositoryId,
      };

      // Execute tool
      return await this.toolRegistry.execute(
        toolCall.function.name,
        args,
        toolContext
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Save agent interaction to database
   */
  private async saveAgentInteraction(
    sessionId: string,
    state: AgentState,
    model: string
  ): Promise<void> {
    try {
      // Get the session
      const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        console.error(`Session not found: ${sessionId}`);
        return;
      }

      // Update session token usage and cost
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          totalTokens: { increment: state.tokenUsage.totalTokens },
          totalCost: { increment: state.cost },
        },
      });

      // Save the last message
      const lastMessage = state.messages[state.messages.length - 1];
      
      // Create chat message
      await prisma.chatMessage.create({
        data: {
          content: lastMessage.content,
          role: lastMessage.role,
          tokens: lastMessage.role === 'assistant' ? state.tokenUsage.completionTokens : undefined,
          model,
          provider: this.llmProvider.getName(),
          sessionId,
          userId: session.userId,
          metadata: {
            toolCalls: lastMessage.toolCalls || [],
            tokenUsage: state.tokenUsage,
          },
        },
      });

      // Save tool calls if any
      if (lastMessage.toolCalls) {
        for (const toolCall of lastMessage.toolCalls) {
          const toolResult = state.toolCalls[toolCall.id];
          
          await prisma.toolCall.create({
            data: {
              name: toolCall.function.name,
              parameters: JSON.parse(toolCall.function.arguments),
              result: toolResult.data || null,
              error: toolResult.error || null,
              messageId: lastMessage.toolCallId || '',
            },
          });
        }
      }
    } catch (error) {
      console.error('Failed to save agent interaction:', error);
    }
  }
}

