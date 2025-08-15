/**
 * Export all LLM providers
 */

export * from './base';
export * from './tokenizer';
export * from './openai';
export * from './anthropic';
export * from './gemini';
export * from './openrouter';

// Provider factory
import { BaseLLMProvider } from './base';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OpenRouterProvider } from './openrouter';

/**
 * Create a provider instance based on provider name
 */
export function createProvider(
  provider: string,
  apiKey: string,
  baseURL?: string
): BaseLLMProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, baseURL);
    case 'anthropic':
      return new AnthropicProvider(apiKey, baseURL);
    case 'gemini':
      return new GeminiProvider(apiKey, baseURL);
    case 'openrouter':
      return new OpenRouterProvider(apiKey, baseURL);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

