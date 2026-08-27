/**
 * @fileoverview Adversarial Sandbox, Lifecycle & Recovery Tests
 * Tests:
 * 1. Atomic edit failure simulation (file integrity preserved)
 * 2. Command injection prevention (chaining chars rejected)
 * 3. Git subcommand restrictions (status allowed, reset/clean/push rejected)
 * 4. Truncation of oversized outputs
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MCP_SERVER = path.resolve(__dirname, 'workspace-tools-server/index.js');
const FIXTURE_DIR = path.resolve(__dirname, 'workspace-agent-test');

console.log('=== PHASE 12, 13, 14, 19: ADVERSARIAL SANDBOX & RECOVERY TESTS ===\n');

let allPassed = true;

// 1. Atomic Edit Failure Simulation
console.log('[TEST 1/4] Atomic Edit Failure Simulation (File Integrity)...');
const testFilePath = path.join(FIXTURE_DIR, 'integrity_test.txt');
const initialContent = 'ORIGINAL_LINE_1\nORIGINAL_LINE_2\nORIGINAL_LINE_3';
fs.writeFileSync(testFilePath, initialContent, 'utf8');

// Run edit_file with target content that doesn't exist (simulating failure)
const editFailInput = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'edit_file',
    arguments: {
      file_path: 'integrity_test.txt',
      target_content: 'NON_EXISTENT_CONTENT',
      replacement_content: 'CORRUPTED',
    },
  },
}) + '\n';

const editRes = spawnSync('node', [MCP_SERVER], {
  env: { ...process.env, WORKSPACE_ID: 'agent-test', AGENT_MODE: 'HIGH' },
  input: editFailInput,
  encoding: 'utf8',
});

const currentContent = fs.readFileSync(testFilePath, 'utf8');
fs.unlinkSync(testFilePath); // Clean up

if (currentContent === initialContent) {
  console.log('  -> PASS: File content preserved exactly on edit failure (no partial writes)');
} else {
  console.log('  -> FAIL: File corrupted on edit failure!');
  allPassed = false;
}

// 2. Command Injection Prevention (Shell Chaining)
console.log('\n[TEST 2/4] Command Injection Resistance (Chaining Tokens)...');
const injectionTokens = ['&&', '||', ';', '|', '>', '`', '$'];
let injectPassed = true;

for (const tok of injectionTokens) {
  const cmd = `python --version ${tok} dir`;
  const input = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'run_command', arguments: { command: cmd } },
  }) + '\n';

  const res = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, WORKSPACE_ID: 'agent-test', AGENT_MODE: 'HIGH' },
    input,
    encoding: 'utf8',
  });

  const parsed = JSON.parse(res.stdout.trim().split('\n').pop() || '{}');
  if (!parsed.result || !parsed.result.isError || !parsed.result.content[0].text.includes('injection prevention')) {
    injectPassed = false;
    console.log(`  -> FAIL on token "${tok}"`);
  }
}
console.log(`  -> Result: ${injectPassed ? 'PASS (All command chaining tokens strictly blocked)' : 'FAIL'}`);
if (!injectPassed) allPassed = false;

// 3. Git Subcommand Allowlist & Restrictions
console.log('\n[TEST 3/4] Git Subcommand Restrictions...');
const gitTests = [
  { sub: 'status', expectAllowed: true },
  { sub: 'diff', expectAllowed: true },
  { sub: 'reset', expectAllowed: false },
  { sub: 'checkout', expectAllowed: false },
  { sub: 'clean', expectAllowed: false },
  { sub: 'commit', expectAllowed: false },
  { sub: 'push', expectAllowed: false },
];

let gitPassed = true;
for (const gt of gitTests) {
  const input = JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'run_command', arguments: { command: `git ${gt.sub}` } },
  }) + '\n';

  const res = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, WORKSPACE_ID: 'agent-test', AGENT_MODE: 'HIGH' },
    input,
    encoding: 'utf8',
  });

  const parsed = JSON.parse(res.stdout.trim().split('\n').pop() || '{}');
  const isErr = parsed.result?.isError;
  const isForbidden = parsed.result?.content?.[0]?.text?.includes('forbidden');

  if (gt.expectAllowed && isForbidden) {
    gitPassed = false;
    console.log(`  -> FAIL on allowed git command: git ${gt.sub}`);
  } else if (!gt.expectAllowed && !isForbidden) {
    gitPassed = false;
    console.log(`  -> FAIL on blocked git command: git ${gt.sub}`);
  }
}
console.log(`  -> Result: ${gitPassed ? 'PASS (Read-only git status/diff allowed, mutation subcommands blocked)' : 'FAIL'}`);
if (!gitPassed) allPassed = false;

// 4. Bounded Output Truncation
console.log('\n[TEST 4/4] Output Truncation with [TRUNCATED] Marker...');
const bigFilePath = path.join(FIXTURE_DIR, 'oversized_test.txt');
const bigContent = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}: ${'A'.repeat(50)}`).join('\n');
fs.writeFileSync(bigFilePath, bigContent, 'utf8');

const readInput = JSON.stringify({
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: { name: 'read_file', arguments: { file_path: 'oversized_test.txt', max_lines: 50 } },
}) + '\n';

const readRes = spawnSync('node', [MCP_SERVER], {
  env: { ...process.env, WORKSPACE_ID: 'agent-test', AGENT_MODE: 'HIGH' },
  input: readInput,
  encoding: 'utf8',
});

fs.unlinkSync(bigFilePath); // Clean up

const readParsed = JSON.parse(readRes.stdout.trim().split('\n').pop() || '{}');
const readText = readParsed.result?.content?.[0]?.text || '';
const hasTruncated = readText.includes('[TRUNCATED]');

if (hasTruncated) {
  console.log('  -> PASS: Oversized file read cleanly bounded with [TRUNCATED] metadata');
} else {
  console.log('  -> FAIL: [TRUNCATED] marker not present in oversized output:', readText);
  allPassed = false;
}

console.log(`\nADVERSARIAL SANDBOX SUITE: ${allPassed ? 'ALL TESTS PASSED' : 'FAILED'}`);
