import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

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
  private defaultConfig: LLMConfig;
  private pythonScriptPath: string;

  constructor() {
    // Default configuration using Emergent LLM key
    this.defaultConfig = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: process.env.EMERGENT_LLM_KEY || '',
      systemMessage: 'You are Shadow, an AI coding agent. You understand codebases, analyze code, generate solutions, debug issues, and help with development tasks. Be concise, accurate, and helpful.'
    };

    this.pythonScriptPath = path.join(__dirname, '../scripts/llm_client.py');
    this.ensurePythonScript();
  }

  private ensurePythonScript() {
    const scriptContent = `#!/usr/bin/env python3
import sys
import json
import os
import asyncio
from datetime import datetime
from emergentintegrations.llm.chat import LlmChat, UserMessage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def main():
    try:
        # Get input from command line arguments
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
        
        input_data = json.loads(sys.argv[1])
        
        session_id = input_data.get('sessionId', 'default')
        message = input_data.get('message', '')
        provider = input_data.get('provider', 'openai')
        model = input_data.get('model', 'gpt-4o-mini')
        api_key = input_data.get('apiKey', os.getenv('EMERGENT_LLM_KEY', ''))
        system_message = input_data.get('systemMessage', 'You are Shadow, an AI coding agent.')
        
        if not message:
            print(json.dumps({"error": "No message provided"}))
            sys.exit(1)
        
        if not api_key:
            print(json.dumps({"error": "No API key provided"}))
            sys.exit(1)
        
        # Initialize chat
        chat = LlmChat(api_key, session_id, system_message)
        chat.with_model(provider, model)
        
        # Send message
        user_message = UserMessage(message)
        response = await chat.send_message(user_message)
        
        # Return response
        print(json.dumps({
            "success": True,
            "response": response,
            "timestamp": datetime.now().isoformat()
        }))
        
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "type": type(e).__name__
        }))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
`;

    const scriptDir = path.dirname(this.pythonScriptPath);
    if (!fs.existsSync(scriptDir)) {
      fs.mkdirSync(scriptDir, { recursive: true });
    }

    if (!fs.existsSync(this.pythonScriptPath)) {
      fs.writeFileSync(this.pythonScriptPath, scriptContent);
      fs.chmodSync(this.pythonScriptPath, '755');
    }
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
      const finalConfig = { ...this.defaultConfig, ...config };
      
      const inputData = {
        sessionId,
        message,
        provider: finalConfig.provider,
        model: finalConfig.model,
        apiKey: finalConfig.apiKey,
        systemMessage: finalConfig.systemMessage
      };

      const { stdout, stderr } = await execAsync(
        `python3 "${this.pythonScriptPath}" '${JSON.stringify(inputData)}'`
      );

      if (stderr) {
        console.error('Python script stderr:', stderr);
      }

      const result = JSON.parse(stdout.trim());
      
      if (result.error) {
        throw new Error(result.error);
      }

      return result.response;
    } catch (error) {
      console.error('Error calling Python LLM script:', error);
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
    // For Python-based implementation, configuration is passed per request
    console.log(`Configuration updated for session ${sessionId}:`, config);
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
    console.log(`Session cleared: ${sessionId}`);
    // For Python-based implementation, session management is handled by the Python script
  }
}

// Export singleton instance
export const llmService = new LLMService();