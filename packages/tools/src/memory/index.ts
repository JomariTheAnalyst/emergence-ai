import { z } from 'zod';
import { BaseTool, ToolDefinition, ToolExecutionContext, ToolResult } from '../base/tool';
import { MemoryManager, MemoryItem } from '@shadow/agents/memory';
import { MemoryType } from '@prisma/client';

/**
 * Save memory tool for storing important information
 */
export class SaveMemoryTool extends BaseTool<{
  title: string;
  content: string;
  type: MemoryType;
  tags?: string[];
  importance?: number;
  repositoryId?: string;
}, {
  id: string;
  saved: boolean;
}> {
  definition: ToolDefinition = {
    name: 'save_memory',
    description: 'Save important information to agent memory',
    category: 'memory',
    parameters: z.object({
      title: z.string().describe('Title or name for the memory'),
      content: z.string().describe('Content to save'),
      type: z.enum([
        'CODEBASE_SUMMARY',
        'IMPORTANT_FILE',
        'ARCHITECTURAL_DECISION',
        'BUG_REPORT',
        'FEATURE_REQUEST',
        'GENERAL',
        'CONVERSATION_SUMMARY',
        'TOOL_USAGE_PATTERN',
      ]).describe('Type of memory'),
      tags: z.array(z.string()).optional().default([]).describe('Tags for categorization'),
      importance: z.number().min(1).max(10).optional().default(5).describe('Importance level (1-10)'),
      repositoryId: z.string().optional().describe('Repository ID if memory is related to a repository'),
    }),
  };

  async execute(params: {
    title: string;
    content: string;
    type: MemoryType;
    tags?: string[];
    importance?: number;
    repositoryId?: string;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const memoryItem: MemoryItem = {
        title: params.title,
        content: params.content,
        type: params.type,
        tags: params.tags || [],
        importance: params.importance || 5,
      };

      const memoryId = await MemoryManager.saveMemory(
        context.userId,
        memoryItem,
        params.repositoryId || context.repositoryId
      );

      return this.success({
        id: memoryId,
        saved: true,
      });
    } catch (error) {
      return this.error(`Failed to save memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Recall memory tool for retrieving stored information
 */
export class RecallMemoryTool extends BaseTool<{
  id?: string;
  type?: MemoryType;
  tags?: string[];
  query?: string;
  limit?: number;
  minImportance?: number;
  repositoryId?: string;
}, {
  memories: MemoryItem[];
}> {
  definition: ToolDefinition = {
    name: 'recall_memory',
    description: 'Retrieve information from agent memory',
    category: 'memory',
    parameters: z.object({
      id: z.string().optional().describe('Specific memory ID to retrieve'),
      type: z.enum([
        'CODEBASE_SUMMARY',
        'IMPORTANT_FILE',
        'ARCHITECTURAL_DECISION',
        'BUG_REPORT',
        'FEATURE_REQUEST',
        'GENERAL',
        'CONVERSATION_SUMMARY',
        'TOOL_USAGE_PATTERN',
      ]).optional().describe('Type of memory to retrieve'),
      tags: z.array(z.string()).optional().describe('Tags to filter by'),
      query: z.string().optional().describe('Search query'),
      limit: z.number().optional().default(10).describe('Maximum number of memories to retrieve'),
      minImportance: z.number().min(1).max(10).optional().describe('Minimum importance level'),
      repositoryId: z.string().optional().describe('Repository ID to filter by'),
    }),
  };

  async execute(params: {
    id?: string;
    type?: MemoryType;
    tags?: string[];
    query?: string;
    limit?: number;
    minImportance?: number;
    repositoryId?: string;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      // If specific memory ID is provided, retrieve it
      if (params.id) {
        const memory = await MemoryManager.getMemory(params.id);
        
        if (!memory) {
          return this.error(`Memory not found with ID: ${params.id}`);
        }
        
        return this.success({
          memories: [memory],
        });
      }
      
      // Otherwise, search for memories based on criteria
      const memories = await MemoryManager.searchMemories(
        context.userId,
        {
          type: params.type,
          tags: params.tags,
          query: params.query,
          limit: params.limit,
          minImportance: params.minImportance,
        },
        params.repositoryId || context.repositoryId
      );
      
      return this.success({
        memories,
      });
    } catch (error) {
      return this.error(`Failed to recall memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Update memory tool for modifying existing memories
 */
export class UpdateMemoryTool extends BaseTool<{
  id: string;
  title?: string;
  content?: string;
  type?: MemoryType;
  tags?: string[];
  importance?: number;
}, {
  updated: boolean;
}> {
  definition: ToolDefinition = {
    name: 'update_memory',
    description: 'Update an existing memory',
    category: 'memory',
    parameters: z.object({
      id: z.string().describe('ID of the memory to update'),
      title: z.string().optional().describe('New title for the memory'),
      content: z.string().optional().describe('New content for the memory'),
      type: z.enum([
        'CODEBASE_SUMMARY',
        'IMPORTANT_FILE',
        'ARCHITECTURAL_DECISION',
        'BUG_REPORT',
        'FEATURE_REQUEST',
        'GENERAL',
        'CONVERSATION_SUMMARY',
        'TOOL_USAGE_PATTERN',
      ]).optional().describe('New type for the memory'),
      tags: z.array(z.string()).optional().describe('New tags for the memory'),
      importance: z.number().min(1).max(10).optional().describe('New importance level (1-10)'),
    }),
  };

  async execute(params: {
    id: string;
    title?: string;
    content?: string;
    type?: MemoryType;
    tags?: string[];
    importance?: number;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const updated = await MemoryManager.updateMemory(params.id, {
        title: params.title,
        content: params.content,
        type: params.type,
        tags: params.tags,
        importance: params.importance,
      });
      
      if (!updated) {
        return this.error(`Failed to update memory with ID: ${params.id}`);
      }
      
      return this.success({
        updated: true,
      });
    } catch (error) {
      return this.error(`Failed to update memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * List memories tool for browsing saved information
 */
export class ListMemoriesTool extends BaseTool<{
  type?: MemoryType;
  tags?: string[];
  limit?: number;
  repositoryId?: string;
}, {
  memories: Array<{
    id: string;
    title: string;
    type: MemoryType;
    tags: string[];
    importance: number;
    createdAt: string;
    lastAccess?: string;
  }>;
}> {
  definition: ToolDefinition = {
    name: 'list_memories',
    description: 'List saved memories',
    category: 'memory',
    parameters: z.object({
      type: z.enum([
        'CODEBASE_SUMMARY',
        'IMPORTANT_FILE',
        'ARCHITECTURAL_DECISION',
        'BUG_REPORT',
        'FEATURE_REQUEST',
        'GENERAL',
        'CONVERSATION_SUMMARY',
        'TOOL_USAGE_PATTERN',
      ]).optional().describe('Type of memories to list'),
      tags: z.array(z.string()).optional().describe('Tags to filter by'),
      limit: z.number().optional().default(20).describe('Maximum number of memories to list'),
      repositoryId: z.string().optional().describe('Repository ID to filter by'),
    }),
  };

  async execute(params: {
    type?: MemoryType;
    tags?: string[];
    limit?: number;
    repositoryId?: string;
  }, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const memories = await MemoryManager.searchMemories(
        context.userId,
        {
          type: params.type,
          tags: params.tags,
          limit: params.limit,
        },
        params.repositoryId || context.repositoryId
      );
      
      // Return only metadata, not full content
      const memoryList = memories.map(memory => ({
        id: memory.id!,
        title: memory.title,
        type: memory.type,
        tags: memory.tags,
        importance: memory.importance,
        createdAt: new Date().toISOString(), // This would come from the database in a real implementation
        lastAccess: undefined, // This would come from the database in a real implementation
      }));
      
      return this.success({
        memories: memoryList,
      });
    } catch (error) {
      return this.error(`Failed to list memories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

