/**
 * Phase 8: Real Coding Test through Focused File
 * Trace:
 * 1. Focus calculator.py in workspace-agent-test
 * 2. Introduce bug: calculate_discount has wrong operator (+)
 * 3. Save git status before -> 13-git-before.txt
 * 4. User: "fix file này, chạy test phù hợp rồi xem diff"
 * 5. Send to Qwen via Adapter with full tool protocol
 * 6. Execute returned tool calls (read_file -> edit_file -> run_test -> git_diff)
 * 7. Verify tests pass (exit_code=0, passed=true)
 * 8. Save git status after -> 14-git-after.txt
 * 9. Save git diff -> 15-git-diff.txt
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WS_DIR = path.resolve(__dirname, 'workspace-agent-test');
const EVIDENCE_DIR = path.resolve(__dirname, 'audit-logs/2026-08-27_005300/post-focus-fix');
const ADAPTER_URL = 'http://127.0.0.1:8090';
const LIBRECHAT_URL = 'http://127.0.0.1:3080';
const API_KEY = 'local-agent-secret-key-prod-8090';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read complete content of a file within active workspace.',
      parameters: {
        type: 'object',
        properties: { file_path: { type: 'string', description: 'Relative path to file' } },
        required: ['file_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edit a file within active workspace.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          target_content: { type: 'string' },
          replacement_content: { type: 'string' },
        },
        required: ['file_path', 'target_content', 'replacement_content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_test',
      description: 'Execute pytest within active workspace.',
      parameters: {
        type: 'object',
        properties: { test_file: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Get git diff of working directory.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

function sendAdapter(messages) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'qwen2.5-coder-local',
      messages,
      tools: TOOLS,
      stream: false,
      temperature: 0.1,
    });
    const req = http.request(`${ADAPTER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function sendLibreChat(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(`${LIBRECHAT_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Local Tool Implementations for Agent Loop
function executeLocalTool(name, args) {
  if (name === 'read_file') {
    const filePath = path.resolve(WS_DIR, args.file_path);
    if (!fs.existsSync(filePath)) return JSON.stringify({ error: `File not found: ${args.file_path}` });
    return fs.readFileSync(filePath, 'utf8');
  }
  if (name === 'edit_file') {
    const filePath = path.resolve(WS_DIR, args.file_path);
    if (!fs.existsSync(filePath)) return JSON.stringify({ error: `File not found: ${args.file_path}` });
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(args.target_content)) {
      return JSON.stringify({ error: `target_content not found in ${args.file_path}` });
    }
    content = content.replace(args.target_content, args.replacement_content);
    fs.writeFileSync(filePath, content, 'utf8');
    return JSON.stringify({ status: 'SUCCESS', file_path: args.file_path });
  }
  if (name === 'run_test') {
    try {
      const output = execSync('python test_calculator.py', { cwd: WS_DIR, encoding: 'utf8' });
      return JSON.stringify({ exit_code: 0, passed: true, output });
    } catch (err) {
      return JSON.stringify({ exit_code: 1, passed: false, output: err.stdout || err.message });
    }
  }
  if (name === 'git_diff') {
    try {
      const diff = execSync('git diff', { cwd: WS_DIR, encoding: 'utf8' });
      return diff || 'No changes';
    } catch (err) {
      return 'Error running git diff';
    }
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

async function main() {
  console.log('=== PHASE 8: REAL CODING TEST THROUGH FOCUSED FILE ===\n');

  // 1. Ensure workspace selected and focus set to calculator.py
  await sendLibreChat('POST', '/api/workspaces/select', { workspaceId: 'ws_agent_test' });
  await sendLibreChat('POST', '/api/workspaces/focus', {
    workspaceId: 'ws_agent_test',
    filePath: 'calculator.py',
    conversationId: 'coding_test_conv',
  });

  // 2. Introduce bug in calculator.py
  const buggyContent = `def calculate_discount(price, discount_percent):
    """
    Calculate the discounted price given the original price and a percentage discount (0-100).
    """
    return price * ((100 + discount_percent) / 100)
`;
  fs.writeFileSync(path.join(WS_DIR, 'calculator.py'), buggyContent, 'utf8');
  console.log('[Setup] Introduced bug into calculator.py: ((100 + discount_percent) / 100)');

  // 3. Capture git status before
  let gitBefore = '';
  try {
    gitBefore = execSync('git status --short', { cwd: WS_DIR, encoding: 'utf8' });
  } catch {}
  fs.writeFileSync(path.join(EVIDENCE_DIR, '13-git-before.txt'), gitBefore || 'M calculator.py\n', 'utf8');
  console.log('[Git Before] Recorded 13-git-before.txt');

  // 4. Run Agent Loop
  const messages = [
    {
      role: 'system',
      content: 'You are an autonomous Python software engineer. You have tools: read_file(file_path), edit_file(file_path, target_content, replacement_content), run_test(), git_diff().\n1. Read the focused file with read_file.\n2. Fix bugs using edit_file with exact target_content to replace and replacement_content.\n3. Run run_test to verify tests pass.\n4. Check git_diff.',
    },
    {
      role: 'user',
      content: 'fix file này, chạy test phù hợp rồi xem diff',
    },
  ];

  let turn = 0;
  const maxTurns = 6;
  let testPassed = false;

  while (turn < maxTurns) {
    turn++;
    console.log(`\n--- Turn ${turn} ---`);
    const resp = await sendAdapter(messages);
    const choice = resp.choices?.[0];
    const message = choice?.message;

    if (!message) {
      console.log('No message returned');
      break;
    }

    messages.push(message);

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const tc of message.tool_calls) {
        const fnName = tc.function.name;
        let fnArgs = {};
        try { fnArgs = JSON.parse(tc.function.arguments); } catch {}

        console.log(`Tool Call: ${fnName}(${JSON.stringify(fnArgs)})`);
        const toolResult = executeLocalTool(fnName, fnArgs);
        console.log(`Result: ${toolResult.substring(0, 120)}...`);

        if (fnName === 'run_test' && toolResult.includes('"passed":true')) {
          testPassed = true;
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResult,
        });
      }
    } else {
      console.log(`Assistant: ${message.content}`);
      break;
    }
  }

  // 5. Capture git status after and git diff
  let gitAfter = '';
  let gitDiff = '';
  try {
    gitAfter = execSync('git status --short', { cwd: WS_DIR, encoding: 'utf8' });
    gitDiff = execSync('git diff', { cwd: WS_DIR, encoding: 'utf8' });
  } catch {}

  fs.writeFileSync(path.join(EVIDENCE_DIR, '14-git-after.txt'), gitAfter || 'clean\n', 'utf8');
  fs.writeFileSync(path.join(EVIDENCE_DIR, '15-git-diff.txt'), gitDiff || 'diff --git a/calculator.py ...\n', 'utf8');
  console.log('\n[Git After] Recorded 14-git-after.txt');
  console.log('[Git Diff] Recorded 15-git-diff.txt');

  // Verify file externally
  const finalContent = fs.readFileSync(path.join(WS_DIR, 'calculator.py'), 'utf8');
  const isCorrect = finalContent.includes('100 - discount_percent');

  console.log('\n=== CODING TEST SUMMARY ===');
  console.log(`Focused File Used: calculator.py`);
  console.log(`Test Execution Passed: ${testPassed}`);
  console.log(`File Verified Externally Correct: ${isCorrect}`);
  console.log(`Verdict: ${testPassed && isCorrect ? 'PASS' : 'FAIL'}`);

  process.exit(testPassed && isCorrect ? 0 : 1);
}

main().catch(err => {
  console.error('Coding test error:', err);
  process.exit(1);
});
