'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { User, Bot, AlertTriangle, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatDate } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallDisplay } from './ToolCallDisplay';

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

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const getIcon = () => {
    switch (message.role) {
      case 'user':
        return <User className="h-5 w-5" />;
      case 'assistant':
        return <Bot className="h-5 w-5" />;
      case 'system':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  const getMessageStyle = () => {
    switch (message.role) {
      case 'user':
        return 'ml-auto bg-primary text-primary-foreground';
      case 'assistant':
        return 'mr-auto bg-muted';
      case 'system':
        return 'mx-auto bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-300';
      default:
        return 'mr-auto bg-muted';
    }
  };

  const getAvatarStyle = () => {
    switch (message.role) {
      case 'user':
        return 'bg-primary text-primary-foreground';
      case 'assistant':
        return 'bg-blue-500 text-white';
      case 'system':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <motion.div
      className="flex items-start space-x-3 group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {message.role !== 'user' && (
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          getAvatarStyle()
        )}>
          {getIcon()}
        </div>
      )}

      <div className={cn("flex-1 max-w-3xl", message.role === 'user' ? 'flex justify-end' : '')}>
        <Card className={cn("relative", getMessageStyle())}>
          <CardContent className="p-4">
            {/* Message header for assistant messages */}
            {message.role === 'assistant' && (message.model || message.tokens || message.cost) && (
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/30">
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  {message.model && (
                    <span className="bg-background/50 px-2 py-1 rounded-md font-mono">
                      {message.model}
                    </span>
                  )}
                  {message.tokens && (
                    <span>{message.tokens.toLocaleString()} tokens</span>
                  )}
                  {message.cost && (
                    <span>${message.cost.toFixed(4)}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(message.timestamp)}
                </span>
              </div>
            )}

            {/* Message content */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <MarkdownRenderer content={message.content} />
              )}
            </div>

            {/* Tool calls display */}
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <ToolCallDisplay toolCalls={message.toolCalls} />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-muted-foreground">
                {formatDate(message.timestamp)}
              </span>
              
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 px-2 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {message.role === 'user' && (
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          getAvatarStyle()
        )}>
          {getIcon()}
        </div>
      )}
    </motion.div>
  );
}