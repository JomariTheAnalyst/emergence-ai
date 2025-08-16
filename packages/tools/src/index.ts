// Export base tool classes
export * from './base/tool';

// Export file operation tools
export * from './file/operations';

// Export search tools
export * from './search/index';

// Export terminal tools
export * from './terminal/index';

// Export memory tools
export * from './memory/index';

// Export git tools
export * from './git/index';

// Import all tools
import { toolRegistry } from './base/tool';
import { ReadFileTool, WriteFileTool, EditFileTool, ListDirectoryTool, DeleteFileTool } from './file/operations';
import { GrepSearchTool, FuzzySearchTool, SymbolSearchTool } from './search/index';
import { ExecuteCommandTool, RunScriptTool, ProcessMonitorTool } from './terminal/index';
import { SaveMemoryTool, RecallMemoryTool, UpdateMemoryTool, ListMemoriesTool } from './memory/index';
import { GitStatusTool, GitCommitTool, GitPushTool, GitBranchTool, CreatePRTool } from './git/index';

// Register all tools
function registerAllTools() {
  // File tools
  toolRegistry.register(new ReadFileTool());
  toolRegistry.register(new WriteFileTool());
  toolRegistry.register(new EditFileTool());
  toolRegistry.register(new ListDirectoryTool());
  toolRegistry.register(new DeleteFileTool());

  // Search tools
  toolRegistry.register(new GrepSearchTool());
  toolRegistry.register(new FuzzySearchTool());
  toolRegistry.register(new SymbolSearchTool());

  // Terminal tools
  toolRegistry.register(new ExecuteCommandTool());
  toolRegistry.register(new RunScriptTool());
  toolRegistry.register(new ProcessMonitorTool());

  // Memory tools
  toolRegistry.register(new SaveMemoryTool());
  toolRegistry.register(new RecallMemoryTool());
  toolRegistry.register(new UpdateMemoryTool());
  toolRegistry.register(new ListMemoriesTool());

  // Git tools
  toolRegistry.register(new GitStatusTool());
  toolRegistry.register(new GitCommitTool());
  toolRegistry.register(new GitPushTool());
  toolRegistry.register(new GitBranchTool());
  toolRegistry.register(new CreatePRTool());
}

// Register all tools
registerAllTools();

// Export the tool registry
export { toolRegistry };

