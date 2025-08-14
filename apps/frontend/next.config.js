/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  transpilePackages: ['@shadow/types'],
  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000',
  },
  webpack: (config) => {
    // Handle monaco-editor
    config.module.rules.push({
      test: /\.ttf$/,
      type: 'asset/resource',
    });
    
    return config;
  },
};

module.exports = nextConfig;