import { WebSocketManager } from './websocket';
import { llmService } from './llm';
import { prisma } from '@shadow/db';
import { 
  AgentOrchestrator, 
  createAgentOrchestrator, 
  ContextManager, 
  MemoryManager 
} from '@shadow/agents';
import { toolRegistry } from '@shadow/tools/base/tool';

export class AgentService {
  private wsManager: WebSocketManager;
  private orchestrators: Map<string, AgentOrchestrator> = new Map();

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
    console.log('Agent Service initialized');
  }

  /**
   * Get or create an agent orchestrator for a session
   */
  private async getOrchestrator(sessionId: string): Promise<AgentOrchestrator> {
    // Check if we already have an orchestrator for this session
    if (this.orchestrators.has(sessionId)) {
      return this.orchestrators.get(sessionId)!;
    }

    // Get session from database
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Create orchestrator based on provider
    const apiKey = process.env.EMERGENT_LLM_KEY || '';
    const orchestrator = createAgentOrchestrator(
      session.provider as 'gemini' | 'openrouter',
      apiKey
    );

    // Cache orchestrator
    this.orchestrators.set(sessionId, orchestrator);
    return orchestrator;
  }

  /**
   * Process a user message and generate a response
   */
  async processMessage(
    sessionId: string,
    userId: string,
    message: string,
    repositoryId?: string
  ) {
    try {
      // Send typing indicator
      this.wsManager.sendToUser(userId, {
        type: 'agent_typing',
        payload: {
          sessionId,
          typing: true,
        },
      });

      // Get or create session
      let session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        // Create new session
        session = await prisma.agentSession.create({
          data: {
            id: sessionId,
            provider: 'gemini',
            model: 'gemini-1.5-pro',
            userId,
          },
        });
      }

      // Save user message
      await ContextManager.saveMessage(
        sessionId,
        userId,
        { role: 'user', content: message }
      );

      // Get repository context if available
      let repositoryContext = '';
      if (repositoryId) {
        const summary = await MemoryManager.getRepositorySummary(repositoryId);
        if (summary) {
          repositoryContext = `Repository context: ${summary}\n\n`;
        }
      }

      // Get orchestrator
      const orchestrator = await this.getOrchestrator(sessionId);

      // Run agent
      const result = await orchestrator.run(
        message,
        {
          userId,
          sessionId,
          repositoryId,
          maxTokens: session.maxTokens,
          temperature: session.temperature,
        },
        {
          systemPrompt: `You are Shadow, an AI coding agent. You understand codebases, analyze code, generate solutions, debug issues, and help with development tasks. Be concise, accurate, and helpful. Use tools when appropriate to accomplish tasks.\n\n${repositoryContext}`,
          model: session.model,
          temperature: session.temperature,
        }
      );

      // Send response to user
      this.wsManager.sendToUser(userId, {
        type: 'agent_response',
        payload: {
          sessionId,
          message: result.response || 'I encountered an error processing your request.',
          error: result.error,
          toolCalls: Object.values(result.state.toolCalls),
          tokenUsage: result.state.tokenUsage,
          cost: result.state.cost,
        },
      });

      // Stop typing indicator
      this.wsManager.sendToUser(userId, {
        type: 'agent_typing',
        payload: {
          sessionId,
          typing: false,
        },
      });

      return result;
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Send error to user
      this.wsManager.sendToUser(userId, {
        type: 'agent_error',
        payload: {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // Stop typing indicator
      this.wsManager.sendToUser(userId, {
        type: 'agent_typing',
        payload: {
          sessionId,
          typing: false,
        },
      });

      throw error;
    }
  }

  /**
   * Execute a specific task
   */
  async executeTask(taskId: string, taskType: string, payload: any) {
    try {
      // Get task from database
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { user: true },
      });

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Update task status
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'IN_PROGRESS',
          progress: 10,
        },
      });

      // Broadcast task progress updates
      this.wsManager.sendToUser(task.userId, {
        type: 'task_progress',
        payload: {
          taskId,
          progress: 10,
          status: 'IN_PROGRESS',
        },
      });

      // Create task log
      await prisma.taskLog.create({
        data: {
          taskId,
          level: 'INFO',
          message: `Started task execution: ${taskType}`,
          metadata: payload,
        },
      });

      // Execute task based on type
      let result;
      switch (taskType) {
        case 'code_generation':
          result = await this.generateCode(task.id, payload.requirements, payload.context);
          break;
        case 'code_analysis':
          result = await this.analyzeCode(task.id, payload.code, payload.language);
          break;
        case 'codebase_analysis':
          result = await this.analyzeCodebase(task.id, payload.repositoryPath);
          break;
        default:
          throw new Error(`Unsupported task type: ${taskType}`);
      }

      // Update task status
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
        },
      });

      // Create task log
      await prisma.taskLog.create({
        data: {
          taskId,
          level: 'INFO',
          message: 'Task completed successfully',
          metadata: { result },
        },
      });

      // Broadcast task completion
      this.wsManager.sendToUser(task.userId, {
        type: 'task_completed',
        payload: {
          taskId,
          result,
          status: 'COMPLETED',
        },
      });

      return result;
    } catch (error) {
      console.error(`Error executing task ${taskId}:`, error);

      // Update task status
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          progress: 0,
        },
      });

      // Create task log
      await prisma.taskLog.create({
        data: {
          taskId,
          level: 'ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // Broadcast task failure
      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (task) {
        this.wsManager.sendToUser(task.userId, {
          type: 'task_failed',
          payload: {
            taskId,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'FAILED',
          },
        });
      }

      throw error;
    }
  }

  /**
   * Analyze a codebase
   */
  async analyzeCodebase(taskId: string, repositoryPath: string) {
    console.log(`Analyzing codebase at ${repositoryPath} for task ${taskId}`);
    
    // This would be implemented with actual codebase analysis logic
    // For now, we'll use the LLM to generate a placeholder analysis
    
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { repository: true },
    });

    if (!task || !task.repository) {
      throw new Error('Task or repository not found');
    }

    // Update progress
    await prisma.task.update({
      where: { id: taskId },
      data: { progress: 50 },
    });

    // Generate analysis using LLM
    const analysis = await llmService.sendChatMessage(
      taskId,
      `Analyze the codebase for repository: ${task.repository.name} (${task.repository.fullName}).
      Generate a comprehensive analysis including:
      1. Architecture overview
      2. Key components and their relationships
      3. Code quality assessment
      4. Potential improvements
      5. Technical debt areas
      
      Repository description: ${task.repository.description || 'No description available'}`
    );

    // Save analysis as memory
    await MemoryManager.saveRepositorySummary(
      task.userId,
      task.repository.id,
      analysis
    );

    return { analysis };
  }

  /**
   * Generate code based on requirements
   */
  async generateCode(taskId: string, requirements: string, context: any) {
    console.log(`Generating code for task ${taskId}`);
    
    // Update progress
    await prisma.task.update({
      where: { id: taskId },
      data: { progress: 50 },
    });

    // Generate code using LLM service
    const code = await llmService.generateCode(
      taskId,
      requirements,
      context.language || 'typescript',
      JSON.stringify(context)
    );

    return { code };
  }

  /**
   * Analyze code
   */
  async analyzeCode(taskId: string, code: string, language: string) {
    console.log(`Analyzing code for task ${taskId}`);
    
    // Update progress
    await prisma.task.update({
      where: { id: taskId },
      data: { progress: 50 },
    });

    // Analyze code using LLM service
    const analysis = await llmService.analyzeCode(
      taskId,
      code,
      language
    );

    return { analysis };
  }
}

// Export singleton instance
export const agentService = new AgentService(
  // This will be initialized later when the WebSocketManager is available
  null as any
);

