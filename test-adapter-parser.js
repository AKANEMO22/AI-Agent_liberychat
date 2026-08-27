const { parseStrictToolCall, adaptMessagesForOllama } = require('./openai-tool-adapter/index.js');

const suppliedTools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read file contents',
      parameters: {
        type: 'object',
        properties: { file_path: { type: 'string' } },
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

console.log('=== PHASE B: STRICT PARSER & NEGATIVE TESTS ===');

const testCases = [
  {
    name: 'Valid clean JSON tool call',
    input: '{"name":"read_file","arguments":{"file_path":"test.py"}}',
    expectMatch: true,
  },
  {
    name: 'Valid JSON inside markdown block',
    input: '```json\n{"name":"read_file","arguments":{"file_path":"test.py"}}\n```',
    expectMatch: true,
  },
  {
    name: 'Surrounding prose (MUST NOT CONVERT)',
    input: 'Here is the file you requested: {"name":"read_file","arguments":{"file_path":"test.py"}}',
    expectMatch: false,
  },
  {
    name: 'Unknown tool name (MUST NOT CONVERT)',
    input: '{"name":"delete_everything","arguments":{"path":"/"}}',
    expectMatch: false,
  },
  {
    name: 'Arguments not an object (MUST NOT CONVERT)',
    input: '{"name":"read_file","arguments":"test.py"}',
    expectMatch: false,
  },
  {
    name: 'Missing required argument schema field (MUST NOT CONVERT)',
    input: '{"name":"read_file","arguments":{"other_field":"test.py"}}',
    expectMatch: false,
  },
  {
    name: 'Malformed JSON (MUST NOT CONVERT)',
    input: '{"name":"read_file", "arguments": { invalid }',
    expectMatch: false,
  },
  {
    name: 'Multiple JSON objects (MUST NOT CONVERT)',
    input: '{"name":"read_file","arguments":{"file_path":"1.py"}}{"name":"read_file","arguments":{"file_path":"2.py"}}',
    expectMatch: false,
  },
  {
    name: 'Normal conversation text (MUST NOT CONVERT)',
    input: 'Hello! I am ready to help you with your coding tasks.',
    expectMatch: false,
  },
];

let allPassed = true;
for (const tc of testCases) {
  const result = parseStrictToolCall(tc.input, suppliedTools);
  const matched = result !== null;
  const pass = matched === tc.expectMatch;
  if (!pass) allPassed = false;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${tc.name} -> parsed=${matched ? JSON.stringify(result.function) : 'null'}`);
}

console.log(`\nStrict Negative Parser Suite: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
