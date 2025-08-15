import OpenAI from 'openai';
import { BaseLLMProvider, LLMMessage, LLMResponse, LLMConfig, StreamChunk, ToolCall } from './base';

export class OpenRouterProvider extends BaseLLMProvider {
  private client: OpenAI;
  
  constructor(apiKey: string) {
    super(apiKey, 'https://openrouter.ai/api/v1');
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: this.baseURL,
      defaultHeaders: {
        'HTTP-Referer': 'https://shadow-ai.dev',
        'X-Title': 'Shadow AI Coding Agent',
      }
    });
  }

  getName(): string {
    return 'openrouter';
  }

  getAvailableModels(): string[] {
    return [
      // Anthropic
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-haiku',
      'anthropic/claude-3-opus',
      
      // OpenAI
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'openai/gpt-4-turbo',
      'openai/gpt-3.5-turbo',
      
      // Meta
      'meta-llama/llama-3.2-90b-vision-instruct',
      'meta-llama/llama-3.1-70b-instruct',
      'meta-llama/llama-3.1-8b-instruct',
      
      // Google
      'google/gemini-pro-1.5',
      'google/gemini-flash-1.5',
      
      // Mistral
      'mistralai/mistral-large',
      'mistralai/codestral-latest',
      
      // Specialized coding models
      'deepseek/deepseek-coder',
      'microsoft/wizardlm-2-8x22b',
      'qwen/qwen-2.5-coder-32b-instruct',
    ];
  }

  private convertMessages(messages: LLMMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      tool_calls: msg.toolCalls,
      tool_call_id: msg.toolCallId
    }));
  }

  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: config.model,
        messages: this.convertMessages(messages) as any,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: config.topP,
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
        stop: config.stop,
        tools: config.tools as any,
        tool_choice: config.tools && config.tools.length > 0 ? 'auto' : undefined,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response generated');
      }

      // Extract tool calls
      const toolCalls: ToolCall[] = [];
      if (choice.message.tool_calls) {
        choice.message.tool_calls.forEach(tc => {
          toolCalls.push({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments
            }
          });
        });
      }

      return {
        content: choice.message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
        finishReason: choice.finish_reason === 'stop' ? 'stop' :
                     choice.finish_reason === 'length' ? 'length' :
                     choice.finish_reason === 'tool_calls' ? 'tool_calls' :
                     choice.finish_reason === 'content_filter' ? 'content_filter' : 'stop',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
    } catch (error) {
      throw new Error(`OpenRouter API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *stream(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<StreamChunk> {
    try {
      const response = await this.client.chat.completions.create({
        model: config.model,
        messages: this.convertMessages(messages) as any,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: config.topP,
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
        stop: config.stop,
        tools: config.tools as any,
        tool_choice: config.tools && config.tools.length > 0 ? 'auto' : undefined,
        stream: true,
      });

      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      for await (const chunk of response) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        
        if (delta.content) {
          yield {
            delta: delta.content,
          };
        }

        // Handle tool calls in streaming
        if (delta.tool_calls) {
          const toolCalls: ToolCall[] = delta.tool_calls.map(tc => ({
            id: tc.id || `call_${Date.now()}`,
            type: 'function',
            function: {
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || ''
            }
          }));

          yield {
            delta: '',
            toolCalls
          };
        }

        // Track usage if available
        if (chunk.usage) {
          totalPromptTokens = chunk.usage.prompt_tokens || 0;
          totalCompletionTokens = chunk.usage.completion_tokens || 0;
        }

        if (choice.finish_reason) {
          yield {
            delta: '',
            usage: {
              promptTokens: totalPromptTokens,
              completionTokens: totalCompletionTokens,
              totalTokens: totalPromptTokens + totalCompletionTokens,
            },
            finishReason: choice.finish_reason === 'stop' ? 'stop' :
                         choice.finish_reason === 'length' ? 'length' :
                         choice.finish_reason === 'tool_calls' ? 'tool_calls' :
                         choice.finish_reason === 'content_filter' ? 'content_filter' : 'stop'
          };
        }
      }
    } catch (error) {
      throw new Error(`OpenRouter streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}