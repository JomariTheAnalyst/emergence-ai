import React, { useEffect, useRef } from 'react';
import { Message, MessageProps, TypingIndicator } from './Message';
import { cn } from '../../lib/utils';

export interface MessageListProps {
  messages: MessageProps[];
  isTyping?: boolean;
  className?: string;
}

export function MessageList({ messages, isTyping = false, className }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change or typing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className={cn('flex flex-col overflow-y-auto', className)}>
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center p-4">
          <div className="text-center text-muted-foreground">
            <h3 className="text-lg font-semibold">Welcome to Shadow</h3>
            <p className="mt-2">Start a conversation with your AI coding agent.</p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message, index) => (
            <Message key={index} {...message} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}

