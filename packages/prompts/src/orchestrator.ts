import { PromptParser, ParsedPrompt, ContextSource } from './parser';
import { toolRegistry } from '@shadow/tools';
import { prisma } from '@shadow/db';

export interface PromptExecutionContext {
  userId: string;
  sessionId?: string;
  repositoryId?: string;
  workspaceDir: string;
  variables: Record<string, any>;
  memories: Map<string, any>;
}

export interface PromptExecutionResult {
  success: boolean;
  content?: string;
  error?: string;
  toolCalls?: Array<{
    name: string;
    parameters: any;
    result: any;
  }>;
  memories?: Record<string, any>;
  metadata: Record<string, any>;
}

export class PromptOrchestrator {
  private parser: PromptParser;
  private templateCache = new Map<string, ParsedPrompt>();

  constructor() {
    this.parser = new PromptParser();
  }

  async loadPrompt(name: string): Promise<ParsedPrompt> {
    // Check cache first
    if (this.templateCache.has(name)) {
      return this.templateCache.get(name)!;
    }

    // Load from database
    const template = await prisma.promptTemplate.findFirst({
      where: { name, active: true },
      orderBy: { version: 'desc' },
    });

    if (!template) {
      throw new Error(`Prompt template '${name}' not found`);
    }

    const parsed = this.parser.parse(template.content);
    this.templateCache.set(name, parsed);

    // Update usage count
    await prisma.promptTemplate.update({
      where: { id: template.id },
      data: { usageCount: { increment: 1 } },
    });

    return parsed;
  }

  async execute(
    promptName: string,
    context: PromptExecutionContext
  ): Promise<PromptExecutionResult> {
    try {
      const prompt = await this.loadPrompt(promptName);
      
      // Validate required variables
      const missingVars = prompt.variables
        .filter(v => v.required && !(v.name in context.variables))
        .map(v => v.name);

      if (missingVars.length > 0) {
        return {
          success: false,
          error: `Missing required variables: ${missingVars.join(', ')}`,
          metadata: {},
        };
      }

      // Process context sources
      const enrichedContext = { ...context };
      for (const contextSource of prompt.contexts) {
        const contextValue = await this.resolveContext(contextSource, context);
        if (contextValue !== null) {
          enrichedContext.variables[`context:${contextSource.source}:${contextSource.key || contextSource.path || contextSource.name}`] = contextValue;
        }
      }

      // Process memory operations
      for (const memOp of prompt.memory) {
        if (memOp.operation === 'recall') {
          const memoryValue = context.memories.get(memOp.key) || memOp.default;
          if (memoryValue) {
            enrichedContext.variables[`memory:${memOp.key}`] = memoryValue;
          }
        }
      }

      // Render the prompt
      const renderedContent = this.parser.render(prompt, enrichedContext.variables);

      // Execute tool calls if specified
      const toolCalls: Array<{ name: string; parameters: any; result: any }> = [];
      
      if (prompt.tools.length > 0) {
        // This is a simplified example - in practice, you'd integrate with LLM tool calling
        for (const tool of prompt.tools) {
          if (tool.required) {
            const toolResult = await toolRegistry.execute(
              tool.name,
              enrichedContext.variables,
              {
                workspaceDir: context.workspaceDir,
                userId: context.userId,
                sessionId: context.sessionId,
                repositoryId: context.repositoryId,
              }
            );

            toolCalls.push({
              name: tool.name,
              parameters: enrichedContext.variables,
              result: toolResult,
            });
          }
        }
      }

      // Save memories
      const updatedMemories: Record<string, any> = {};
      for (const memOp of prompt.memory) {
        if (memOp.operation === 'save' && memOp.content) {
          const memoryContent = this.parser.render({ ...prompt, content: memOp.content }, enrichedContext.variables);
          updatedMemories[memOp.key] = memoryContent;
          
          // Save to database
          if (context.repositoryId) {
            await prisma.memory.upsert({
              where: {
                repositoryId_userId_title: {
                  repositoryId: context.repositoryId,
                  userId: context.userId,
                  title: memOp.key,
                }
              },
              create: {
                repositoryId: context.repositoryId,
                userId: context.userId,
                type: memOp.type as any || 'GENERAL',
                title: memOp.key,
                content: memoryContent,
                tags: [],
              },
              update: {
                content: memoryContent,
                updatedAt: new Date(),
                accessed: { increment: 1 },
                lastAccess: new Date(),
              },
            });
          }
        }
      }

      return {
        success: true,
        content: renderedContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        memories: Object.keys(updatedMemories).length > 0 ? updatedMemories : undefined,
        metadata: {
          promptId: prompt.id,
          version: prompt.version,
          provider: prompt.provider,
          variablesUsed: Object.keys(enrichedContext.variables),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {},
      };
    }
  }

  private async resolveContext(
    contextSource: ContextSource,
    context: PromptExecutionContext
  ): Promise<any> {
    try {
      switch (contextSource.source) {
        case 'file':
          if (!contextSource.path) return null;
          const fileResult = await toolRegistry.execute(
            'read_file',
            { path: contextSource.path },
            {
              workspaceDir: context.workspaceDir,
              userId: context.userId,
              sessionId: context.sessionId,
              repositoryId: context.repositoryId,
            }
          );
          return fileResult.success ? fileResult.data?.content : contextSource.fallback;

        case 'memory':
          if (!contextSource.key) return null;
          return context.memories.get(contextSource.key) || contextSource.fallback;

        case 'tool':
          if (!contextSource.name) return null;
          const toolResult = await toolRegistry.execute(
            contextSource.name,
            contextSource.parameters || {},
            {
              workspaceDir: context.workspaceDir,
              userId: context.userId,
              sessionId: context.sessionId,
              repositoryId: context.repositoryId,
            }
          );
          return toolResult.success ? toolResult.data : contextSource.fallback;

        case 'variable':
          if (!contextSource.key) return null;
          return context.variables[contextSource.key] || contextSource.fallback;

        case 'api':
          // TODO: Implement API context resolution
          return contextSource.fallback;

        default:
          return contextSource.fallback;
      }
    } catch (error) {
      console.error(`Failed to resolve context ${contextSource.source}:`, error);
      return contextSource.fallback;
    }
  }

  async savePromptTemplate(
    name: string,
    content: string,
    category: string,
    variables?: Record<string, any>,
    provider?: string
  ): Promise<void> {
    // Parse to validate
    const parsed = this.parser.parse(content);

    await prisma.promptTemplate.create({
      data: {
        name,
        category,
        content,
        variables: variables || {},
        provider,
        version: parsed.version,
        active: true,
      },
    });

    // Clear cache
    this.templateCache.delete(name);
  }

  async listPromptTemplates(category?: string): Promise<Array<{
    name: string;
    category: string;
    version: string;
    usageCount: number;
  }>> {
    const templates = await prisma.promptTemplate.findMany({
      where: {
        active: true,
        ...(category && { category }),
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
        { version: 'desc' },
      ],
    });

    return templates.map(t => ({
      name: t.name,
      category: t.category,
      version: t.version,
      usageCount: t.usageCount,
    }));
  }
}