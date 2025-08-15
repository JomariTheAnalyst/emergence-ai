export * from './providers/base';
export * from './providers/gemini';
export * from './providers/openrouter';
export * from './manager';

// Export pre-configured agent instances
import { AgentManager } from './manager';

let globalAgentManager: AgentManager | null = null;

export function getAgentManager(): AgentManager {
  if (!globalAgentManager) {
    globalAgentManager = new AgentManager();
  }
  return globalAgentManager;
}

// Export common configurations
export const RECOMMENDED_MODELS = {
  CODING: {
    gemini: 'gemini-1.5-pro',
    openrouter: 'anthropic/claude-3.5-sonnet',
  },
  CHAT: {
    gemini: 'gemini-1.5-flash',
    openrouter: 'openai/gpt-4o-mini',
  },
  ANALYSIS: {
    gemini: 'gemini-1.5-pro',
    openrouter: 'openai/gpt-4o',
  },
};

export const DEFAULT_CONFIGS = {
  CREATIVE: {
    temperature: 0.8,
    maxTokens: 4000,
  },
  BALANCED: {
    temperature: 0.5,
    maxTokens: 4000,
  },
  PRECISE: {
    temperature: 0.1,
    maxTokens: 4000,
  },
};