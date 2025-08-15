import { z } from 'zod';

// Base interfaces and types for LLM providers
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
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
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  toolCalls?: ToolCall[];
}

export interface StreamChunk {
  delta: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  toolCalls?: ToolCall[];
}

export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: ToolDefinition[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// Provider pricing configuration
export interface ProviderPricing {
  inputTokenPrice: number;  // per 1K tokens
  outputTokenPrice: number; // per 1K tokens
  currency: 'USD';
}

export const PROVIDER_PRICING: Record<string, Record<string, ProviderPricing>> = {
  gemini: {
    'gemini-1.5-pro': { inputTokenPrice: 0.00125, outputTokenPrice: 0.005, currency: 'USD' },
    'gemini-1.5-flash': { inputTokenPrice: 0.000075, outputTokenPrice: 0.0003, currency: 'USD' },
    'gemini-1.5-flash-8b': { inputTokenPrice: 0.0000375, outputTokenPrice: 0.00015, currency: 'USD' },
  },
  openrouter: {
    'anthropic/claude-3.5-sonnet': { inputTokenPrice: 0.003, outputTokenPrice: 0.015, currency: 'USD' },
    'openai/gpt-4o': { inputTokenPrice: 0.005, outputTokenPrice: 0.015, currency: 'USD' },
    'openai/gpt-4o-mini': { inputTokenPrice: 0.00015, outputTokenPrice: 0.0006, currency: 'USD' },
    'meta-llama/llama-3.2-90b-vision-instruct': { inputTokenPrice: 0.0009, outputTokenPrice: 0.0009, currency: 'USD' },
  }
};

export abstract class BaseLLMProvider {
  protected apiKey: string;
  protected baseURL?: string;

  constructor(apiKey: string, baseURL?: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  abstract getName(): string;
  abstract getAvailableModels(): string[];
  abstract chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse>;
  abstract stream(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<StreamChunk>;
  
  // Calculate cost based on usage
  calculateCost(model: string, usage: { promptTokens: number; completionTokens: number }): number {
    const providerPricing = PROVIDER_PRICING[this.getName()]?.[model];
    if (!providerPricing) return 0;

    const inputCost = (usage.promptTokens / 1000) * providerPricing.inputTokenPrice;
    const outputCost = (usage.completionTokens / 1000) * providerPricing.outputTokenPrice;
    
    return inputCost + outputCost;
  }

  // Validate model availability
  validateModel(model: string): boolean {
    return this.getAvailableModels().includes(model);
  }
}

// Utility functions
export function formatMessages(messages: LLMMessage[]): LLMMessage[] {
  return messages.filter(msg => msg.content.trim().length > 0);
}

export function countTokens(text: string): number {
  // Simple token estimation (rough approximation)
  return Math.ceil(text.length / 4);
}

export function truncateContext(messages: LLMMessage[], maxTokens: number): LLMMessage[] {
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  
  let totalTokens = systemMessages.reduce((sum, msg) => sum + countTokens(msg.content), 0);
  const result = [...systemMessages];
  
  // Add messages from the end (most recent first)
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msgTokens = countTokens(otherMessages[i].content);
    if (totalTokens + msgTokens <= maxTokens) {
      result.unshift(otherMessages[i]);
      totalTokens += msgTokens;
    } else {
      break;
    }
  }
  
  return result;
}