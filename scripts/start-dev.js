#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Shadow AI Development Environment...\n');

// Check if .env exists
const envPath = path.resolve(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found. Creating from template...');
  const exampleEnvPath = path.resolve(__dirname, '..', '.env.example');
  if (fs.existsSync(exampleEnvPath)) {
    fs.copyFileSync(exampleEnvPath, envPath);
    console.log('✅ .env file created from .env.example');
  } else {
    console.error('❌ .env.example file not found. Please create .env manually.');
    process.exit(1);
  }
}

// Create workspace directory
const workspaceDir = '/tmp/shadow-workspace';
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
  console.log(`✅ Created workspace directory: ${workspaceDir}`);
}

console.log('\n📦 Starting services in development mode...\n');

// Start all services using Turbo
const turbo = spawn('yarn', ['dev'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

turbo.on('close', (code) => {
  console.log(`\n🛑 Development server exited with code ${code}`);
});

turbo.on('error', (error) => {
  console.error(`❌ Failed to start development server: ${error.message}`);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development environment...');
  turbo.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development environment...');
  turbo.kill('SIGTERM');
  process.exit(0);
});