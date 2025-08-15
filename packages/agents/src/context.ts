import { LLMMessage } from './providers/base';
import { prisma } from '@shadow/db';

/**
 * Context window management for agent conversations
 */
export interface ContextWindow {
  messages: LLMMessage[];
  maxTokens: number;
  currentTokens: number;
}

/**
 * Context manager for handling conversation history and context
 */
export class ContextManager {
  // Approximate token count for a message
  private static estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Create a new context window with system message
   */
  static createContextWindow(
    systemMessage: string,
    maxTokens: number = 16000
  ): ContextWindow {
    const systemTokens = this.estimateTokens(systemMessage);
    
    return {
      messages: [
        { role: 'system', content: systemMessage }
      ],
      maxTokens,
      currentTokens: systemTokens,
    };
  }

  /**
   * Add a message to the context window, managing token limits
   */
  static addMessage(
    contextWindow: ContextWindow,
    message: LLMMessage
  ): ContextWindow {
    const messageTokens = this.estimateTokens(message.content);
    const newMessages = [...contextWindow.messages, message];
    const newTokenCount = contextWindow.currentTokens + messageTokens;

    // If we're under the limit, just add the message
    if (newTokenCount <= contextWindow.maxTokens) {
      return {
        messages: newMessages,
        maxTokens: contextWindow.maxTokens,
        currentTokens: newTokenCount,
      };
    }

    // Otherwise, we need to trim the context
    return this.trimContext(contextWindow, message, messageTokens);
  }

  /**
   * Trim the context window to fit within token limits
   */
  private static trimContext(
    contextWindow: ContextWindow,
    newMessage: LLMMessage,
    newMessageTokens: number
  ): ContextWindow {
    // Always keep the system message
    const systemMessage = contextWindow.messages.find(m => m.role === 'system');
    const systemTokens = systemMessage 
      ? this.estimateTokens(systemMessage.content)
      : 0;

    // Start with just the system message and the new message
    const trimmedMessages: LLMMessage[] = systemMessage ? [systemMessage] : [];
    let currentTokens = systemTokens + newMessageTokens;

    // Add the new message
    trimmedMessages.push(newMessage);

    // Add as many recent messages as possible, starting from the most recent
    const nonSystemMessages = contextWindow.messages
      .filter(m => m.role !== 'system')
      .reverse(); // Most recent first

    for (const message of nonSystemMessages) {
      const messageTokens = this.estimateTokens(message.content);
      
      if (currentTokens + messageTokens <= contextWindow.maxTokens) {
        trimmedMessages.unshift(message); // Add to the beginning
        currentTokens += messageTokens;
      } else {
        break;
      }
    }

    return {
      messages: trimmedMessages,
      maxTokens: contextWindow.maxTokens,
      currentTokens,
    };
  }

  /**
   * Load conversation history from the database
   */
  static async loadConversationHistory(
    sessionId: string,
    maxMessages: number = 20
  ): Promise<LLMMessage[]> {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
      take: maxMessages,
    });

    return messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
      content: msg.content,
      // Add toolCalls if they exist in metadata
      ...(msg.metadata && (msg.metadata as any).toolCalls 
        ? { toolCalls: (msg.metadata as any).toolCalls } 
        : {}),
      // Add toolCallId if it exists in metadata
      ...(msg.metadata && (msg.metadata as any).toolCallId 
        ? { toolCallId: (msg.metadata as any).toolCallId } 
        : {}),
    }));
  }

  /**
   * Save a message to the database
   */
  static async saveMessage(
    sessionId: string,
    userId: string,
    message: LLMMessage,
    model?: string,
    provider?: string,
    tokens?: number
  ): Promise<void> {
    await prisma.chatMessage.create({
      data: {
        content: message.content,
        role: message.role,
        tokens,
        model,
        provider,
        sessionId,
        userId,
        metadata: {
          toolCalls: message.toolCalls || [],
          toolCallId: message.toolCallId || null,
        },
      },
    });
  }
}

