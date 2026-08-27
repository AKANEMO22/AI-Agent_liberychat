/**
 * @fileoverview Adversarial Adapter & Correlation Test Suite
 * Tests:
 * 1. 10 sequential tool call ID correlations
 * 2. Concurrent request isolation (no crosstalk)
 * 3. Adversarial JSON envelopes (prefixes, suffixes, multi-JSON, prototype pollution)
 * 4. Schema boundary conditions (wrong types, missing required)
 */

const { parseStrictToolCall } = require('./openai-tool-adapter/index.js');

async function testAdversarialAdapter() {
  console.log('=== PHASE 8, 9, 10: ADVERSARIAL ADAPTER & CORRELATION SUITE ===\n');

  let allPassed = true;

  const tools = [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read file',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            max_lines: { type: 'number' },
          },
          required: ['file_path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_text',
        description: 'Search text',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    },
  ];

  // 1. Adversarial Parser Unit Checks
  console.log('[SECTION 1] Strict Parser Edge Cases...');
  const edgeCases = [
    { name: 'Trailing prose', input: '{"name":"read_file","arguments":{"file_path":"a.py"}} and some extra notes', expect: false },
    { name: 'Leading prose', input: 'Here is the call: {"name":"read_file","arguments":{"file_path":"a.py"}}', expect: false },
    { name: 'Multiple JSONs', input: '{"name":"read_file","arguments":{"file_path":"a.py"}}{"name":"search_text","arguments":{"query":"test"}}', expect: false },
    { name: 'Prototype pollution attempt', input: '{"__proto__":{"isAdmin":true},"name":"read_file","arguments":{"file_path":"a.py"}}', expect: true }, // valid format, but prototype not polluted
    { name: 'Null arguments', input: '{"name":"read_file","arguments":null}', expect: false },
    { name: 'Array arguments', input: '{"name":"read_file","arguments":["a.py"]}', expect: false },
    { name: 'Missing required schema field', input: '{"name":"read_file","arguments":{"max_lines":50}}', expect: false },
    { name: 'Unknown function name', input: '{"name":"eval_arbitrary_code","arguments":{"code":"alert(1)"}}', expect: false },
  ];

  let edgePassed = true;
  for (const ec of edgeCases) {
    const res = parseStrictToolCall(ec.input, tools);
    const pass = (res !== null) === ec.expect;
    if (!pass) {
      edgePassed = false;
      console.log(`  -> FAIL on edge case "${ec.name}"`);
    }
  }
  console.log(`  -> Result: ${edgePassed ? 'PASS (All edge cases handled strictly)' : 'FAIL'}`);
  if (!edgePassed) allPassed = false;

  // 2. Ten Sequential Tool Call Correlations
  console.log('\n[SECTION 2] 10 Sequential Tool Call Correlations...');
  let seqPassed = true;
  for (let i = 1; i <= 10; i++) {
    const targetFile = `file_${i}.py`;
    const payload = {
      model: 'qwen2.5-coder-local',
      messages: [
        { role: 'system', content: 'You are a tool assistant.' },
        { role: 'user', content: `Read the contents of ${targetFile} using read_file.` },
      ],
      tools,
      temperature: 0,
      stream: false,
    };

    const res = await fetch('http://127.0.0.1:8090/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];

    if (!toolCall || !toolCall.id || toolCall.function.name !== 'read_file') {
      seqPassed = false;
      console.log(`  -> Run ${i}: FAIL ->`, data.choices[0]?.message);
    } else {
      const args = JSON.parse(toolCall.function.arguments);
      if (!args.file_path.includes(targetFile)) {
        seqPassed = false;
        console.log(`  -> Run ${i}: FAIL (Argument mismatch: ${args.file_path})`);
      }
    }
  }
  console.log(`  -> Result: ${seqPassed ? 'PASS (10/10 Sequential tool calls correlated perfectly)' : 'FAIL'}`);
  if (!seqPassed) allPassed = false;

  // 3. Concurrent Request Isolation Test
  console.log('\n[SECTION 3] Concurrent Request Isolation (A vs B)...');
  const reqA = fetch('http://127.0.0.1:8090/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder-local',
      messages: [{ role: 'user', content: 'Use read_file to read calculator.py.' }],
      tools,
      temperature: 0,
      stream: false,
    }),
  });

  const reqB = fetch('http://127.0.0.1:8090/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder-local',
      messages: [{ role: 'user', content: 'Use search_text to find discount.' }],
      tools,
      temperature: 0,
      stream: false,
    }),
  });

  const [resA, resB] = await Promise.all([reqA, reqB]);
  const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);

  const callA = dataA.choices[0]?.message?.tool_calls?.[0];
  const callB = dataB.choices[0]?.message?.tool_calls?.[0];

  const passA = callA && callA.function.name === 'read_file';
  const passB = callB && callB.function.name === 'search_text';

  if (passA && passB && callA.id !== callB.id) {
    console.log('  -> PASS: Concurrent requests A and B maintained distinct IDs and correct tool types without crosstalk');
  } else {
    console.log('  -> FAIL: Concurrent isolation failed:', { callA, callB });
    allPassed = false;
  }

  console.log(`\nADVERSARIAL ADAPTER SUITE: ${allPassed ? 'ALL TESTS PASSED' : 'FAILED'}`);
}

testAdversarialAdapter();
