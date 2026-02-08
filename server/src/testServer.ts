/**
 * Test script to verify server functionality
 */

import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DIR = resolve(process.cwd(), 'test-watch');
const TEST_FILE = resolve(TEST_DIR, 'test.txt');

function setupTestEnvironment() {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
  writeFileSync(TEST_FILE, 'Initial content\n', 'utf-8');
  console.log(`Test directory created: ${TEST_DIR}`);
  console.log(`Test file created: ${TEST_FILE}`);
}

function cleanupTestEnvironment() {
  try {
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
    console.log('Test file removed');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

async function runTests() {
  console.log('\n=== CodeBaseCartographer Server Tests ===\n');

  // Test 1: Import test
  console.log('Test 1: Importing server module...');
  try {
    const serverModule = await import(resolve(__dirname, './server.ts'));
    console.log('✓ Server module imported successfully');
  } catch (error) {
    console.error('✗ Failed to import server:', error.message);
    process.exit(1);
  }

  // Test 2: File operations
  console.log('\nTest 2: File operations...');
  try {
    const fileOperatorModule = await import(resolve(__dirname, './fileOperator.ts'));
    const { readFile, writeFile } = fileOperatorModule;

    setupTestEnvironment();
    const content = readFileSync(TEST_FILE, 'utf-8');
    console.log(`✓ Test file created with content: "${content.trim()}"`);
    cleanupTestEnvironment();
  } catch (error) {
    console.error('✗ File operations failed:', error.message);
  }

  // Test 3: Task store
  console.log('\nTest 3: Task store...');
  try {
    const taskStoreModule = await import(resolve(__dirname, './taskStore.ts'));
    const { TaskStore } = taskStoreModule;
    const store = new TaskStore(':memory:'); // Use in-memory database for tests
    await store.initialize();

    const task = await store.createTask({
      title: 'Test task',
      description: 'Test description',
      status: 'pending',
      priority: 'medium',
      files: [],
      dependencies: []
    });
    console.log(`✓ Task created with ID: ${task.id}`);

    const retrieved = await store.getTask(task.id);
    console.log(`✓ Task retrieved: ${retrieved.title}`);

    await store.deleteTask(task.id);
    console.log('✓ Task deleted');
  } catch (error) {
    console.error('✗ Task store failed:', error.message);
  }

  // Test 4: Change journal
  console.log('\nTest 4: Change journal...');
  try {
    const changeJournalModule = await import(resolve(__dirname, './changeJournal.ts'));
    const { ChangeJournal } = changeJournalModule;
    const journal = new ChangeJournal();

    const record = journal.record({
      timestamp: Date.now(),
      path: '/test/file.ts',
      oldContent: 'old',
      newContent: 'new'
    });
    console.log(`✓ Change recorded with ID: ${record.id}`);

    const changes = journal.listChanges();
    console.log(`✓ Retrieved ${changes.length} changes`);
  } catch (error) {
    console.error('✗ Change journal failed:', error.message);
  }

  console.log('\n=== All Tests Complete ===\n');
}

runTests().catch(console.error);
