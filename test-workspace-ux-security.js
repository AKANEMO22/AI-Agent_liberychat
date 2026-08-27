/**
 * @fileoverview Test Suite for Workspace / Project UX & Security Confinement
 * Tests:
 * 1. Blacklisted dangerous roots (C:\, C:\Windows, C:\Users, Program Files) rejected
 * 2. Project feature detection (Python, TypeScript, Git)
 * 3. Dynamic MCP workspace binding across project switches
 * 4. Model argument injection attempts completely ignored
 * 5. Cross-project directory traversal strictly blocked
 * 6. Removing project from registry preserves physical files
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LIBRECHAT_URL = 'http://localhost:3080';
const MCP_SERVER = path.resolve(__dirname, 'workspace-tools-server/index.js');

async function runWorkspaceSecurityTests() {
  console.log('============================================================');
  console.log(' WORKSPACE / PROJECT UX & SECURITY TEST SUITE');
  console.log('============================================================\n');

  let allPassed = true;

  // -------------------------------------------------------------
  // Test 1: Blacklisted Dangerous Roots Rejection
  // -------------------------------------------------------------
  console.log('[TEST 1/6] Testing Blacklisted Unsafe Roots Rejection...');
  const dangerousPaths = [
    'C:\\',
    'C:/',
    'C:\\Windows',
    'C:\\Windows\\System32',
    'C:\\Users',
    process.env.ProgramFiles || 'C:\\Program Files',
    process.env.APPDATA || 'C:\\Users\\hachimi\\AppData\\Roaming',
  ];

  let dangerBlockedCount = 0;
  for (const badPath of dangerousPaths) {
    try {
      const res = await fetch(`${LIBRECHAT_URL}/api/workspaces/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: badPath }),
      });
      const data = await res.json();
      if (!res.ok && data.error && data.error.includes('Security Violation')) {
        dangerBlockedCount++;
      } else {
        console.log(`  -> FAILED to block dangerous path: '${badPath}'`, data);
      }
    } catch (err) {
      console.log(`  -> Error testing ${badPath}:`, err.message);
    }
  }

  if (dangerBlockedCount === dangerousPaths.length) {
    console.log(`  -> PASS: All ${dangerousPaths.length} dangerous system roots strictly rejected with Security Violation`);
  } else {
    console.log(`  -> FAIL: Blocked ${dangerBlockedCount}/${dangerousPaths.length} dangerous paths`);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // Test 2: Valid Project Registration & Feature Detection
  // -------------------------------------------------------------
  console.log('\n[TEST 2/6] Testing Valid Project Registration & Metadata Detection...');
  try {
    const targetFolder = path.resolve(__dirname, 'workspace-agent-test');
    const res = await fetch(`${LIBRECHAT_URL}/api/workspaces/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: targetFolder, name: 'Agent Test Fixture' }),
    });
    const data = await res.json();
    const isRegistered = res.status === 201 || res.status === 200;
    const hasPython = data.workspace?.projectType?.includes('Python');
    const hasGit = data.workspace?.hasGit === true;

    if (isRegistered && hasPython && hasGit) {
      console.log(`  -> PASS: Registered '${data.workspace.name}' (${data.workspace.projectType}, Git: ${data.workspace.hasGit}, ID: ${data.workspace.id})`);
    } else {
      console.log('  -> FAIL: Project registration failed:', data);
      allPassed = false;
    }
  } catch (err) {
    console.log('  -> FAIL in test 2:', err.message);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // Test 3: Dynamic MCP Binding - Project A (workspace-agent-test)
  // -------------------------------------------------------------
  console.log('\n[TEST 3/6] Testing Dynamic MCP Tool Confinement for Project A (workspace-agent-test)...');
  // Select ws_agent_test
  await fetch(`${LIBRECHAT_URL}/api/workspaces/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: 'ws_agent_test' }),
  });

  // Call get_workspace_info
  const infoProcA = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'HIGH' },
    input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_workspace_info', arguments: {} } }) + '\n',
    encoding: 'utf8',
  });
  const infoResA = JSON.parse(infoProcA.stdout.trim().split('\n').pop() || '{}');
  const infoDataA = JSON.parse(infoResA.result?.content?.[0]?.text || '{}');

  // Call read_file calculator.py
  const readProcA = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'HIGH' },
    input: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: 'calculator.py' } } }) + '\n',
    encoding: 'utf8',
  });
  const readResA = JSON.parse(readProcA.stdout.trim().split('\n').pop() || '{}');
  const readDataA = JSON.parse(readResA.result?.content?.[0]?.text || '{}');

  // Attempt escape to LibreChat
  const escapeProcA = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'HIGH' },
    input: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: '../LibreChat/package.json' } } }) + '\n',
    encoding: 'utf8',
  });
  const escapeResA = JSON.parse(escapeProcA.stdout.trim().split('\n').pop() || '{}');
  const escapeBlockedA = escapeResA.result?.isError && escapeResA.result.content[0].text.includes('Security Violation');

  const test3Pass = infoDataA.project_name === 'workspace-agent-test' && readDataA.file_path === 'calculator.py' && escapeBlockedA;
  if (test3Pass) {
    console.log('  -> PASS: Confined to workspace-agent-test; read calculator.py succeeded; escape to ../LibreChat blocked');
  } else {
    console.log('  -> FAIL in test 3:', { infoDataA, readDataA, escapeResA });
    allPassed = false;
  }

  // -------------------------------------------------------------
  // Test 4: Dynamic MCP Binding - Project B (LibreChat)
  // -------------------------------------------------------------
  console.log('\n[TEST 4/6] Testing Dynamic MCP Tool Confinement after Switch to Project B (LibreChat)...');
  // Switch to ws_librechat
  await fetch(`${LIBRECHAT_URL}/api/workspaces/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: 'ws_librechat' }),
  });

  // Call get_workspace_info
  const infoProcB = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'HIGH' },
    input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_workspace_info', arguments: {} } }) + '\n',
    encoding: 'utf8',
  });
  const infoResB = JSON.parse(infoProcB.stdout.trim().split('\n').pop() || '{}');
  const infoDataB = JSON.parse(infoResB.result?.content?.[0]?.text || '{}');

  // Call read_file package.json in LibreChat
  const readProcB = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'HIGH' },
    input: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: 'package.json' } } }) + '\n',
    encoding: 'utf8',
  });
  const readResB = JSON.parse(readProcB.stdout.trim().split('\n').pop() || '{}');
  const readDataB = JSON.parse(readResB.result?.content?.[0]?.text || '{}');

  // Attempt escape to workspace-agent-test
  const escapeProcB = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'HIGH' },
    input: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: '../workspace-agent-test/calculator.py' } } }) + '\n',
    encoding: 'utf8',
  });
  const escapeResB = JSON.parse(escapeProcB.stdout.trim().split('\n').pop() || '{}');
  const escapeBlockedB = escapeResB.result?.isError && escapeResB.result.content[0].text.includes('Security Violation');

  const test4Pass = infoDataB.project_name === 'LibreChat' && readDataB.file_path === 'package.json' && escapeBlockedB;
  if (test4Pass) {
    console.log('  -> PASS: Confined to LibreChat; read package.json succeeded; escape to ../workspace-agent-test blocked');
  } else {
    console.log('  -> FAIL in test 4:', { infoDataB, readDataB, escapeResB });
    allPassed = false;
  }

  // -------------------------------------------------------------
  // Test 5: Model Argument Injection Ignored
  // -------------------------------------------------------------
  console.log('\n[TEST 5/6] Testing Model Argument Injection Resistance...');
  const injectProc = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'HIGH' },
    input: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'read_file',
        arguments: {
          file_path: 'package.json',
          workspace_root: 'C:\\Users\\hachimi\\Downloads\\model train local\\workspace-agent-test',
          workspace_id: 'ws_agent_test',
          override_path: 'C:\\',
        },
      },
    }) + '\n',
    encoding: 'utf8',
  });
  const injectRes = JSON.parse(injectProc.stdout.trim().split('\n').pop() || '{}');
  const injectData = JSON.parse(injectRes.result?.content?.[0]?.text || '{}');
  // Since active workspace is LibreChat, it must read package.json in LibreChat and completely ignore the injected workspace_root
  const injectIgnored = injectData.file_path === 'package.json';

  if (injectIgnored) {
    console.log('  -> PASS: Model-injected workspace_root and workspace_id arguments had ZERO authority on server');
  } else {
    console.log('  -> FAIL: Model injection compromised workspace confinement:', injectRes);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // Test 6: Remove Project Registry Entry Does NOT Delete Files
  // -------------------------------------------------------------
  console.log('\n[TEST 6/6] Testing Remove from Registry (File Preservation Guarantee)...');
  // Create disposable directory fixture
  const tempFixture = path.resolve(__dirname, 'temp-disposable-project');
  if (!fs.existsSync(tempFixture)) fs.mkdirSync(tempFixture, { recursive: true });
  fs.writeFileSync(path.join(tempFixture, 'test.txt'), 'disposable content', 'utf8');

  const addTempRes = await fetch(`${LIBRECHAT_URL}/api/workspaces/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath: tempFixture, name: 'Disposable Project' }),
  });
  const addTempData = await addTempRes.json();
  const tempWsId = addTempData.workspace?.id;

  // Remove from registry
  const delRes = await fetch(`${LIBRECHAT_URL}/api/workspaces/${tempWsId}`, { method: 'DELETE' });
  const delData = await delRes.json();

  // Verify file still exists on disk
  const fileStillExists = fs.existsSync(path.join(tempFixture, 'test.txt'));
  // Clean up disposable test folder
  fs.rmSync(tempFixture, { recursive: true, force: true });

  if (delRes.ok && delData.status === 'REMOVED_FROM_REGISTRY' && fileStillExists) {
    console.log('  -> PASS: Project removed from registry; underlying physical files and source code 100% preserved');
  } else {
    console.log('  -> FAIL: File preservation check failed:', { delData, fileStillExists });
    allPassed = false;
  }

  // Reset active workspace back to ws_agent_test for default state
  await fetch(`${LIBRECHAT_URL}/api/workspaces/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: 'ws_agent_test' }),
  });

  console.log('\n============================================================');
  console.log(` WORKSPACE SECURITY RESULT: ${allPassed ? 'ALL TESTS PASSED (6/6)' : 'FAILED'}`);
  console.log('============================================================\n');
}

runWorkspaceSecurityTests();
