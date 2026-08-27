const http = require('http');
const { PRODUCTION_TOOLS } = require('./file-mutation-stress.js');

async function test() {
  const messages = [
    {
      role: 'system',
      content: `You are an autonomous Python software engineer working in workspace "workspace-agent-test".
Files: calculator.py, discount_engine.py, config.json, overwrite-test.txt, module_a.py, module_b.py, module_c.py, public_api.py, nested/formatter.py, tests/test_calculator.py, tests/test_discount_engine.py, tests/test_formatter.py, tests/test_module_b.py, tests/test_public_api.py.
Instructions:
1. Read the code file with read_file.
2. Fix bugs in source files using edit_file (do NOT modify test files).
3. Run run_test to verify tests pass.
4. Check git_diff.`,
    },
    { role: 'user', content: 'Sửa calculator.py để phép cộng trả đúng a + b. Chỉ sửa file calculator.py và chạy test.' },
  ];

  const postData = JSON.stringify({
    model: 'qwen2.5-coder-local',
    messages,
    tools: PRODUCTION_TOOLS,
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
      console.log('Turn 1 response:', b);
      const data = JSON.parse(b);
      const choice = data.choices?.[0]?.message;
      console.log('Choice:', choice);
      if (choice && choice.tool_calls) {
        messages.push(choice);
        messages.push({
          role: 'tool',
          tool_call_id: choice.tool_calls[0].id,
          content: 'def add(a, b):\n    return a - b\n',
        });

        // Turn 2
        const postData2 = JSON.stringify({
          model: 'qwen2.5-coder-local',
          messages,
          tools,
          stream: false,
          temperature: 0.1,
        });

        const req2 = http.request('http://127.0.0.1:8090/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer local-agent-secret-key-prod-8090',
            'Content-Length': Buffer.byteLength(postData2),
          },
        }, (res2) => {
          let b2 = '';
          res2.on('data', (c) => b2 += c);
          res2.on('end', () => {
            console.log('Turn 2 response:', b2);
          });
        });
        req2.write(postData2);
        req2.end();
      }
    });
  });
  req.write(postData);
  req.end();
}

test();
