#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Shadow AI Database...\n');

// Check if MySQL is available
try {
  console.log('📊 Checking MySQL connection...');
  execSync('mysql --version', { stdio: 'pipe' });
  console.log('✅ MySQL is available\n');
} catch (error) {
  console.error('❌ MySQL is not available. Please install MySQL first.');
  console.error('   Ubuntu/Debian: sudo apt-get install mysql-server');
  console.error('   macOS: brew install mysql');
  console.error('   Windows: Download from https://dev.mysql.com/downloads/mysql/');
  process.exit(1);
}

// Create database if it doesn't exist
try {
  console.log('🏗️  Creating database...');
  execSync(`mysql -u root -e "CREATE DATABASE IF NOT EXISTS shadow_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`, {
    stdio: 'pipe'
  });
  console.log('✅ Database created successfully\n');
} catch (error) {
  console.log('⚠️  Database creation failed, it might already exist or need password\n');
}

// Generate Prisma client
try {
  console.log('⚙️  Generating Prisma client...');
  execSync('yarn workspace @shadow/db generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  console.log('✅ Prisma client generated\n');
} catch (error) {
  console.error('❌ Failed to generate Prisma client:', error.message);
  process.exit(1);
}

// Push database schema
try {
  console.log('📤 Pushing database schema...');
  execSync('yarn workspace @shadow/db db:push', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  console.log('✅ Database schema pushed successfully\n');
} catch (error) {
  console.error('❌ Failed to push database schema:', error.message);
  process.exit(1);
}

console.log('🎉 Database setup complete!');
console.log('📝 Next steps:');
console.log('   1. Add your LLM API keys to .env file');
console.log('   2. Run: yarn dev');
console.log('   3. Visit: http://localhost:3000\n');