import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';
import { BaseLLMProvider, LLMMessage, LLMResponse, LLMConfig, StreamChunk, ToolCall, ToolDefinition } from './base';

export class GeminiProvider extends BaseLLMProvider {
  private client: GoogleGenerativeAI;
  
  constructor(apiKey: string) {
    super(apiKey);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  getName(): string {
    return 'gemini';
  }

  getAvailableModels(): string[] {
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.0-pro'
    ];
  }

  private convertMessages(messages: LLMMessage[]): any[] {
    const geminiMessages: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini doesn't have system role, we'll prepend it to the first user message
        continue;
      }
      
      const geminiRole = message.role === 'assistant' ? 'model' : 'user';
      
      if (message.toolCalls && message.toolCalls.length > 0) {
        // Handle tool calls
        const toolCallParts: Part[] = message.toolCalls.map(toolCall => ({
          functionCall: {
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments)
          }
        }));
        
        geminiMessages.push({
          role: geminiRole,
          parts: toolCallParts
        });
      } else if (message.toolCallId) {
        // Handle tool responses
        geminiMessages.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: message.name || 'unknown',
              response: { content: message.content }
            }
          }]
        });
      } else {
        geminiMessages.push({
          role: geminiRole,
          parts: [{ text: message.content }]
        });
      }
    }
    
    return geminiMessages;
  }

  private convertTools(tools?: ToolDefinition[]): any[] {
    if (!tools || tools.length === 0) return [];
    
    return tools.map(tool => ({
      functionDeclaration: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }
    }));
  }

  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    try {
      const model = this.client.getGenerativeModel({ 
        model: config.model,
        tools: this.convertTools(config.tools),
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          topP: config.topP,
          stopSequences: config.stop,
        }
      });

      // Handle system message
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = this.convertMessages(messages.filter(m => m.role !== 'system'));
      
      let instruction = systemMessage?.content || '';
      
      // Create chat session
      const chat = model.startChat({
        history: conversationMessages.slice(0, -1), // All except the last message
        systemInstruction: instruction ? { parts: [{ text: instruction }] } : undefined
      });

      const lastMessage = conversationMessages[conversationMessages.length - 1];
      const result = await chat.sendMessage(lastMessage.parts);
      
      const response = result.response;
      const text = response.text();
      
      // Extract tool calls if present
      const toolCalls: ToolCall[] = [];
      if (response.functionCalls && response.functionCalls.length > 0) {
        response.functionCalls.forEach((fc, index) => {
          toolCalls.push({
            id: `call_${Date.now()}_${index}`,
            type: 'function',
            function: {
              name: fc.name,
              arguments: JSON.stringify(fc.args)
            }
          });
        });
      }

      return {
        content: text,
        usage: {
          promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
          completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: result.response.usageMetadata?.totalTokenCount || 0,
        },
        model: config.model,
        finishReason: response.finishReason === 'STOP' ? 'stop' : 
                     response.finishReason === 'MAX_TOKENS' ? 'length' :
                     toolCalls.length > 0 ? 'tool_calls' : 'stop',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
    } catch (error) {
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *stream(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<StreamChunk> {
    try {
      const model = this.client.getGenerativeModel({ 
        model: config.model,
        tools: this.convertTools(config.tools),
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          topP: config.topP,
          stopSequences: config.stop,
        }
      });

      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = this.convertMessages(messages.filter(m => m.role !== 'system'));
      
      let instruction = systemMessage?.content || '';
      
      const chat = model.startChat({
        history: conversationMessages.slice(0, -1),
        systemInstruction: instruction ? { parts: [{ text: instruction }] } : undefined
      });

      const lastMessage = conversationMessages[conversationMessages.length - 1];
      const result = await chat.sendMessageStream(lastMessage.parts);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        
        if (text) {
          yield {
            delta: text,
          };
        }
      }

      // Final response with usage data
      const finalResponse = await result.response;
      yield {
        delta: '',
        usage: {
          promptTokens: finalResponse.usageMetadata?.promptTokenCount || 0,
          completionTokens: finalResponse.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: finalResponse.usageMetadata?.totalTokenCount || 0,
        },
        finishReason: 'stop'
      };
    } catch (error) {
      throw new Error(`Gemini streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}