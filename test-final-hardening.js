/**
 * @fileoverview Final Hardening Audit Test Suite
 * Tests:
 * 1. Session ID Injection Attack (verifies untrusted arguments CANNOT reset budgets)
 * 2. Mode Escalation Fuzzing (30 variations of injected authorization fields)
 * 3. Structured Test Registry (test_id lookup, rejecting arbitrary commands)
 * 4. Adapter Local Bearer Token Authentication (401 on missing/bad key, 200 on valid key)
 * 5. Exact Authoritative Tool Lists (tools/list for Medium & High)
 */

const path = require('path');
const { spawnSync } = require('child_process');

const MCP_SERVER = path.resolve(__dirname, 'workspace-tools-server/index.js');
const ADAPTER_AUTH_KEY = 'local-agent-secret-key-prod-8090';

async function runFinalHardeningAudit() {
  console.log('============================================================');
  console.log(' FINAL SECURITY-BOUNDARY HARDENING AUDIT');
  console.log('============================================================\n');

  let allPassed = true;

  // =========================================================================
  // 1. Session Attack Test: Model Attempts to Reset Budget via session_id
  // =========================================================================
  console.log('[TEST 1/5] Session Attack Test: Injecting session_id to reset budget...');
  const sessionAttackInputs = [
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: 'calculator.py' } } }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: 'calculator.py' } } }),
    JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: 'calculator.py' } } }),
    JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: 'calculator.py' } } }),
    JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: 'calculator.py' } } }),
    JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: 'calculator.py' } } }),
    // Attempt 7 with injected session_id = "fresh-session-1"
    JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: 'calculator.py', session_id: 'fresh-session-1' } } }),
    // Attempt 8 with injected session_id = "fresh-session-2"
    JSON.stringify({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'read_file', arguments: { file_path: 'calculator.py', session_id: 'fresh-session-2', conversation_id: 'fresh-2' } } }),
  ].join('\n') + '\n';

  const sessionProc = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'MEDIUM', WORKSPACE_ID: 'agent-test' },
    input: sessionAttackInputs,
    encoding: 'utf8',
  });

  const sessionOutputs = sessionProc.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const call6 = sessionOutputs[5];
  const call7 = sessionOutputs[6];
  const call8 = sessionOutputs[7];

  const call6Pass = call6.result && !call6.result.isError;
  const call7Blocked = call7.result && call7.result.isError && call7.result.content[0].text.includes('[MODE_BUDGET_EXHAUSTED]');
  const call8Blocked = call8.result && call8.result.isError && call8.result.content[0].text.includes('[MODE_BUDGET_EXHAUSTED]');

  if (call6Pass && call7Blocked && call8Blocked) {
    console.log('  -> PASS: Untrusted session_id in tool arguments had ZERO effect; calls 7 & 8 strictly blocked');
  } else {
    console.log('  -> FAIL: Session attack bypassed budget!', { call6Pass, call7Blocked, call8Blocked });
    allPassed = false;
  }

  // =========================================================================
  // 2. Mode Escalation Fuzzing (30 Variations)
  // =========================================================================
  console.log('\n[TEST 2/5] Mode Escalation Fuzzing (30 injected argument variations)...');
  const fuzzFields = [
    { mode: 'HIGH' },
    { agent_mode: 'HIGH' },
    { AGENT_MODE: 'HIGH' },
    { role: 'admin' },
    { role: 'system' },
    { permissions: ['all'] },
    { permission: 'superuser' },
    { bypass_budget: true },
    { max_reads: 999 },
    { budget: 1000 },
    { workspace: 'librechat' },
    { workspace_id: 'librechat' },
    { WORKSPACE_ID: 'librechat' },
    { session: 'new' },
    { session_id: 'admin_session' },
    { isAdmin: true },
    { auth: 'bearer token' },
    { override: true },
    { elevated: true },
    { root: true },
    { security: 'disabled' },
    { mode_override: 'HIGH' },
    { grant: 'run_command' },
    { tools: ['run_command'] },
    { allow: '*' },
    { unlimited: true },
    { quota: 9999 },
    { reset: true },
    { restart: true },
    { force: true },
  ];

  let fuzzPassed = true;
  for (let i = 0; i < fuzzFields.length; i++) {
    const injectedArgs = { file_path: 'calculator.py', ...fuzzFields[i] };
    const input = JSON.stringify({
      jsonrpc: '2.0',
      id: i + 1,
      method: 'tools/call',
      params: { name: 'get_workspace_info', arguments: injectedArgs },
    }) + '\n';

    const fuzzProc = spawnSync('node', [MCP_SERVER], {
      env: { ...process.env, AGENT_MODE: 'MEDIUM', WORKSPACE_ID: 'agent-test' },
      input,
      encoding: 'utf8',
    });

    const out = JSON.parse(fuzzProc.stdout.trim().split('\n').pop() || '{}');
    const info = JSON.parse(out.result?.content?.[0]?.text || '{}');

    if (info.mode !== 'MEDIUM' || info.workspace_id !== 'agent-test') {
      fuzzPassed = false;
      console.log(`  -> FAIL on variation ${i + 1}:`, fuzzFields[i]);
    }
  }

  if (fuzzPassed) {
    console.log(`  -> PASS: All ${fuzzFields.length} fuzz variations maintained trusted server mode (MEDIUM) and workspace (agent-test)`);
  } else {
    allPassed = false;
  }

  // =========================================================================
  // 3. Structured Test Command Registry
  // =========================================================================
  console.log('\n[TEST 3/5] Structured Test Command Registry...');
  // Test 3a: Valid registered test_id "unit"
  const testAInput = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'run_test', arguments: { test_id: 'unit' } },
  }) + '\n';

  const testAProc = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'HIGH', WORKSPACE_ID: 'agent-test' },
    input: testAInput,
    encoding: 'utf8',
  });
  const testARes = JSON.parse(testAProc.stdout.trim().split('\n').pop() || '{}');
  const testAData = JSON.parse(testARes.result?.content?.[0]?.text || '{}');
  const testAExecuted = testAData.test_id === 'unit' && testAData.command_executed === 'python test_discount_engine.py';

  // Test 3b: Valid registered test_id "calc" (passing test)
  const testCalcInput = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'run_test', arguments: { test_id: 'calc' } },
  }) + '\n';

  const testCalcProc = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'HIGH', WORKSPACE_ID: 'agent-test' },
    input: testCalcInput,
    encoding: 'utf8',
  });
  const testCalcRes = JSON.parse(testCalcProc.stdout.trim().split('\n').pop() || '{}');
  const testCalcData = JSON.parse(testCalcRes.result?.content?.[0]?.text || '{}');
  const testCalcPassed = testCalcData.test_id === 'calc' && testCalcData.passed === true;

  // Test 3c: Arbitrary command injection in test_id
  const testBInput = JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'run_test', arguments: { test_id: 'malicious; whoami' } },
  }) + '\n';

  const testBProc = spawnSync('node', [MCP_SERVER], {
    env: { ...process.env, AGENT_MODE: 'HIGH', WORKSPACE_ID: 'agent-test' },
    input: testBInput,
    encoding: 'utf8',
  });
  const testBRes = JSON.parse(testBProc.stdout.trim().split('\n').pop() || '{}');
  const testBBlocked = testBRes.result?.isError && testBRes.result.content[0].text.includes('Invalid test_id');

  if (testAExecuted && testCalcPassed && testBBlocked) {
    console.log('  -> PASS: Registered tests executed server-side; unregistered/injected test_id strictly rejected');
  } else {
    console.log('  -> FAIL: Structured test registry failed:', { testAExecuted, testCalcPassed, testBBlocked });
    allPassed = false;
  }

  // =========================================================================
  // 4. Adapter Local Bearer Token Authentication
  // =========================================================================
  console.log('\n[TEST 4/5] Adapter Local Bearer Token Authentication...');
  try {
    // 4a. Request without auth header -> 401
    const unauthRes = await fetch('http://127.0.0.1:8090/v1/models');
    const unauthPassed = unauthRes.status === 401;

    // 4b. Request with wrong auth key -> 401
    const badKeyRes = await fetch('http://127.0.0.1:8090/v1/models', {
      headers: { Authorization: 'Bearer wrong-secret-key' },
    });
    const badKeyPassed = badKeyRes.status === 401;

    // 4c. Request with valid bearer key -> 200
    const validKeyRes = await fetch('http://127.0.0.1:8090/v1/models', {
      headers: { Authorization: `Bearer ${ADAPTER_AUTH_KEY}` },
    });
    const validKeyPassed = validKeyRes.status === 200;

    // 4d. Request to /health (public monitoring) -> 200
    const healthRes = await fetch('http://127.0.0.1:8090/health');
    const healthPassed = healthRes.status === 200;

    if (unauthPassed && badKeyPassed && validKeyPassed && healthPassed) {
      console.log('  -> PASS: Local Bearer auth enforced: 401 on missing/invalid key, 200 on valid key, /health open');
    } else {
      console.log('  -> FAIL: Adapter auth verification failed:', { unauthPassed, badKeyPassed, validKeyPassed, healthPassed });
      allPassed = false;
    }
  } catch (err) {
    console.log('  -> FAIL: Adapter auth error:', err.message);
    allPassed = false;
  }

  // =========================================================================
  // 5. Authoritative Tool Lists for All Modes
  // =========================================================================
  console.log('\n[TEST 5/5] Authoritative Tool Enumeration from MCP Server...');
  function getToolsForMode(mode) {
    const sp = spawnSync('node', [MCP_SERVER], {
      env: { ...process.env, AGENT_MODE: mode },
      input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n',
      encoding: 'utf8',
    });
    const res = JSON.parse(sp.stdout.trim().split('\n').pop() || '{}');
    return res.result?.tools?.map((t) => t.name) || [];
  }

  const medTools = getToolsForMode('MEDIUM');
  const highTools = getToolsForMode('HIGH');

  console.log(`  -> LIGHT tools sent to LLM: 0 (No MCP servers bound)`);
  console.log(`  -> MEDIUM tool count: ${medTools.length} [${medTools.join(', ')}]`);
  console.log(`  -> HIGH tool count: ${highTools.length} [${highTools.join(', ')}]`);

  const toolMatch = medTools.length === 10 && highTools.length === 10 && !medTools.includes('run_command') && !highTools.includes('run_command');
  if (toolMatch) {
    console.log('  -> PASS: Authoritative tool sets consistent (10 structured tools each, 0 arbitrary shell tools)');
  } else {
    console.log('  -> FAIL: Tool count mismatch:', { medTools, highTools });
    allPassed = false;
  }

  console.log('\n============================================================');
  console.log(` FINAL HARDENING AUDIT SUMMARY: ${allPassed ? 'ALL TESTS PASSED (5/5)' : 'FAILED'}`);
  console.log('============================================================\n');
}

runFinalHardeningAudit();
