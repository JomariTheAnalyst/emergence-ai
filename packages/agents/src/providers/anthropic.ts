import { BaseLLMProvider, LLMConfig, LLMMessage, LLMResponse, StreamChunk, ToolCall, formatMessages } from './base';
import { countTokens } from './tokenizer';

/**
 * Anthropic provider for LLM services (Claude models)
 */
export class AnthropicProvider extends BaseLLMProvider {
  constructor(apiKey: string, baseURL?: string) {
    super(apiKey, baseURL || 'https://api.anthropic.com/v1');
  }

  getName(): string {
    return 'anthropic';
  }

  getAvailableModels(): string[] {
    return [
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2',
    ];
  }

  private convertMessagesToAnthropicFormat(messages: LLMMessage[]): any[] {
    const formattedMessages: any[] = [];
    
    // Anthropic expects a specific format for messages
    for (const message of messages) {
      if (message.role === 'system') {
        // System messages are handled separately in Anthropic API
        continue;
      } else if (message.role === 'tool') {
        // Tool responses need to be formatted as assistant messages
        formattedMessages.push({
          role: 'assistant',
          content: [
            {
              type: 'tool_result',
              tool_call_id: message.toolCallId,
              content: message.content,
            },
          ],
        });
      } else {
        // User and assistant messages
        formattedMessages.push({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content,
        });
      }
    }
    
    return formattedMessages;
  }

  private extractSystemMessage(messages: LLMMessage[]): string | undefined {
    const systemMessages = messages.filter(msg => msg.role === 'system');
    if (systemMessages.length > 0) {
      // Combine all system messages into one
      return systemMessages.map(msg => msg.content).join('\n\n');
    }
    return undefined;
  }

  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    try {
      const formattedMessages = formatMessages(messages);
      const anthropicMessages = this.convertMessagesToAnthropicFormat(formattedMessages);
      const systemMessage = this.extractSystemMessage(formattedMessages);
      
      // Prepare request body
      const requestBody: any = {
        model: config.model,
        messages: anthropicMessages,
        max_tokens: config.maxTokens || 1024,
        temperature: config.temperature ?? 0.7,
        top_p: config.topP ?? 1,
        ...(systemMessage && { system: systemMessage }),
      };

      // Add tools if provided
      if (config.tools && config.tools.length > 0) {
        requestBody.tools = config.tools;
      }

      // Make API request
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
      }

      const data = await response.json();
      
      // Extract tool calls if any
      const toolCalls = data.content?.filter((item: any) => item.type === 'tool_use')
        .map((item: any) => ({
          id: item.id,
          type: 'function',
          function: {
            name: item.name,
            arguments: JSON.stringify(item.input),
          },
        })) as ToolCall[] | undefined;

      // Extract content
      const textContent = data.content?.filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('') || '';

      // Calculate token usage
      const promptTokens = data.usage?.input_tokens || 0;
      const completionTokens = data.usage?.output_tokens || 0;
      const totalTokens = promptTokens + completionTokens;

      return {
        content: textContent,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
        model: config.model,
        finishReason: data.stop_reason === 'end_turn' ? 'stop' : 
                      data.stop_reason === 'max_tokens' ? 'length' : 
                      data.stop_reason === 'tool_use' ? 'tool_calls' : 
                      data.stop_reason === 'content_filtered' ? 'content_filter' : 'stop',
        toolCalls,
      };
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  async *stream(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<StreamChunk> {
    try {
      const formattedMessages = formatMessages(messages);
      const anthropicMessages = this.convertMessagesToAnthropicFormat(formattedMessages);
      const systemMessage = this.extractSystemMessage(formattedMessages);
      
      // Prepare request body
      const requestBody: any = {
        model: config.model,
        messages: anthropicMessages,
        max_tokens: config.maxTokens || 1024,
        temperature: config.temperature ?? 0.7,
        top_p: config.topP ?? 1,
        stream: true,
        ...(systemMessage && { system: systemMessage }),
      };

      // Add tools if provided
      if (config.tools && config.tools.length > 0) {
        requestBody.tools = config.tools;
      }

      // Make API request
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedContent = '';
      let toolCalls: ToolCall[] = [];
      let finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | undefined;

      // Estimate token usage
      const promptTokenCount = messages.reduce((sum, msg) => sum + countTokens(msg.content), 0);
      let completionTokenCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.trim() === 'data: [DONE]') continue;
            
            const message = line.replace(/^data: /, '').trim();
            if (!message) continue;
            
            try {
              const data = JSON.parse(message);
              
              if (data.type === 'content_block_delta' && data.delta.type === 'text_delta') {
                const delta = data.delta.text;
                accumulatedContent += delta;
                completionTokenCount += countTokens(delta);
                
                yield {
                  delta,
                };
              } else if (data.type === 'content_block_start' && data.content_block.type === 'tool_use') {
                // Start of a tool call
                const toolCall: ToolCall = {
                  id: data.content_block.id,
                  type: 'function',
                  function: {
                    name: data.content_block.name,
                    arguments: JSON.stringify(data.content_block.input || {}),
                  },
                };
                
                toolCalls.push(toolCall);
                
                yield {
                  delta: '',
                  toolCalls: [toolCall],
                };
              } else if (data.type === 'message_stop') {
                finishReason = data.stop_reason === 'end_turn' ? 'stop' : 
                              data.stop_reason === 'max_tokens' ? 'length' : 
                              data.stop_reason === 'tool_use' ? 'tool_calls' : 
                              data.stop_reason === 'content_filtered' ? 'content_filter' : 'stop';
                
                yield {
                  delta: '',
                  finishReason,
                  usage: {
                    promptTokens: promptTokenCount,
                    completionTokens: completionTokenCount,
                    totalTokens: promptTokenCount + completionTokenCount,
                  },
                };
              }
            } catch (e) {
              console.error('Error parsing SSE message:', e);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Anthropic streaming error:', error);
      throw error;
    }
  }
}

