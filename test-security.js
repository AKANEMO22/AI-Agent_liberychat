const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testRoot = path.resolve('workspace-agent-test');
const evilRoot = path.resolve('workspace-agent-test-evil');

// 1. Setup evil sibling
if (!fs.existsSync(evilRoot)) fs.mkdirSync(evilRoot, { recursive: true });
fs.writeFileSync(path.join(evilRoot, 'secret.txt'), 'SUPER_SECRET_DATA', 'utf8');

// 2. Setup escape junction inside testRoot if Windows permissions allow
const junctionPath = path.join(testRoot, 'escape-junction');
let junctionCreated = false;
try {
  if (fs.existsSync(junctionPath)) fs.rmdirSync(junctionPath);
  fs.symlinkSync(evilRoot, junctionPath, 'junction');
  junctionCreated = true;
} catch (e) {
  console.log('[INFO] Junction creation note:', e.message);
}

// 3. Test script executing tools against testRoot
const serverPath = path.resolve('workspace-tools-server/index.js');

function callTool(toolName, args) {
  const inputJson = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: toolName, arguments: args }
  }) + '\n';

  const res = spawnSync('node', [serverPath], {
    input: inputJson,
    encoding: 'utf8',
    env: { ...process.env, WORKSPACE_ROOT: testRoot }
  });

  const lines = (res.stdout || '').split('\n').filter(l => l.trim());
  if (lines.length === 0) return { error: 'No output from tool server', stderr: res.stderr };
  try {
    return JSON.parse(lines[0]);
  } catch {
    return { raw: lines[0], stderr: res.stderr };
  }
}

console.log('=== RUNNING COMPREHENSIVE SECURITY GATE TESTS ===');

// Gate 1: Prefix Collision
const prefixRes = callTool('read_file', { file_path: '../workspace-agent-test-evil/secret.txt' });
console.log('1. Prefix Collision Test:', prefixRes.result?.isError ? 'PASS (Blocked)' : 'FAIL (Allowed)', prefixRes.result?.content?.[0]?.text);

// Gate 2: Directory Traversal
const trav1 = callTool('read_file', { file_path: '../../../Windows/System32/drivers/etc/hosts' });
console.log('2a. Traversal Windows/System32:', trav1.result?.isError ? 'PASS (Blocked)' : 'FAIL (Allowed)');

const trav2 = callTool('read_file', { file_path: 'C:/Users/hachimi/AppData/Roaming' });
console.log('2b. Absolute Path AppData:', trav2.result?.isError ? 'PASS (Blocked)' : 'FAIL (Allowed)');

// Gate 3: Junction / Symlink Escape
if (junctionCreated) {
  const juncRes = callTool('read_file', { file_path: 'escape-junction/secret.txt' });
  console.log('3. Junction Escape Test:', juncRes.result?.isError ? 'PASS (Blocked)' : 'FAIL (Allowed)', juncRes.result?.content?.[0]?.text);
  try { fs.rmdirSync(junctionPath); } catch {}
} else {
  console.log('3. Junction Escape Test: BLOCKED (No permission)');
}

// Gate 4: Command Chaining & Injections
const inj1 = callTool('run_command', { command: "python -c \"print('test')\" && echo PWNED" });
console.log('4a. Chaining (&&):', inj1.result?.isError ? 'PASS (Blocked)' : 'FAIL (Allowed)');

const inj2 = callTool('run_command', { command: "git status ; echo PWNED" });
console.log('4b. Semicolon (;):', inj2.result?.isError ? 'PASS (Blocked)' : 'FAIL (Allowed)');

const inj3 = callTool('run_command', { command: "python -c \"print('test')\" | echo PWNED" });
console.log('4c. Pipe (|):', inj3.result?.isError ? 'PASS (Blocked)' : 'FAIL (Allowed)');

const inj4 = callTool('run_command', { command: "git reset --hard" });
console.log('4d. Forbidden Git Subcommand (reset):', inj4.result?.isError ? 'PASS (Blocked)' : 'FAIL (Allowed)');

const inj5 = callTool('run_command', { command: "powershell -Command Get-Process" });
console.log('4e. Non-allowlisted Executable (powershell):', inj5.result?.isError ? 'PASS (Blocked)' : 'FAIL (Allowed)');

const validCmd = callTool('run_command', { command: "python test_calculator.py" });
console.log('5. Valid Allowlisted Command:', !validCmd.result?.isError ? 'PASS (Allowed)' : 'FAIL', validCmd.result?.content?.[0]?.text?.substring(0, 80));

// Cleanup evil directory
try { fs.unlinkSync(path.join(evilRoot, 'secret.txt')); fs.rmdirSync(evilRoot); } catch {}
