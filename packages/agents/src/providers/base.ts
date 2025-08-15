/**
 * Base types and interfaces for LLM providers
 */

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: any[];
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  toolCalls?: ToolCall[];
}

export interface StreamChunk {
  delta: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  usage?: TokenUsage;
}

/**
 * Provider pricing configuration
 */
export interface ProviderPricing {
  [model: string]: {
    prompt: number;  // Cost per 1K tokens for prompt
    completion: number;  // Cost per 1K tokens for completion
  };
}

/**
 * Base class for LLM providers
 */
export abstract class BaseLLMProvider {
  protected apiKey: string;
  protected baseURL: string;
  protected pricing: ProviderPricing;

  constructor(apiKey: string, baseURL: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.pricing = this.getDefaultPricing();
  }

  /**
   * Get provider name
   */
  abstract getName(): string;

  /**
   * Get available models for this provider
   */
  abstract getAvailableModels(): string[];

  /**
   * Send a chat message to the LLM
   */
  abstract chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse>;

  /**
   * Stream a chat message from the LLM
   */
  abstract stream(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<StreamChunk>;

  /**
   * Get default pricing for this provider
   */
  protected getDefaultPricing(): ProviderPricing {
    // Default pricing - should be overridden by specific providers
    return {
      'default': {
        prompt: 0.001,
        completion: 0.002,
      },
    };
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(model: string, usage: { promptTokens: number; completionTokens: number }): number {
    const pricing = this.pricing[model] || this.pricing['default'];
    
    if (!pricing) {
      return 0;
    }
    
    const promptCost = (usage.promptTokens / 1000) * pricing.prompt;
    const completionCost = (usage.completionTokens / 1000) * pricing.completion;
    
    return promptCost + completionCost;
  }
}

/**
 * Format messages for LLM providers
 * This handles special cases like combining consecutive messages from the same role
 */
export function formatMessages(messages: LLMMessage[]): LLMMessage[] {
  const formattedMessages: LLMMessage[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Skip empty messages
    if (!message.content.trim()) continue;
    
    // Special handling for tool messages
    if (message.role === 'tool') {
      formattedMessages.push(message);
      continue;
    }
    
    // Check if we can combine with the previous message
    const prevMessage = formattedMessages[formattedMessages.length - 1];
    
    if (
      prevMessage && 
      prevMessage.role === message.role && 
      !prevMessage.name && 
      !message.name &&
      !prevMessage.toolCallId &&
      !message.toolCallId
    ) {
      // Combine with previous message
      prevMessage.content += '\n\n' + message.content;
    } else {
      // Add as a new message
      formattedMessages.push({ ...message });
    }
  }
  
  return formattedMessages;
}

