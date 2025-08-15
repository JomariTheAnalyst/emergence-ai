import { createAgentOrchestrator } from '@shadow/agents';
import { OpenAIProvider } from '@shadow/agents/providers/openai';
import { AnthropicProvider } from '@shadow/agents/providers/anthropic';
import { GeminiProvider } from '@shadow/agents/providers/gemini';
import { OpenRouterProvider } from '@shadow/agents/providers/openrouter';
import { prisma } from '@shadow/db';

class LLMService {
  private apiKeys: Record<string, string> = {};
  private defaultProvider = 'gemini';
  private defaultModel = 'gemini-1.5-pro';

  constructor() {
    // Load API keys from environment variables
    this.apiKeys = {
      openai: process.env.OPENAI_API_KEY || '',
      anthropic: process.env.ANTHROPIC_API_KEY || '',
      gemini: process.env.GEMINI_API_KEY || '',
      openrouter: process.env.OPENROUTER_API_KEY || '',
    };

    console.log('LLM Service initialized');
  }

  /**
   * Create a provider instance based on provider name
   */
  createProvider(provider: string, apiKey?: string) {
    switch (provider) {
      case 'openai':
        return new OpenAIProvider(apiKey || this.apiKeys.openai);
      case 'anthropic':
        return new AnthropicProvider(apiKey || this.apiKeys.anthropic);
      case 'gemini':
        return new GeminiProvider(apiKey || this.apiKeys.gemini);
      case 'openrouter':
        return new OpenRouterProvider(apiKey || this.apiKeys.openrouter);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Get provider from model name
   */
  getProviderFromModel(model: string): string {
    if (model.startsWith('gemini-')) {
      return 'gemini';
    } else if (model.startsWith('gpt-') || model.includes('openai/')) {
      return 'openai';
    } else if (model.includes('claude') || model.includes('anthropic/')) {
      return 'anthropic';
    } else {
      // Default to OpenRouter for other models
      return 'openrouter';
    }
  }

  /**
   * Normalize model name for provider
   */
  normalizeModelName(model: string, provider: string): string {
    // For OpenRouter, models are prefixed with provider name
    if (provider === 'openrouter' && !model.includes('/')) {
      if (model.startsWith('gpt-')) {
        return `openai/${model}`;
      } else if (model.includes('claude')) {
        return `anthropic/${model}`;
      } else if (model.startsWith('gemini-')) {
        return `google/${model}`;
      }
    }
    
    // For other providers, remove provider prefix if present
    if (provider !== 'openrouter' && model.includes('/')) {
      return model.split('/')[1];
    }
    
    return model;
  }

  /**
   * Send a chat message to the LLM
   */
  async sendChatMessage(
    sessionId: string,
    message: string,
    options: {
      provider?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      apiKey?: string;
    } = {}
  ) {
    try {
      // Get session from database
      const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Use provided options or session defaults
      const provider = options.provider || session.provider || this.defaultProvider;
      const model = options.model || session.model || this.defaultModel;
      const temperature = options.temperature || session.temperature || 0.7;
      const maxTokens = options.maxTokens || session.maxTokens || 1024;
      const normalizedModel = this.normalizeModelName(model, provider);

      // Create provider instance
      const llmProvider = this.createProvider(provider, options.apiKey);

      // Create agent orchestrator
      const orchestrator = createAgentOrchestrator(llmProvider);

      // Get conversation history
      const messages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
        take: 20, // Limit to last 20 messages
      });

      // Format messages for the LLM
      const formattedMessages = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      // Add system prompt if provided
      if (options.systemPrompt) {
        formattedMessages.unshift({
          role: 'system',
          content: options.systemPrompt,
        });
      }

      // Add user message
      formattedMessages.push({
        role: 'user',
        content: message,
      });

      // Call the LLM
      const response = await llmProvider.chat(formattedMessages, {
        model: normalizedModel,
        temperature,
        maxTokens,
      });

      // Save user message to database
      await prisma.chatMessage.create({
        data: {
          sessionId,
          userId: session.userId,
          role: 'user',
          content: message,
          model: normalizedModel,
          provider,
        },
      });

      // Save assistant message to database
      await prisma.chatMessage.create({
        data: {
          sessionId,
          userId: session.userId,
          role: 'assistant',
          content: response.content,
          model: normalizedModel,
          provider,
          tokens: response.usage.completionTokens,
          metadata: {
            usage: response.usage,
            toolCalls: response.toolCalls || [],
          },
        },
      });

      // Update session token usage
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          totalTokens: { increment: response.usage.totalTokens },
          totalCost: { 
            increment: llmProvider.calculateCost(normalizedModel, {
              promptTokens: response.usage.promptTokens,
              completionTokens: response.usage.completionTokens,
            }),
          },
        },
      });

      return response.content;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  /**
   * Stream a chat message to the LLM
   */
  async *streamChatMessage(
    sessionId: string,
    message: string,
    options: {
      provider?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      apiKey?: string;
    } = {}
  ) {
    try {
      // Get session from database
      const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Use provided options or session defaults
      const provider = options.provider || session.provider || this.defaultProvider;
      const model = options.model || session.model || this.defaultModel;
      const temperature = options.temperature || session.temperature || 0.7;
      const maxTokens = options.maxTokens || session.maxTokens || 1024;
      const normalizedModel = this.normalizeModelName(model, provider);

      // Create provider instance
      const llmProvider = this.createProvider(provider, options.apiKey);

      // Get conversation history
      const messages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
        take: 20, // Limit to last 20 messages
      });

      // Format messages for the LLM
      const formattedMessages = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      // Add system prompt if provided
      if (options.systemPrompt) {
        formattedMessages.unshift({
          role: 'system',
          content: options.systemPrompt,
        });
      }

      // Add user message
      formattedMessages.push({
        role: 'user',
        content: message,
      });

      // Save user message to database
      await prisma.chatMessage.create({
        data: {
          sessionId,
          userId: session.userId,
          role: 'user',
          content: message,
          model: normalizedModel,
          provider,
        },
      });

      // Stream response from LLM
      let fullContent = '';
      let usage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
      let toolCalls: any[] = [];

      for await (const chunk of llmProvider.stream(formattedMessages, {
        model: normalizedModel,
        temperature,
        maxTokens,
      })) {
        if (chunk.delta) {
          fullContent += chunk.delta;
          yield { delta: chunk.delta };
        }

        if (chunk.toolCalls) {
          toolCalls = [...toolCalls, ...chunk.toolCalls];
          yield { toolCalls: chunk.toolCalls };
        }

        if (chunk.usage) {
          usage = chunk.usage;
          yield { usage };
        }
      }

      // Save assistant message to database
      await prisma.chatMessage.create({
        data: {
          sessionId,
          userId: session.userId,
          role: 'assistant',
          content: fullContent,
          model: normalizedModel,
          provider,
          tokens: usage.completionTokens,
          metadata: {
            usage,
            toolCalls,
          },
        },
      });

      // Update session token usage
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          totalTokens: { increment: usage.totalTokens },
          totalCost: { 
            increment: llmProvider.calculateCost(normalizedModel, {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
            }),
          },
        },
      });

      return fullContent;
    } catch (error) {
      console.error('Error streaming chat message:', error);
      throw error;
    }
  }

  /**
   * Generate code based on requirements
   */
  async generateCode(
    sessionId: string,
    requirements: string,
    language: string,
    context?: string
  ) {
    const systemPrompt = `You are an expert software developer specializing in ${language}. 
Your task is to generate high-quality, production-ready code based on the requirements provided.
Follow these guidelines:
- Write clean, efficient, and well-documented code
- Include appropriate error handling
- Follow best practices for ${language}
- Provide explanations for complex sections
- Consider edge cases and performance implications

${context ? `Additional context: ${context}` : ''}`;

    const message = `Generate ${language} code for the following requirements:

${requirements}

Please provide only the code with minimal explanations. Include comments where necessary to explain complex logic.`;

    return this.sendChatMessage(sessionId, message, { systemPrompt });
  }

  /**
   * Analyze code
   */
  async analyzeCode(
    sessionId: string,
    code: string,
    language: string
  ) {
    const systemPrompt = `You are an expert code reviewer specializing in ${language}.
Your task is to analyze the provided code and provide constructive feedback.
Focus on:
- Code quality and readability
- Potential bugs or edge cases
- Performance considerations
- Security vulnerabilities
- Best practices and design patterns
- Suggestions for improvement`;

    const message = `Please analyze the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Provide a comprehensive analysis with specific suggestions for improvement.`;

    return this.sendChatMessage(sessionId, message, { systemPrompt });
  }

  /**
   * Create a new chat session
   */
  async createSession(
    userId: string,
    options: {
      provider?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ) {
    try {
      const session = await prisma.agentSession.create({
        data: {
          userId,
          provider: options.provider || this.defaultProvider,
          model: options.model || this.defaultModel,
          temperature: options.temperature || 0.7,
          maxTokens: options.maxTokens || 1024,
        },
      });

      return session.id;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(provider: string, apiKey?: string) {
    try {
      const llmProvider = this.createProvider(provider, apiKey);
      
      if (provider === 'openrouter' && llmProvider instanceof OpenRouterProvider) {
        return await llmProvider.fetchAvailableModels();
      } else {
        return llmProvider.getAvailableModels().map(model => ({
          id: model,
          name: model,
          provider,
        }));
      }
    } catch (error) {
      console.error('Error getting available models:', error);
      return [];
    }
  }
}

// Export singleton instance
export const llmService = new LLMService();

