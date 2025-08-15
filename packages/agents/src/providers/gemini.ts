import { BaseLLMProvider, LLMConfig, LLMMessage, LLMResponse, StreamChunk, ToolCall, formatMessages } from './base';
import { countTokens } from './tokenizer';

/**
 * Google Gemini provider for LLM services
 */
export class GeminiProvider extends BaseLLMProvider {
  constructor(apiKey: string, baseURL?: string) {
    super(apiKey, baseURL || 'https://generativelanguage.googleapis.com/v1beta');
  }

  getName(): string {
    return 'gemini';
  }

  getAvailableModels(): string[] {
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.0-pro',
      'gemini-1.0-pro-vision',
    ];
  }

  private convertMessagesToGeminiFormat(messages: LLMMessage[]): any[] {
    const formattedMessages: any[] = [];
    let currentRole: string | null = null;
    let currentContent: string[] = [];
    
    // Gemini expects consecutive messages from the same role to be combined
    for (const message of messages) {
      // Skip empty messages
      if (!message.content.trim()) continue;
      
      // Handle tool messages as model responses
      if (message.role === 'tool') {
        formattedMessages.push({
          role: 'model',
          parts: [
            {
              functionResponse: {
                name: message.name || 'unknown_function',
                response: { content: message.content },
              },
            },
          ],
        });
        currentRole = null;
        currentContent = [];
        continue;
      }
      
      // Map roles to Gemini format
      const geminiRole = message.role === 'assistant' ? 'model' : 
                         message.role === 'system' ? 'user' : 
                         message.role;
      
      // If role changes, push the accumulated content and reset
      if (currentRole !== geminiRole && currentRole !== null) {
        formattedMessages.push({
          role: currentRole,
          parts: [{ text: currentContent.join('\n\n') }],
        });
        currentContent = [];
      }
      
      currentRole = geminiRole;
      currentContent.push(message.content);
    }
    
    // Push any remaining content
    if (currentRole !== null && currentContent.length > 0) {
      formattedMessages.push({
        role: currentRole,
        parts: [{ text: currentContent.join('\n\n') }],
      });
    }
    
    return formattedMessages;
  }

  private convertToolsToGeminiFunctions(tools: any[]): any[] {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    }));
  }

  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    try {
      const formattedMessages = formatMessages(messages);
      const geminiMessages = this.convertMessagesToGeminiFormat(formattedMessages);
      
      // Prepare request body
      const requestBody: any = {
        contents: geminiMessages,
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          maxOutputTokens: config.maxTokens,
          topP: config.topP ?? 1,
          topK: 40,
          ...(config.stop && { stopSequences: config.stop }),
        },
      };

      // Add tools if provided
      if (config.tools && config.tools.length > 0) {
        requestBody.tools = {
          functionDeclarations: this.convertToolsToGeminiFunctions(config.tools),
        };
      }

      // Get model name without version for URL
      const modelName = config.model.replace(/^gemini-/, '');
      
      // Make API request
      const response = await fetch(`${this.baseURL}/models/gemini-${modelName}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
      }

      const data = await response.json();
      
      // Extract content
      const textContent = data.candidates?.[0]?.content?.parts
        ?.filter((part: any) => part.text)
        ?.map((part: any) => part.text)
        ?.join('') || '';
      
      // Extract tool calls if any
      const toolCalls = data.candidates?.[0]?.content?.parts
        ?.filter((part: any) => part.functionCall)
        ?.map((part: any, index: number) => ({
          id: `gemini-function-call-${index}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args),
          },
        })) as ToolCall[] | undefined;

      // Calculate token usage (Gemini doesn't provide token counts, so we estimate)
      const promptText = geminiMessages.map(msg => 
        msg.parts.map((part: any) => part.text || '').join('')
      ).join('');
      
      const promptTokens = countTokens(promptText);
      const completionTokens = countTokens(textContent);
      const totalTokens = promptTokens + completionTokens;

      // Determine finish reason
      let finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' = 'stop';
      if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        finishReason = 'length';
      } else if (data.candidates?.[0]?.finishReason === 'SAFETY') {
        finishReason = 'content_filter';
      } else if (toolCalls && toolCalls.length > 0) {
        finishReason = 'tool_calls';
      }

      return {
        content: textContent,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
        model: config.model,
        finishReason,
        toolCalls,
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  async *stream(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<StreamChunk> {
    try {
      const formattedMessages = formatMessages(messages);
      const geminiMessages = this.convertMessagesToGeminiFormat(formattedMessages);
      
      // Prepare request body
      const requestBody: any = {
        contents: geminiMessages,
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          maxOutputTokens: config.maxTokens,
          topP: config.topP ?? 1,
          topK: 40,
          ...(config.stop && { stopSequences: config.stop }),
        },
        streamGenerationConfig: {
          streamContentTokens: true,
          streamFunctionCallTokens: config.tools && config.tools.length > 0,
        },
      };

      // Add tools if provided
      if (config.tools && config.tools.length > 0) {
        requestBody.tools = {
          functionDeclarations: this.convertToolsToGeminiFunctions(config.tools),
        };
      }

      // Get model name without version for URL
      const modelName = config.model.replace(/^gemini-/, '');
      
      // Make API request
      const response = await fetch(`${this.baseURL}/models/gemini-${modelName}:streamGenerateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedContent = '';
      let functionCalls: Record<string, any> = {};
      let finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | undefined;

      // Estimate token usage
      const promptText = geminiMessages.map(msg => 
        msg.parts.map((part: any) => part.text || '').join('')
      ).join('');
      
      const promptTokenCount = countTokens(promptText);
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
            
            try {
              const data = JSON.parse(line);
              
              // Handle text content
              const textDelta = data.candidates?.[0]?.content?.parts
                ?.filter((part: any) => part.text)
                ?.map((part: any) => part.text)
                ?.join('') || '';
              
              if (textDelta) {
                accumulatedContent += textDelta;
                completionTokenCount += countTokens(textDelta);
                
                yield {
                  delta: textDelta,
                };
              }
              
              // Handle function calls
              const functionCallPart = data.candidates?.[0]?.content?.parts
                ?.find((part: any) => part.functionCall);
              
              if (functionCallPart) {
                const functionCall = functionCallPart.functionCall;
                const functionName = functionCall.name;
                
                if (!functionCalls[functionName]) {
                  functionCalls[functionName] = {
                    name: functionName,
                    args: {},
                  };
                }
                
                // Update args with new data
                if (functionCall.args) {
                  functionCalls[functionName].args = {
                    ...functionCalls[functionName].args,
                    ...functionCall.args,
                  };
                }
                
                // Convert to tool calls format
                const toolCalls: ToolCall[] = Object.entries(functionCalls).map(([name, call]: [string, any], index) => ({
                  id: `gemini-function-call-${index}`,
                  type: 'function',
                  function: {
                    name,
                    arguments: JSON.stringify(call.args),
                  },
                }));
                
                yield {
                  delta: '',
                  toolCalls,
                };
              }
              
              // Handle finish reason
              if (data.candidates?.[0]?.finishReason) {
                if (data.candidates[0].finishReason === 'MAX_TOKENS') {
                  finishReason = 'length';
                } else if (data.candidates[0].finishReason === 'SAFETY') {
                  finishReason = 'content_filter';
                } else if (Object.keys(functionCalls).length > 0) {
                  finishReason = 'tool_calls';
                } else {
                  finishReason = 'stop';
                }
                
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
      console.error('Gemini streaming error:', error);
      throw error;
    }
  }
}

