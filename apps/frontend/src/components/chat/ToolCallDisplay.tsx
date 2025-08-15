'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronRight, 
  Tool, 
  CheckCircle, 
  XCircle, 
  Clock,
  FileText,
  Terminal,
  Search,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ToolCall {
  name: string;
  parameters: any;
  result: any;
}

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
}

export function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTools(newExpanded);
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'read_file':
      case 'write_file':
      case 'edit_file':
        return <FileText className="h-4 w-4" />;
      case 'execute_command':
        return <Terminal className="h-4 w-4" />;
      case 'grep_search':
      case 'fuzzy_search':
        return <Search className="h-4 w-4" />;
      default:
        return <Tool className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (result: any) => {
    if (result?.success === true) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (result?.success === false) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getToolDisplayName = (toolName: string) => {
    return toolName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatParameters = (params: any) => {
    return Object.entries(params)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');
  };

  const formatResult = (result: any) => {
    if (typeof result === 'string') {
      return result;
    }
    
    if (result?.success === false) {
      return `Error: ${result.error}`;
    }
    
    if (result?.data) {
      if (typeof result.data === 'string') {
        return result.data.substring(0, 200) + (result.data.length > 200 ? '...' : '');
      }
      return JSON.stringify(result.data, null, 2);
    }
    
    return JSON.stringify(result, null, 2);
  };

  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <Card className="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          <Settings className="h-4 w-4" />
          <span>Tool Executions ({toolCalls.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {toolCalls.map((toolCall, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getToolIcon(toolCall.name)}
                    {getStatusIcon(toolCall.result)}
                    <span className="font-medium text-sm">
                      {getToolDisplayName(toolCall.name)}
                    </span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(index)}
                    className="h-6 w-6 p-0"
                  >
                    {expandedTools.has(index) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                </div>

                <AnimatePresence>
                  {expandedTools.has(index) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-2 text-xs">
                        <div>
                          <span className="font-medium text-muted-foreground">Parameters:</span>
                          <div className="mt-1 p-2 bg-muted rounded text-mono">
                            {formatParameters(toolCall.parameters)}
                          </div>
                        </div>
                        
                        <div>
                          <span className="font-medium text-muted-foreground">Result:</span>
                          <div className={cn(
                            "mt-1 p-2 rounded text-mono text-xs max-h-32 overflow-y-auto",
                            toolCall.result?.success === false 
                              ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                              : "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                          )}>
                            <pre className="whitespace-pre-wrap">
                              {formatResult(toolCall.result)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}