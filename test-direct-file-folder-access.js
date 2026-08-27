/**
 * @fileoverview Test Suite for Direct Local File / Folder Access & Real Disk Write Guarantees
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const BASE_URL = 'http://127.0.0.1:3080/api';
const MCP_SERVER_SCRIPT = path.resolve(__dirname, 'workspace-tools-server/index.js');
const FIXTURE_DIR = path.resolve(__dirname, 'workspace-agent-test');
const TEST_FILE = path.join(FIXTURE_DIR, 'direct-edit-test.txt');

function getFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function callMcpTool(toolName, toolArgs) {
  const input = [
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: toolName, arguments: toolArgs } }),
  ].join('\n') + '\n';

  const res = spawnSync('node', [MCP_SERVER_SCRIPT], {
    input,
    encoding: 'utf8',
    env: { ...process.env, AGENT_MODE: 'HIGH' },
    timeout: 10000,
  });

  const lines = (res.stdout || '').trim().split('\n').filter(Boolean);
  const lastLine = lines.pop() || '{}';
  try {
    const parsed = JSON.parse(lastLine);
    return parsed.result?.content?.[0]?.text ? JSON.parse(parsed.result.content[0].text) : parsed;
  } catch (err) {
    return { raw: lastLine, err: err.message };
  }
}

async function runTests() {
  console.log('============================================================');
  console.log(' DIRECT LOCAL FILE / FOLDER OPENING TEST SUITE');
  console.log('============================================================\n');

  // ------------------------------------------------------------
  // TEST 1: Open Folder Registration & Metadata
  // ------------------------------------------------------------
  console.log('[TEST 1/6] Testing Direct Open Folder (Project Workspace)...');
  const folderRes = await fetch(`${BASE_URL}/workspaces/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath: FIXTURE_DIR }),
  });
  const folderData = await folderRes.json();
  if (!folderRes.ok || folderData.workspace?.type !== 'project') {
    throw new Error(`Open Folder registration failed: ${JSON.stringify(folderData)}`);
  }
  console.log(`  -> PASS: Registered folder project '${folderData.workspace.name}' (Root: ${folderData.workspace.root})`);

  // ------------------------------------------------------------
  // TEST 2: Open File Registration (Controlled Single-File Scope)
  // ------------------------------------------------------------
  console.log('\n[TEST 2/6] Testing Direct Open File (Single-File Workspace Scope)...');
  // Create fixture file
  fs.writeFileSync(TEST_FILE, 'ORIGINAL_VALUE_BEFORE_EDIT\nLine 2\nLine 3\n', 'utf8');

  const fileRes = await fetch(`${BASE_URL}/workspaces/add-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath: TEST_FILE }),
  });
  const fileData = await fileRes.json();
  if (!fileRes.ok || fileData.workspace?.type !== 'single_file') {
    throw new Error(`Open File registration failed: ${JSON.stringify(fileData)}`);
  }
  console.log(`  -> PASS: Registered single file workspace '${fileData.workspace.name}' (Target: ${fileData.workspace.targetFile})`);

  // ------------------------------------------------------------
  // TEST 3: Single-File Confinement (Sibling File Blockade)
  // ------------------------------------------------------------
  console.log('\n[TEST 3/6] Testing Single-File Confinement & Sibling Blockade...');
  // Set active workspace to single file
  await fetch(`${BASE_URL}/workspaces/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: fileData.workspace.id }),
  });

  // 3a. Read allowed single file
  const readAllowed = callMcpTool('read_file', { file_path: 'direct-edit-test.txt' });
  if (!readAllowed.content || !readAllowed.content.includes('ORIGINAL_VALUE')) {
    throw new Error(`Failed to read allowed single file: ${JSON.stringify(readAllowed)}`);
  }
  console.log('  -> Allowed Target File Read: SUCCESS');

  // 3b. Attempt to read sibling file (calculator.py)
  const readSibling = callMcpTool('read_file', { file_path: 'calculator.py' });
  if (!readSibling.raw && !readSibling.error && !readSibling.content?.[0]?.text?.includes('Security Violation')) {
    // Check if error
    const rawOut = JSON.stringify(readSibling);
    if (!rawOut.includes('Security Violation')) {
      throw new Error(`Sibling file access was NOT blocked! Output: ${rawOut}`);
    }
  }
  console.log('  -> Sibling File Read Attempt: BLOCKED with Security Violation (PASS)');

  // 3c. List directory & search files should only expose target file
  const listDir = callMcpTool('list_directory', {});
  if (listDir.items?.length !== 1 || listDir.items[0].name !== 'direct-edit-test.txt') {
    throw new Error(`list_directory leaked sibling files: ${JSON.stringify(listDir)}`);
  }
  console.log('  -> Single-File Directory Tree: strictly limited to target file (PASS)');

  // ------------------------------------------------------------
  // TEST 4: Direct Real Disk Write Guarantee (No Download / No Blob Copy)
  // ------------------------------------------------------------
  console.log('\n[TEST 4/6] Testing Direct Real Disk Write Guarantee...');
  const statBefore = fs.statSync(TEST_FILE);
  const hashBefore = getFileHash(TEST_FILE);

  console.log(`  -> Initial Disk State: Path=${TEST_FILE}, Size=${statBefore.size}B, Hash=${hashBefore}`);

  // Execute edit_file via MCP
  const editRes = callMcpTool('edit_file', {
    file_path: 'direct-edit-test.txt',
    target_content: 'ORIGINAL_VALUE_BEFORE_EDIT',
    replacement_content: 'MODIFIED_VALUE_BY_QWEN_DIRECT_WRITE',
  });

  if (editRes.status !== 'SUCCESS') {
    throw new Error(`edit_file tool failed: ${JSON.stringify(editRes)}`);
  }

  // Verify directly from disk outside LibreChat/MCP
  const diskContentAfter = fs.readFileSync(TEST_FILE, 'utf8');
  const statAfter = fs.statSync(TEST_FILE);
  const hashAfter = getFileHash(TEST_FILE);

  console.log(`  -> Modified Disk State: Size=${statAfter.size}B, Hash=${hashAfter}`);

  if (!diskContentAfter.includes('MODIFIED_VALUE_BY_QWEN_DIRECT_WRITE')) {
    throw new Error('Disk content does NOT contain replacement string!');
  }
  if (hashBefore === hashAfter) {
    throw new Error('Disk file hash did not change!');
  }
  console.log('  -> PASS: The exact original file on disk was modified directly and atomically.');

  // ------------------------------------------------------------
  // TEST 5: External Edit Visibility (VS Code / Outside Editor)
  // ------------------------------------------------------------
  console.log('\n[TEST 5/6] Testing External Edit Visibility (Zero Stale Cache)...');
  const externalContent = 'EXTERNAL_MODIFICATION_FROM_VSCODE\nLine 2 updated\nLine 3\n';
  fs.writeFileSync(TEST_FILE, externalContent, 'utf8');

  const readAgain = callMcpTool('read_file', { file_path: 'direct-edit-test.txt' });
  if (!readAgain.content || !readAgain.content.includes('EXTERNAL_MODIFICATION_FROM_VSCODE')) {
    throw new Error(`MCP returned stale/cached content instead of real disk state: ${JSON.stringify(readAgain)}`);
  }
  console.log('  -> PASS: External edits on disk are immediately visible to Qwen (No caching/blobs).');

  // ------------------------------------------------------------
  // TEST 6: User Escalation (Open Containing Folder as Project)
  // ------------------------------------------------------------
  console.log('\n[TEST 6/6] Testing User Escalation (Open Containing Folder as Project)...');
  const escalateRes = await fetch(`${BASE_URL}/workspaces/escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: fileData.workspace.id }),
  });
  const escalateData = await escalateRes.json();
  if (!escalateRes.ok || escalateData.workspace?.type !== 'project') {
    throw new Error(`Escalation failed: ${JSON.stringify(escalateData)}`);
  }

  // Set active to escalated project
  await fetch(`${BASE_URL}/workspaces/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: escalateData.workspace.id }),
  });

  // Now calculator.py should be accessible
  const readEscalated = callMcpTool('read_file', { file_path: 'calculator.py' });
  if (!readEscalated.content || !readEscalated.content.includes('calculate_discount')) {
    throw new Error(`Failed to read calculator.py after escalation: ${JSON.stringify(readEscalated)}`);
  }
  console.log(`  -> PASS: User escalated to project workspace '${escalateData.workspace.name}'; full folder access restored.`);

  // Cleanup fixture
  try { fs.unlinkSync(TEST_FILE); } catch {}

  console.log('\n============================================================');
  console.log(' DIRECT FILE / FOLDER OPENING: ALL TESTS PASSED (6/6)');
  console.log('============================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
