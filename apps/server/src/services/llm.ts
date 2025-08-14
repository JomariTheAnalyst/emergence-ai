import { LlmChat, UserMessage } from 'emergentintegrations/llm/chat';
import { config } from 'dotenv';

// Load environment variables
config();

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  apiKey: string;
  systemMessage?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export class LLMService {
  private chatInstances: Map<string, LlmChat> = new Map();
  private defaultConfig: LLMConfig;

  constructor() {
    // Default configuration using Emergent LLM key
    this.defaultConfig = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: process.env.EMERGENT_LLM_KEY || '',
      systemMessage: 'You are Shadow, an AI coding agent. You understand codebases, analyze code, generate solutions, debug issues, and help with development tasks. Be concise, accurate, and helpful.'
    };
  }

  /**
   * Get or create a chat instance for a session
   */
  private getChatInstance(sessionId: string, config?: Partial<LLMConfig>): LlmChat {
    const sessionKey = `${sessionId}_${config?.provider || this.defaultConfig.provider}_${config?.model || this.defaultConfig.model}`;
    
    if (!this.chatInstances.has(sessionKey)) {
      const finalConfig = { ...this.defaultConfig, ...config };
      
      const chat = new LlmChat(
        finalConfig.apiKey,
        sessionId,
        finalConfig.systemMessage || this.defaultConfig.systemMessage
      );

      // Configure the model and provider
      chat.with_model(finalConfig.provider, finalConfig.model);
      
      this.chatInstances.set(sessionKey, chat);
    }

    return this.chatInstances.get(sessionKey)!;
  }

  /**
   * Send a chat message and get response
   */
  async sendChatMessage(
    sessionId: string, 
    message: string, 
    config?: Partial<LLMConfig>
  ): Promise<string> {
    try {
      const chat = this.getChatInstance(sessionId, config);
      const userMessage = new UserMessage(message);
      const response = await chat.send_message(userMessage);
      return response;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw new Error('Failed to get AI response');
    }
  }

  /**
   * Generate code analysis
   */
  async analyzeCode(
    sessionId: string,
    code: string,
    language: string,
    config?: Partial<LLMConfig>
  ): Promise<string> {
    const analysisPrompt = `Analyze this ${language} code and provide:
1. Code quality assessment
2. Potential issues or bugs
3. Performance considerations
4. Suggestions for improvement
5. Security concerns (if any)

Code:
\`\`\`${language}
${code}
\`\`\``;

    return this.sendChatMessage(sessionId, analysisPrompt, config);
  }

  /**
   * Generate code based on requirements
   */
  async generateCode(
    sessionId: string,
    requirements: string,
    language: string,
    context?: string,
    config?: Partial<LLMConfig>
  ): Promise<string> {
    let prompt = `Generate ${language} code based on these requirements:
${requirements}`;

    if (context) {
      prompt += `\n\nContext:\n${context}`;
    }

    prompt += `\n\nProvide clean, well-commented, production-ready code.`;

    return this.sendChatMessage(sessionId, prompt, config);
  }

  /**
   * Debug code and suggest fixes
   */
  async debugCode(
    sessionId: string,
    code: string,
    error: string,
    language: string,
    config?: Partial<LLMConfig>
  ): Promise<string> {
    const debugPrompt = `Debug this ${language} code that's producing the following error:

Error: ${error}

Code:
\`\`\`${language}
${code}
\`\`\`

Please:
1. Identify the root cause of the error
2. Explain why it's happening
3. Provide the corrected code
4. Suggest best practices to avoid similar issues`;

    return this.sendChatMessage(sessionId, debugPrompt, config);
  }

  /**
   * Generate documentation
   */
  async generateDocumentation(
    sessionId: string,
    code: string,
    language: string,
    docType: 'api' | 'readme' | 'comments' | 'technical',
    config?: Partial<LLMConfig>
  ): Promise<string> {
    const docPrompt = `Generate ${docType} documentation for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Make the documentation comprehensive, clear, and professional.`;

    return this.sendChatMessage(sessionId, docPrompt, config);
  }

  /**
   * Refactor code
   */
  async refactorCode(
    sessionId: string,
    code: string,
    language: string,
    goals: string[],
    config?: Partial<LLMConfig>
  ): Promise<string> {
    const refactorPrompt = `Refactor this ${language} code with these goals:
${goals.map(goal => `- ${goal}`).join('\n')}

Original code:
\`\`\`${language}
${code}
\`\`\`

Provide the refactored code with explanations of the changes made.`;

    return this.sendChatMessage(sessionId, refactorPrompt, config);
  }

  /**
   * Update LLM configuration for a session
   */
  updateConfig(sessionId: string, config: Partial<LLMConfig>): void {
    // Remove existing chat instances for this session to force recreation with new config
    const keysToRemove = Array.from(this.chatInstances.keys()).filter(key => 
      key.startsWith(sessionId)
    );
    
    keysToRemove.forEach(key => {
      this.chatInstances.delete(key);
    });
  }

  /**
   * Get available models
   */
  getAvailableModels(): Record<string, string[]> {
    return {
      openai: [
        'gpt-4o',
        'gpt-4o-mini', 
        'gpt-4',
        'gpt-4.1',
        'gpt-4.1-mini',
        'o1',
        'o1-mini'
      ],
      anthropic: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-7-sonnet-20250219',
        'claude-4-sonnet-20250514'
      ],
      gemini: [
        'gemini-2.0-flash',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-2.5-flash'
      ]
    };
  }

  /**
   * Clear chat history for a session
   */
  clearSession(sessionId: string): void {
    const keysToRemove = Array.from(this.chatInstances.keys()).filter(key => 
      key.startsWith(sessionId)
    );
    
    keysToRemove.forEach(key => {
      this.chatInstances.delete(key);
    });
  }
}

// Export singleton instance
export const llmService = new LLMService();