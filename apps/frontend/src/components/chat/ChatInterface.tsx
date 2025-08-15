'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Settings, Zap, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ModelSelector } from './ModelSelector';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useChat } from '@/hooks/useChat';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  tokens?: number;
  cost?: number;
  toolCalls?: Array<{
    name: string;
    parameters: any;
    result: any;
  }>;
}

interface LLMConfig {
  provider: 'gemini' | 'openrouter';
  model: string;
  apiKey?: string;
  useEmergentKey: boolean;
  temperature: number;
  maxTokens: number;
}

interface ChatInterfaceProps {
  llmConfig: LLMConfig;
  onConfigChange?: (config: LLMConfig) => void;
}

export function ChatInterface({ llmConfig, onConfigChange }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalUsage, setTotalUsage] = useState({ tokens: 0, cost: 0 });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isConnected, sendMessage: sendWsMessage } = useWebSocket();
  const { 
    sendMessage, 
    streamMessage, 
    createSession, 
    getCurrentSession 
  } = useChat();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize chat session on component mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const newSessionId = await createSession({
          provider: llmConfig.provider,
          model: llmConfig.model,
          temperature: llmConfig.temperature,
          maxTokens: llmConfig.maxTokens,
        });
        setSessionId(newSessionId);
        
        // Add welcome message
        const welcomeMessage: ChatMessage = {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: `Hello! I'm Shadow, your AI coding assistant. I'm running on **${llmConfig.model}** via ${llmConfig.provider}.\n\nI can help you with:\n- 🔍 Code review and analysis\n- 🛠️ File operations and editing\n- 🐛 Debugging and problem solving\n- 📋 Feature planning and architecture\n- 💻 Terminal commands and automation\n\nWhat would you like to work on today?`,
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      } catch (error) {
        console.error('Failed to initialize chat session:', error);
        // Add error message
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: 'Failed to initialize chat session. Please check your API configuration and try again.',
          timestamp: new Date(),
        };
        setMessages([errorMessage]);
      }
    };

    initializeSession();
  }, [llmConfig, createSession]);

  const handleSendMessage = async () => {
    if (!input.trim() || !sessionId || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    // Create assistant message for streaming
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      let fullContent = '';
      let usage = { tokens: 0, cost: 0 };
      let toolCalls: any[] = [];

      // Stream the response
      for await (const chunk of streamMessage(sessionId, input)) {
        if (chunk.delta) {
          fullContent += chunk.delta;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: fullContent }
              : msg
          ));
        }

        if (chunk.toolCalls) {
          toolCalls = [...toolCalls, ...chunk.toolCalls];
        }

        if (chunk.usage) {
          usage = chunk.usage;
        }
      }

      // Update final message with metadata
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: fullContent,
              model: llmConfig.model,
              tokens: usage.tokens,
              cost: usage.cost,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined
            }
          : msg
      ));

      // Update total usage
      setTotalUsage(prev => ({
        tokens: prev.tokens + usage.tokens,
        cost: prev.cost + usage.cost,
      }));

    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
            }
          : msg
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setTotalUsage({ tokens: 0, cost: 0 });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bot className="h-6 w-6 text-primary" />
              <div className={cn(
                "absolute -top-1 -right-1 w-3 h-3 rounded-full",
                isConnected ? "bg-green-500" : "bg-red-500"
              )}></div>
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Shadow AI Assistant</h2>
              <p className="text-xs text-muted-foreground">
                {llmConfig.model} • {totalUsage.tokens.toLocaleString()} tokens • ${totalUsage.cost.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Brain className="h-4 w-4 mr-2" />
              Model
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showModelSelector && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-border"
            >
              <ModelSelector
                config={llmConfig}
                onChange={(config) => {
                  onConfigChange?.(config);
                  setShowModelSelector(false);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <MessageBubble message={message} />
              </motion.div>
            ))}
          </AnimatePresence>

          {isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TypingIndicator />
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1 min-w-0">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your code..."
                disabled={isStreaming || !sessionId}
                className="min-h-[44px] resize-none"
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isStreaming || !sessionId}
              size="default"
              className="px-3"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'} • 
              Session: {sessionId?.substring(0, 8)}...
            </span>
            <span>
              Press Enter to send, Shift+Enter for new line
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}