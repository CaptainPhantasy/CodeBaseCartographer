#!/usr/bin/env tsx
/**
 * Manual test: Verify rollback functionality
 *
 * Prerequisites:
 * 1. Start the server: npm run server
 * 2. Run this script: npx tsx tests/manual/testRollback.ts
 *
 * This test:
 * 1. Creates a test file
 * 2. Writes content to it
 * 3. Modifies the content
 * 4. Verifies the change was recorded
 * 5. Rolls back the change
 * 6. Verifies the original content was restored
 */

import { randomUUID } from 'crypto';

const API_BASE = 'http://localhost:3000/api';

async function testRollback() {
  console.log('Starting rollback test...\n');

  const testFilePath = `test-${randomUUID()}.txt`;
  const originalContent = 'Original content\nLine 2\nLine 3';
  const modifiedContent = 'Modified content\nLine 2\nLine 3\nLine 4';

  try {
    // Step 1: Create initial file
    console.log('Step 1: Creating test file...');
    const createResponse = await fetch(`${API_BASE}/files/${testFilePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: originalContent }),
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create file');
    }
    console.log('✓ File created\n');

    // Step 2: Verify initial content
    console.log('Step 2: Verifying initial content...');
    const readResponse1 = await fetch(`${API_BASE}/files/${testFilePath}`);
    const file1 = await readResponse1.json();

    if (file1.content !== originalContent) {
      throw new Error('Initial content mismatch');
    }
    console.log('✓ Initial content verified\n');

    // Step 3: Modify file
    console.log('Step 3: Modifying file...');
    const modifyResponse = await fetch(`${API_BASE}/files/${testFilePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: modifiedContent }),
    });

    if (!modifyResponse.ok) {
      throw new Error('Failed to modify file');
    }
    console.log('✓ File modified\n');

    // Step 4: Get all changes and find the modification
    console.log('Step 4: Retrieving change journal...');
    const changesResponse = await fetch(`${API_BASE}/changes`);
    const changesData = await changesResponse.json();

    const modifyChange = changesData.changes.find(
      (c: any) => c.path === testFilePath && c.newContent === modifiedContent
    );

    if (!modifyChange) {
      throw new Error('Change not found in journal');
    }
    console.log(`✓ Found change: ${modifyChange.id}`);
    console.log(`  Old content: ${modifyChange.oldContent?.substring(0, 30)}...`);
    console.log(`  New content: ${modifyChange.newContent?.substring(0, 30)}...\n`);

    // Step 5: Verify modified content
    console.log('Step 5: Verifying modified content...');
    const readResponse2 = await fetch(`${API_BASE}/files/${testFilePath}`);
    const file2 = await readResponse2.json();

    if (file2.content !== modifiedContent) {
      throw new Error('Modified content mismatch');
    }
    console.log('✓ Modified content verified\n');

    // Step 6: Rollback the change
    console.log('Step 6: Rolling back change...');
    const rollbackResponse = await fetch(
      `${API_BASE}/changes/${modifyChange.id}/rollback`,
      { method: 'POST' }
    );

    if (!rollbackResponse.ok) {
      throw new Error('Failed to rollback');
    }
    const rollbackData = await rollbackResponse.json();
    console.log(`✓ Rollback successful: ${rollbackData.message}\n`);

    // Step 7: Verify original content was restored
    console.log('Step 7: Verifying rollback...');
    const readResponse3 = await fetch(`${API_BASE}/files/${testFilePath}`);
    const file3 = await readResponse3.json();

    if (file3.content !== originalContent) {
      console.error('Expected:', originalContent);
      console.error('Got:', file3.content);
      throw new Error('Rollback failed - content not restored');
    }
    console.log('✓ Original content restored!\n');

    // Cleanup
    console.log('Cleaning up...');
    await fetch(`${API_BASE}/files/${testFilePath}`, { method: 'DELETE' });
    console.log('✓ Test file deleted\n');

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testRollback();
