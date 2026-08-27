const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WS_DIR = path.resolve(__dirname, '../workspace-agent-test');

function callAdapter(messages) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'qwen2.5-coder-local',
      messages,
      tools: [
        { type: 'function', function: { name: 'read_file', description: 'Read complete content of a file within active workspace.', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } } },
        { type: 'function', function: { name: 'edit_file', description: 'Edit an existing file within active workspace via exact target_content replacement.', parameters: { type: 'object', properties: { file_path: { type: 'string' }, target_content: { type: 'string' }, replacement_content: { type: 'string' } }, required: ['file_path', 'target_content', 'replacement_content'] } } },
        { type: 'function', function: { name: 'run_test', description: 'Execute unit tests in active workspace.', parameters: { type: 'object', properties: { test_id: { type: 'string' } } } } },
        { type: 'function', function: { name: 'git_diff', description: 'Get git diff of working tree changes.', parameters: { type: 'object', properties: {} } } },
      ],
      stream: false,
      temperature: 0.1,
    });
    const req = http.request('http://127.0.0.1:8090/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer local-agent-secret-key-prod-8090',
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

function execTool(name, args) {
  console.log(`\n>>> EXEC TOOL: ${name}(${JSON.stringify(args)})`);
  if (name === 'read_file') {
    let p = path.resolve(WS_DIR, args.file_path);
    if (!fs.existsSync(p)) return JSON.stringify({ error: `File not found: ${args.file_path}` });
    return fs.readFileSync(p, 'utf8');
  }
  if (name === 'edit_file') {
    let p = path.resolve(WS_DIR, args.file_path);
    if (!fs.existsSync(p)) return JSON.stringify({ error: `File not found: ${args.file_path}` });
    const current = fs.readFileSync(p, 'utf8');
    const normCur = current.replace(/\r\n/g, '\n');
    const normTar = args.target_content.replace(/\r\n/g, '\n');
    const normRep = args.replacement_content.replace(/\r\n/g, '\n');
    if (!normCur.includes(normTar)) {
      return JSON.stringify({ error: `target_content not found in ${args.file_path}` });
    }
    const updated = normCur.replace(normTar, normRep);
    fs.writeFileSync(p, updated, 'utf8');
    return JSON.stringify({ status: 'SUCCESS', file_path: args.file_path });
  }
  if (name === 'run_test') {
    try {
      const out = execSync('python -m pytest tests/test_calculator.py -v', { cwd: WS_DIR, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      return JSON.stringify({ exit_code: 0, passed: true, output: out.substring(0, 1000) });
    } catch (err) {
      return JSON.stringify({ exit_code: 1, passed: false, output: ((err.stdout || '') + (err.stderr || '')).substring(0, 1000) });
    }
  }
  if (name === 'git_diff') {
    try {
      return execSync('git diff', { cwd: WS_DIR, encoding: 'utf8' }) || 'No changes';
    } catch (err) {
      return 'git diff error';
    }
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

async function run() {
  execSync('git checkout -f master', { cwd: WS_DIR });
  execSync('git clean -fd', { cwd: WS_DIR });

  const messages = [
    {
      role: 'system',
      content: 'You are an autonomous Python software engineer. You must edit the source implementation files, not the test files unless explicitly asked.\nTools: read_file, edit_file, run_test, git_diff.'
    },
    {
      role: 'user',
      content: 'Sửa calculator.py để phép cộng trả đúng kết quả (a + b). Chỉ sửa file calculator.py và chạy test.'
    }
  ];

  for (let turn = 1; turn <= 6; turn++) {
    console.log(`\n=== TURN ${turn} ===`);
    const res = await callAdapter(messages);
    const msg = res.choices?.[0]?.message;
    if (!msg) {
      console.log('No message returned');
      break;
    }
    messages.push(msg);

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        const fn = tc.function.name;
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}
        const result = execTool(fn, args);
        console.log(`<<< TOOL RESULT: ${result.substring(0, 100)}...`);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result
        });
      }
    } else {
      console.log('\nASSISTANT:', msg.content);
      break;
    }
  }

  const diff = execSync('git diff', { cwd: WS_DIR, encoding: 'utf8' });
  console.log('\n=== FINAL GIT DIFF ===\n', diff);
}

run().catch(console.error);
