import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';

// Helper functions for common operations
export class DatabaseHelper {
  static async createUser(data: {
    email: string;
    name?: string;
    avatar?: string;
  }) {
    return prisma.user.create({
      data,
    });
  }

  static async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        repositories: true,
        tasks: true,
      },
    });
  }

  static async createRepository(data: {
    name: string;
    fullName: string;
    description?: string;
    url: string;
    private?: boolean;
    defaultBranch?: string;
    owner: string;
    userId: string;
  }) {
    return prisma.repository.create({
      data,
    });
  }

  static async getRepositoryWithTasks(repositoryId: string) {
    return prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        tasks: {
          include: {
            logs: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        memories: true,
      },
    });
  }

  static async createTask(data: {
    title: string;
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    repositoryId: string;
    userId: string;
    assignedAgent?: string;
  }) {
    return prisma.task.create({
      data,
    });
  }

  static async updateTaskProgress(taskId: string, progress: number, status?: string) {
    const updateData: any = { progress };
    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }

    return prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });
  }

  static async addTaskLog(data: {
    taskId: string;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    metadata?: any;
  }) {
    return prisma.taskLog.create({
      data,
    });
  }

  static async createChatMessage(data: {
    content: string;
    role: 'user' | 'assistant' | 'system';
    userId: string;
    taskId?: string;
    metadata?: any;
  }) {
    return prisma.chatMessage.create({
      data,
    });
  }

  static async getChatHistory(userId: string, taskId?: string, limit = 50) {
    return prisma.chatMessage.findMany({
      where: {
        userId,
        taskId,
      },
      orderBy: {
        timestamp: 'asc',
      },
      take: limit,
    });
  }

  static async createMemory(data: {
    type: 'CODEBASE_SUMMARY' | 'IMPORTANT_FILE' | 'ARCHITECTURAL_DECISION' | 'BUG_REPORT' | 'FEATURE_REQUEST' | 'GENERAL';
    title: string;
    content: string;
    tags: string[];
    repositoryId: string;
    userId: string;
  }) {
    return prisma.memory.create({
      data,
    });
  }

  static async searchMemories(repositoryId: string, query: string) {
    return prisma.memory.findMany({
      where: {
        repositoryId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { tags: { has: query } },
        ],
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  static async recordToolCall(data: {
    name: string;
    parameters: any;
    result?: any;
    error?: string;
  }) {
    return prisma.toolCall.create({
      data,
    });
  }

  static async storeFileEmbedding(data: {
    filePath: string;
    content: string;
    embedding: number[];
    repository: string;
  }) {
    return prisma.fileEmbedding.upsert({
      where: {
        filePath_repository: {
          filePath: data.filePath,
          repository: data.repository,
        },
      },
      update: {
        content: data.content,
        embedding: data.embedding,
        updatedAt: new Date(),
      },
      create: data,
    });
  }

  static async createTerminalSession(sessionId: string, workingDir: string) {
    return prisma.terminalSession.create({
      data: {
        sessionId,
        workingDir,
        environment: {},
        active: true,
      },
    });
  }

  static async getActiveTerminalSession(sessionId: string) {
    return prisma.terminalSession.findUnique({
      where: { sessionId },
    });
  }

  static async closeTerminalSession(sessionId: string) {
    return prisma.terminalSession.update({
      where: { sessionId },
      data: { active: false },
    });
  }
}