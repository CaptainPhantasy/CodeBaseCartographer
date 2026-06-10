/**
 * Entry point for CodeBaseCartographer server
 */

import { Server } from './server.js';

async function main() {
  const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 17460;
  const WS_PORT = process.env.WS_PORT ? Number.parseInt(process.env.WS_PORT) : 17461;
  const WATCH_PATH = process.env.WATCH_PATH || process.cwd();
  const DB_PATH = process.env.DB_PATH || './tasks.db';

  const server = new Server(PORT, WS_PORT, WATCH_PATH, DB_PATH);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    server.stop();
    process.exit(0);
  });

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
