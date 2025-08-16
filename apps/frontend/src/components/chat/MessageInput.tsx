import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Send, Paperclip, Mic, StopCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onSendFile?: (file: File) => void;
  isDisabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MessageInput({
  onSendMessage,
  onSendFile,
  isDisabled = false,
  placeholder = 'Type a message...',
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSendMessage = () => {
    if (message.trim() && !isDisabled) {
      onSendMessage(message);
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSendFile) {
      onSendFile(file);
      // Reset file input
      e.target.value = '';
    }
  };

  const toggleRecording = () => {
    // This would be implemented with actual speech recognition
    setIsRecording(!isRecording);
  };

  return (
    <div className={cn('flex flex-col space-y-2 p-4', className)}>
      <div className="flex items-end space-x-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          className="min-h-[60px] flex-1 resize-none rounded-lg"
          rows={1}
        />
        
        <div className="flex flex-col space-y-2">
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || isDisabled}
            size="icon"
            className="h-10 w-10"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-full p-0"
            onClick={handleFileClick}
            disabled={isDisabled || !onSendFile}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 w-8 rounded-full p-0',
              isRecording && 'bg-destructive text-destructive-foreground'
            )}
            onClick={toggleRecording}
            disabled={isDisabled}
          >
            {isRecording ? (
              <StopCircle className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground">
          {isRecording ? 'Recording...' : 'Press Enter to send'}
        </div>
      </div>
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

