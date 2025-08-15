import { BaseLLMProvider, LLMConfig, LLMMessage, LLMResponse, StreamChunk, ToolCall, formatMessages } from './base';
import { countTokens } from './tokenizer';

/**
 * OpenAI provider for LLM services
 */
export class OpenAIProvider extends BaseLLMProvider {
  constructor(apiKey: string, baseURL?: string) {
    super(apiKey, baseURL || 'https://api.openai.com/v1');
  }

  getName(): string {
    return 'openai';
  }

  getAvailableModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
    ];
  }

  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    try {
      const formattedMessages = formatMessages(messages);
      
      // Prepare request body
      const requestBody: any = {
        model: config.model,
        messages: formattedMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
          ...(msg.name && { name: msg.name }),
          ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
        })),
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
        top_p: config.topP ?? 1,
        frequency_penalty: config.frequencyPenalty ?? 0,
        presence_penalty: config.presencePenalty ?? 0,
        ...(config.stop && { stop: config.stop }),
      };

      // Add tools if provided
      if (config.tools && config.tools.length > 0) {
        requestBody.tools = config.tools;
      }

      // Make API request
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
      }

      const data = await response.json();
      
      // Extract tool calls if any
      const toolCalls = data.choices[0]?.message?.tool_calls?.map((toolCall: any) => ({
        id: toolCall.id,
        type: 'function',
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        },
      })) as ToolCall[] | undefined;

      // Calculate token usage
      const promptTokens = data.usage.prompt_tokens;
      const completionTokens = data.usage.completion_tokens;
      const totalTokens = data.usage.total_tokens;

      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
        model: config.model,
        finishReason: data.choices[0]?.finish_reason,
        toolCalls,
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  async *stream(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<StreamChunk> {
    try {
      const formattedMessages = formatMessages(messages);
      
      // Prepare request body
      const requestBody: any = {
        model: config.model,
        messages: formattedMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
          ...(msg.name && { name: msg.name }),
          ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
        })),
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
        top_p: config.topP ?? 1,
        frequency_penalty: config.frequencyPenalty ?? 0,
        presence_penalty: config.presencePenalty ?? 0,
        ...(config.stop && { stop: config.stop }),
        stream: true,
      };

      // Add tools if provided
      if (config.tools && config.tools.length > 0) {
        requestBody.tools = config.tools;
      }

      // Make API request
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
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
              const delta = data.choices[0]?.delta;
              
              if (delta?.content) {
                accumulatedContent += delta.content;
                completionTokenCount += countTokens(delta.content);
                
                yield {
                  delta: delta.content,
                };
              }
              
              if (delta?.tool_calls) {
                // Handle streaming tool calls
                for (const toolCallDelta of delta.tool_calls) {
                  const existingToolCall = toolCalls.find(tc => tc.id === toolCallDelta.id);
                  
                  if (existingToolCall) {
                    // Update existing tool call
                    if (toolCallDelta.function?.name) {
                      existingToolCall.function.name = toolCallDelta.function.name;
                    }
                    if (toolCallDelta.function?.arguments) {
                      existingToolCall.function.arguments += toolCallDelta.function.arguments;
                    }
                  } else if (toolCallDelta.id) {
                    // Add new tool call
                    toolCalls.push({
                      id: toolCallDelta.id,
                      type: 'function',
                      function: {
                        name: toolCallDelta.function?.name || '',
                        arguments: toolCallDelta.function?.arguments || '',
                      },
                    });
                  }
                }
                
                // Only yield tool calls when they're complete
                const completeToolCalls = toolCalls.filter(tc => 
                  tc.function.name && tc.function.arguments && 
                  tc.function.arguments.trim() !== ''
                );
                
                if (completeToolCalls.length > 0) {
                  yield {
                    delta: '',
                    toolCalls: completeToolCalls,
                  };
                }
              }
              
              if (data.choices[0]?.finish_reason) {
                finishReason = data.choices[0].finish_reason;
                
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
      console.error('OpenAI streaming error:', error);
      throw error;
    }
  }
}

