import { z } from 'zod';

// Base tool interface
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolExecutionContext {
  workspaceDir: string;
  userId: string;
  sessionId?: string;
  repositoryId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'file' | 'search' | 'terminal' | 'memory' | 'git' | 'analysis' | 'utility';
  parameters: z.ZodSchema;
  dangerous?: boolean; // Requires confirmation
  requiresWorkspace?: boolean;
}

export abstract class BaseTool<TParams = any, TResult = any> {
  abstract definition: ToolDefinition;
  
  abstract execute(
    params: TParams,
    context: ToolExecutionContext
  ): Promise<ToolResult<TResult>>;

  // Validate parameters before execution
  validateParameters(params: unknown): TParams {
    try {
      return this.definition.parameters.parse(params) as TParams;
    } catch (error) {
      throw new Error(`Invalid parameters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to create success result
  protected success<T>(data: T, metadata?: Record<string, any>): ToolResult<T> {
    return {
      success: true,
      data,
      metadata,
    };
  }

  // Helper method to create error result
  protected error(message: string, metadata?: Record<string, any>): ToolResult {
    return {
      success: false,
      error: message,
      metadata,
    };
  }
}

// Tool registry for managing all available tools
export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  register(tool: BaseTool): void {
    this.tools.set(tool.definition.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }

  listByCategory(category: string): ToolDefinition[] {
    return this.list().filter(def => def.category === category);
  }

  async execute(
    name: string,
    params: unknown,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
      };
    }

    try {
      const validatedParams = tool.validateParameters(params);
      return await tool.execute(validatedParams, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Global tool registry instance
export const toolRegistry = new ToolRegistry();