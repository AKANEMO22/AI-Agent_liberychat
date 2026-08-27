const http = require('http');

async function test() {
  const tools = [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read file contents from active workspace.',
        parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'edit_file',
        description: 'Edit file via exact target replacement.',
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
        description: 'Execute unit tests in active workspace.',
        parameters: { type: 'object', properties: { test_id: { type: 'string' } } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_text',
        description: 'Search workspace for text.',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'git_diff',
        description: 'Get git diff of changes.',
        parameters: { type: 'object', properties: {} },
      },
    },
  ];

  const messages = [
    {
      role: 'system',
      content: `You are an autonomous Python software engineer working in workspace "workspace-agent-test".
Files: calculator.py, discount_engine.py, config.json, overwrite-test.txt, nested/formatter.py, tests/test_calculator.py, tests/test_discount_engine.py, tests/test_formatter.py.
Instructions:
1. Read the code file with read_file.
2. Fix bugs in source files using edit_file (do NOT modify test files).
3. Run run_test to verify tests pass.
4. Check git_diff.`,
    },
    { role: 'user', content: 'Sửa calculator.py để phép cộng trả đúng kết quả (a + b). Chỉ sửa file calculator.py và chạy test.' },
  ];

  const postData = JSON.stringify({
    model: 'qwen2.5-coder-local',
    messages,
    tools,
    stream: false,
    temperature: 0.1,
  });

  const req = http.request('http://127.0.0.1:8090/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer local-agent-secret-key-prod-8090',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, (res) => {
    let b = '';
    res.on('data', (c) => b += c);
    res.on('end', () => {
      console.log('Adapter Status:', res.statusCode);
      console.log('Response body:', b);
    });
  });
  req.write(postData);
  req.end();
}

test();
