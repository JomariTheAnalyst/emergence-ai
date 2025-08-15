import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User } from 'lucide-react';

export interface MessageProps {
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  timestamp: Date;
  avatar?: string;
  userName?: string;
  isLoading?: boolean;
  toolCalls?: Array<{
    name: string;
    parameters: any;
    result?: any;
    error?: string;
  }>;
}

export function Message({
  content,
  role,
  timestamp,
  avatar,
  userName,
  isLoading,
  toolCalls,
}: MessageProps) {
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';
  const isTool = role === 'tool';
  const isSystem = role === 'system';

  return (
    <div
      className={cn(
        'flex w-full gap-3 p-4',
        isUser ? 'justify-end' : 'justify-start',
        isSystem && 'opacity-80'
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatar} alt={role} />
          <AvatarFallback className={isAssistant ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
            {isAssistant ? 'AI' : isSystem ? 'SYS' : 'T'}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isUser ? userName || 'You' : isAssistant ? 'Shadow' : isSystem ? 'System' : 'Tool'}
          </span>
          <span className="text-xs text-muted-foreground">
            {timestamp.toLocaleTimeString()}
          </span>
        </div>

        <Card
          className={cn(
            'max-w-[80%] rounded-lg p-3',
            isUser
              ? 'bg-primary text-primary-foreground'
              : isAssistant
              ? 'bg-card'
              : isSystem
              ? 'bg-muted text-muted-foreground'
              : 'bg-secondary'
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>

          {toolCalls && toolCalls.length > 0 && (
            <div className="mt-2 border-t pt-2 text-xs">
              <div className="font-semibold">Tool Calls:</div>
              {toolCalls.map((tool, index) => (
                <div key={index} className="mt-1 rounded bg-muted p-1">
                  <div className="font-mono">{tool.name}</div>
                  {tool.error ? (
                    <div className="text-destructive">{tool.error}</div>
                  ) : (
                    tool.result && (
                      <div className="truncate">
                        {typeof tool.result === 'object'
                          ? JSON.stringify(tool.result).substring(0, 100) + '...'
                          : String(tool.result).substring(0, 100) + '...'}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatar} alt="User" />
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex w-full gap-3 p-4">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
      </Avatar>

      <Card className="w-fit rounded-lg bg-card p-3">
        <div className="flex space-x-1">
          <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0.2s' }}></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </Card>
    </div>
  );
}

