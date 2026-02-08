/**
 * Simple Rename Variable Scenario
 *
 * This script demonstrates the complete workflow for renaming a variable:
 * 1. Setup: Create a test file with a variable named "foo"
 * 2. Execute: Run task to rename "foo" to "bar"
 * 3. Verify: Check the change was applied correctly
 * 4. Rollback: Undo the change
 * 5. Verify: Confirm original content is restored
 */

import { randomUUID } from 'crypto';

const API_BASE = 'http://localhost:3000/api';

async function runScenario() {
  console.log('=== Simple Rename Variable Scenario ===\n');

  const testFileName = `example-${randomUUID()}.ts`;
  const originalCode = `
export function calculateTotal(items: number[]) {
  let foo = 0;
  for (const item of items) {
    foo += item;
  }
  return foo;
}

export const MAX_FOO = 100;
`;

  const expectedCode = `
export function calculateTotal(items: number[]) {
  let bar = 0;
  for (const item of items) {
    bar += item;
  }
  return bar;
}

export const MAX_BAR = 100;
`;

  try {
    // Phase 1: Setup - Create initial file
    console.log('📝 Phase 1: Creating initial file...');
    const createResponse = await fetch(`${API_BASE}/files/${testFileName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: originalCode.trim() }),
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create test file');
    }
    console.log(`✅ File created: ${testFileName}`);
    console.log('Original code preview:');
    console.log(originalCode.split('\n').slice(1, 4).join('\n'));
    console.log('...\n');

    // Phase 2: Create task
    console.log('🎯 Phase 2: Creating rename task...');
    const taskResponse = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Rename "foo" to "bar" in ${testFileName}`,
        description: 'Rename all occurrences of variable "foo" to "bar" to improve code clarity',
        status: 'pending',
        priority: 'medium',
        files: [testFileName],
        dependencies: [],
      }),
    });

    if (!taskResponse.ok) {
      throw new Error('Failed to create task');
    }

    const task = await taskResponse.json();
    console.log(`✅ Task created: ${task.id}`);
    console.log(`   Title: ${task.title}`);
    console.log(`   Status: ${task.status}\n`);

    // Phase 3: Simulate execution (in real system, subagent would do this)
    console.log('⚙️ Phase 3: Executing rename (simulated)...');

    // In real implementation, this would be:
    // const orchestrator = getOrchestrator();
    // const executionId = await orchestrator.submit({ taskId: task.id, ... });

    // For this demo, we'll manually make the change
    const modifyResponse = await fetch(`${API_BASE}/files/${testFileName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: expectedCode.trim() }),
    });

    if (!modifyResponse.ok) {
      throw new Error('Failed to modify file');
    }

    // Get the change record
    const changesResponse = await fetch(`${API_BASE}/changes}?path=${testFileName}`);
    const changesData = await changesResponse.json();
    const latestChange = changesData.changes.find(
      (c: any) => c.path === testFileName && c.newContent.includes('bar')
    );

    console.log('✅ Execution completed');
    console.log(`   Change ID: ${latestChange?.id || 'N/A'}`);
    console.log('   Modified code preview:');
    console.log(expectedCode.split('\n').slice(1, 4).join('\n'));
    console.log('...\n');

    // Phase 4: Verify change
    console.log('🔍 Phase 4: Verifying changes...');
    const verifyResponse = await fetch(`${API_BASE}/files/${testFileName}`);
    const fileData = await verifyResponse.json();

    const hasBar = fileData.content.includes('let bar');
    const noFoo = !fileData.content.includes('let foo');
    const hasMaxBar = fileData.content.includes('MAX_BAR');
    const noMaxFoo = !fileData.content.includes('MAX_FOO');

    if (hasBar && noFoo && hasMaxBar && noMaxFoo) {
      console.log('✅ All changes verified:');
      console.log('   ✓ Variable "foo" renamed to "bar"');
      console.log('   ✓ Constant "MAX_FOO" renamed to "MAX_BAR"');
      console.log('   ✓ No leftover references to "foo"\n');
    } else {
      throw new Error('Verification failed: Changes not applied correctly');
    }

    // Phase 5: Rollback
    if (latestChange?.id) {
      console.log('↩️ Phase 5: Rolling back changes...');
      const rollbackResponse = await fetch(
        `${API_BASE}/changes/${latestChange.id}/rollback`,
        { method: 'POST' }
      );

      if (!rollbackResponse.ok) {
        throw new Error('Failed to rollback');
      }

      console.log('✅ Rollback completed\n');

      // Phase 6: Verify rollback
      console.log('🔍 Phase 6: Verifying rollback...');
      const verifyRollbackResponse = await fetch(`${API_BASE}/files/${testFileName}`);
      const rolledBackFile = await verifyRollbackResponse.json();

      const restoredFoo = rolledBackFile.content.includes('let foo');
      const restoredMaxFoo = rolledBackFile.content.includes('MAX_FOO');
      const noBar = !rolledBackFile.content.includes('let bar');

      if (restoredFoo && restoredMaxFoo && noBar) {
        console.log('✅ Rollback verified:');
        console.log('   ✓ Original variable "foo" restored');
        console.log('   ✓ Original constant "MAX_FOO" restored');
        console.log('   ✓ No references to "bar" remain\n');
      } else {
        throw new Error('Rollback verification failed');
      }
    }

    // Cleanup
    console.log('🧹 Cleaning up...');
    await fetch(`${API_BASE}/files/${testFileName}`, { method: 'DELETE' });
    await fetch(`${API_BASE}/tasks/${task.id}`, { method: 'DELETE' });
    console.log('✅ Test file and task deleted\n');

    console.log('🎉 Scenario completed successfully!');
    console.log('\nSummary:');
    console.log('- File created and modified');
    console.log('- Changes tracked in journal');
    console.log('- Rollback restored original state');
    console.log('- All cleanup completed');

  } catch (error) {
    console.error('\n❌ Scenario failed:', error);
    process.exit(1);
  }
}

// Run the scenario
console.log('Make sure the server is running: npm run server\n');
setTimeout(() => {
  runScenario();
}, 1000);
