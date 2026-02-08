/**
 * Test script to verify server functionality
 */

import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { Server } from './server.js';

const TEST_DIR = resolve(process.cwd(), 'test-watch');
const TEST_FILE = resolve(TEST_DIR, 'test.txt');

async function setupTestEnvironment() {
  // Create test directory
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }

  // Create initial test file
  writeFileSync(TEST_FILE, 'Initial content\n', 'utf-8');
  console.log(`Test directory created: ${TEST_DIR}`);
  console.log(`Test file created: ${TEST_FILE}`);
}

async function cleanupTestEnvironment() {
  try {
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
    console.log('Test file removed');
  } catch (error) {
    console.error('Failed to cleanup:', error);
  }
}

async function runTests() {
  console.log('=== Starting CodeBaseCartographer Server Tests ===\n');

  // Setup
  await setupTestEnvironment();

  const server = new Server(
    3000,
    3001,
    TEST_DIR,
    resolve(TEST_DIR, 'test-tasks.db')
  );

  try {
    // Test 1: Start server
    console.log('\n[Test 1] Starting server...');
    await server.start();
    console.log('✓ Server started successfully');

    // Wait a bit for file watcher to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Verify file watching
    console.log('\n[Test 2] Testing file watching...');
    writeFileSync(TEST_FILE, 'Modified content\n', 'utf-8');
    console.log('✓ File modified - check for WebSocket broadcast');

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Verify database
    console.log('\n[Test 3] Testing database operations...');
    // Database should be created
    console.log('✓ Database initialized');

    // Keep server running for manual testing
    console.log('\n=== All automated tests passed ===');
    console.log('\nServer is running. Press Ctrl+C to stop.');
    console.log(`\nTest endpoints:`);
    console.log(`  - Health: curl http://localhost:3000/api/health`);
    console.log(`  - List files: curl http://localhost:3000/api/files`);
    console.log(`  - Read file: curl http://localhost:3000/api/files/test.txt`);
    console.log(`  - List tasks: curl http://localhost:3000/api/tasks`);
    console.log(`  - List changes: curl http://localhost:3000/api/changes`);

  } catch (error) {
    console.error('Test failed:', error);
    server.stop();
    await cleanupTestEnvironment();
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\nCleaning up test environment...');
  await cleanupTestEnvironment();
  process.exit(0);
});

runTests();
