# Shadow

An open-source background coding agent platform designed to understand, analyze, and contribute to existing codebases through intelligent automation.

## Features

- **Real-time Chat Interface** - Natural language interaction with AI agents
- **Terminal Emulator** - Execute commands with real-time streaming output
- **File Explorer** - Browse and manage codebase files with syntax highlighting
- **Multi-provider LLM Support** - Integration with Anthropic, OpenAI, and OpenRouter
- **GitHub Integration** - Automatic repository cloning, branch management, and PR generation
- **Semantic Search** - AI-powered code search and understanding
- **Memory System** - Repository-specific knowledge retention
- **Security Isolation** - Command validation and workspace boundary enforcement

## Architecture

- **Frontend** (`apps/frontend/`) - Next.js application with modern UI
- **Server** (`apps/server/`) - Node.js orchestrator with WebSocket communication
- **Sidecar** (`apps/sidecar/`) - Express.js service for file operations
- **Database** (`packages/db/`) - Prisma schema with PostgreSQL
- **Types** (`packages/types/`) - Shared TypeScript definitions
- **Security** (`packages/command-security/`) - Command validation utilities

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up the database:
```bash
npm run generate
npm run db:push
```

3. Start development servers:
```bash
npm run dev
```

## License

MIT License