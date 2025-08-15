// Export agent orchestrator
export * from './orchestrator';

// Export context manager
export * from './context';

// Export memory manager
export * from './memory';

// Export providers
export * from './providers/base';
export * from './providers/gemini';
export * from './providers/openrouter';

// Create and export a factory function for creating agent orchestrators
import { AgentOrchestrator } from './orchestrator';
import { GeminiProvider } from './providers/gemini';
import { OpenRouterProvider } from './providers/openrouter';
import { toolRegistry } from '@shadow/tools/base/tool';

/**
 * Create an agent orchestrator with the specified provider
 */
export function createAgentOrchestrator(
  provider: 'gemini' | 'openrouter',
  apiKey: string
) {
  switch (provider) {
    case 'gemini':
      return new AgentOrchestrator(new GeminiProvider(apiKey), toolRegistry);
    case 'openrouter':
      return new AgentOrchestrator(new OpenRouterProvider(apiKey), toolRegistry);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

