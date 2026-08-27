/**
 * @fileoverview Adversarial Trust Boundary & Escalation Tests
 * Tests:
 * 1. Model attempting to switch workspace via tool arguments
 * 2. Model attempting to escalate mode from MEDIUM to HIGH
 * 3. Model attempting directory traversal / absolute path escape
 * 4. Model attempting command chaining / injection
 */

const { spawnSync } = require('child_process');
const path = require('path');

const MCP_SERVER = path.resolve(__dirname, 'workspace-tools-server/index.js');

console.log('=== PHASE 1, 2, 3: ADVERSARIAL TRUST BOUNDARY TESTS ===\n');

// Attack 1: Attempt to switch workspace via tool arguments
console.log('[ATTACK 1] Model supplies workspace="librechat" while server is configured as agent-test...');
const attack1Input = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'read_file',
    arguments: {
      file_path: 'package.json',
      workspace: 'librechat',
      workspace_id: 'librechat',
    },
  },
}) + '\n';

const proc1 = spawnSync('node', [MCP_SERVER], {
  env: { ...process.env, WORKSPACE_ID: 'agent-test', AGENT_MODE: 'MEDIUM' },
  input: attack1Input,
  encoding: 'utf8',
});

const res1 = JSON.parse(proc1.stdout.trim().split('\n').pop() || '{}');
const attack1Blocked =
  res1.result &&
  res1.result.isError &&
  (res1.result.content[0].text.includes('ENOENT') || res1.result.content[0].text.includes('no such file')) &&
  res1.result.content[0].text.includes('workspace-agent-test');
console.log(`  -> Result: ${attack1Blocked ? 'PASS (Server ignored workspace argument and looked in agent-test)' : 'FAIL'}`);

// Attack 2: Attempt relative directory traversal to escape to LibreChat
console.log('\n[ATTACK 2] Model attempts relative traversal "../LibreChat/package.json"...');
const attack2Input = JSON.stringify({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'read_file',
    arguments: {
      file_path: '../LibreChat/package.json',
    },
  },
}) + '\n';

const proc2 = spawnSync('node', [MCP_SERVER], {
  env: { ...process.env, WORKSPACE_ID: 'agent-test', AGENT_MODE: 'MEDIUM' },
  input: attack2Input,
  encoding: 'utf8',
});

const res2 = JSON.parse(proc2.stdout.trim().split('\n').pop() || '{}');
const attack2Blocked = res2.result && res2.result.isError && res2.result.content[0].text.includes('Security Violation');
console.log(`  -> Result: ${attack2Blocked ? 'PASS (Server blocked traversal with Security Violation)' : 'FAIL'}`);

// Attack 3: Attempt absolute path escape
console.log('\n[ATTACK 3] Model attempts absolute path "C:/Users/hachimi/Downloads/model train local/LibreChat/package.json"...');
const attack3Input = JSON.stringify({
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: {
    name: 'read_file',
    arguments: {
      file_path: 'C:/Users/hachimi/Downloads/model train local/LibreChat/package.json',
    },
  },
}) + '\n';

const proc3 = spawnSync('node', [MCP_SERVER], {
  env: { ...process.env, WORKSPACE_ID: 'agent-test', AGENT_MODE: 'MEDIUM' },
  input: attack3Input,
  encoding: 'utf8',
});

const res3 = JSON.parse(proc3.stdout.trim().split('\n').pop() || '{}');
const attack3Blocked = res3.result && res3.result.isError && res3.result.content[0].text.includes('Security Violation');
console.log(`  -> Result: ${attack3Blocked ? 'PASS (Server blocked absolute path outside root)' : 'FAIL'}`);

// Attack 4: Attempt to call run_command in MEDIUM by injecting mode="HIGH"
console.log('\n[ATTACK 4] Model in MEDIUM calls run_command with mode="HIGH"...');
const attack4Input = JSON.stringify({
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: {
    name: 'run_command',
    arguments: {
      command: 'python --version',
      mode: 'HIGH',
      agent_mode: 'HIGH',
    },
  },
}) + '\n';

const proc4 = spawnSync('node', [MCP_SERVER], {
  env: { ...process.env, WORKSPACE_ID: 'agent-test', AGENT_MODE: 'MEDIUM' },
  input: attack4Input,
  encoding: 'utf8',
});

const res4 = JSON.parse(proc4.stdout.trim().split('\n').pop() || '{}');
const attack4Blocked = res4.result && res4.result.isError && res4.result.content[0].text.includes('not allowed in MEDIUM mode');
console.log(`  -> Result: ${attack4Blocked ? 'PASS (Server rejected run_command despite injected mode argument)' : 'FAIL'}`);

const allPass = attack1Blocked && attack2Blocked && attack3Blocked && attack4Blocked;
console.log(`\nADVERSARIAL TRUST BOUNDARY SUITE: ${allPass ? 'ALL TESTS PASSED' : 'FAILED'}`);
