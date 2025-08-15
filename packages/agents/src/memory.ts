import { prisma } from '@shadow/db';
import { MemoryType } from '@prisma/client';

/**
 * Memory item interface
 */
export interface MemoryItem {
  id?: string;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  importance: number;
  embedding?: number[];
}

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  type?: MemoryType;
  tags?: string[];
  query?: string;
  limit?: number;
  minImportance?: number;
}

/**
 * Memory manager for storing and retrieving agent memories
 */
export class MemoryManager {
  /**
   * Save a memory item to the database
   */
  static async saveMemory(
    userId: string,
    memory: MemoryItem,
    repositoryId?: string
  ): Promise<string> {
    const result = await prisma.memory.create({
      data: {
        type: memory.type,
        title: memory.title,
        content: memory.content,
        tags: memory.tags,
        importance: memory.importance,
        embedding: memory.embedding,
        userId,
        repositoryId,
      },
    });

    return result.id;
  }

  /**
   * Update an existing memory item
   */
  static async updateMemory(
    memoryId: string,
    updates: Partial<MemoryItem>
  ): Promise<boolean> {
    try {
      await prisma.memory.update({
        where: { id: memoryId },
        data: {
          ...(updates.type && { type: updates.type }),
          ...(updates.title && { title: updates.title }),
          ...(updates.content && { content: updates.content }),
          ...(updates.tags && { tags: updates.tags }),
          ...(updates.importance && { importance: updates.importance }),
          ...(updates.embedding && { embedding: updates.embedding }),
          lastAccess: new Date(),
        },
      });
      
      return true;
    } catch (error) {
      console.error('Failed to update memory:', error);
      return false;
    }
  }

  /**
   * Retrieve a memory by ID
   */
  static async getMemory(memoryId: string): Promise<MemoryItem | null> {
    try {
      const memory = await prisma.memory.update({
        where: { id: memoryId },
        data: {
          accessed: { increment: 1 },
          lastAccess: new Date(),
        },
      });

      if (!memory) return null;

      return {
        id: memory.id,
        type: memory.type,
        title: memory.title,
        content: memory.content,
        tags: memory.tags as string[],
        importance: memory.importance,
        embedding: memory.embedding as number[] | undefined,
      };
    } catch (error) {
      console.error('Failed to retrieve memory:', error);
      return null;
    }
  }

  /**
   * Search for memories based on various criteria
   */
  static async searchMemories(
    userId: string,
    options: MemorySearchOptions,
    repositoryId?: string
  ): Promise<MemoryItem[]> {
    try {
      const memories = await prisma.memory.findMany({
        where: {
          userId,
          ...(repositoryId && { repositoryId }),
          ...(options.type && { type: options.type }),
          ...(options.tags && { tags: { hasEvery: options.tags } }),
          ...(options.minImportance && { importance: { gte: options.minImportance } }),
        },
        orderBy: [
          { importance: 'desc' },
          { lastAccess: 'desc' },
        ],
        take: options.limit || 10,
      });

      // Update access count for retrieved memories
      await Promise.all(
        memories.map(memory =>
          prisma.memory.update({
            where: { id: memory.id },
            data: {
              accessed: { increment: 1 },
              lastAccess: new Date(),
            },
          })
        )
      );

      return memories.map(memory => ({
        id: memory.id,
        type: memory.type,
        title: memory.title,
        content: memory.content,
        tags: memory.tags as string[],
        importance: memory.importance,
        embedding: memory.embedding as number[] | undefined,
      }));
    } catch (error) {
      console.error('Failed to search memories:', error);
      return [];
    }
  }

  /**
   * Delete a memory
   */
  static async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      await prisma.memory.delete({
        where: { id: memoryId },
      });
      
      return true;
    } catch (error) {
      console.error('Failed to delete memory:', error);
      return false;
    }
  }

  /**
   * Get repository summary from memories
   */
  static async getRepositorySummary(repositoryId: string): Promise<string | null> {
    try {
      const summaryMemory = await prisma.memory.findFirst({
        where: {
          repositoryId,
          type: 'CODEBASE_SUMMARY',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return summaryMemory?.content || null;
    } catch (error) {
      console.error('Failed to get repository summary:', error);
      return null;
    }
  }

  /**
   * Create or update repository summary
   */
  static async saveRepositorySummary(
    userId: string,
    repositoryId: string,
    summary: string
  ): Promise<string> {
    try {
      // Check if summary exists
      const existingSummary = await prisma.memory.findFirst({
        where: {
          repositoryId,
          type: 'CODEBASE_SUMMARY',
        },
      });

      if (existingSummary) {
        // Update existing summary
        await prisma.memory.update({
          where: { id: existingSummary.id },
          data: {
            content: summary,
            lastAccess: new Date(),
          },
        });

        return existingSummary.id;
      } else {
        // Create new summary
        const newSummary = await prisma.memory.create({
          data: {
            type: 'CODEBASE_SUMMARY',
            title: 'Repository Summary',
            content: summary,
            tags: ['summary', 'repository'],
            importance: 10,
            userId,
            repositoryId,
          },
        });

        return newSummary.id;
      }
    } catch (error) {
      console.error('Failed to save repository summary:', error);
      throw error;
    }
  }
}

