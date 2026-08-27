/**
 * @fileoverview Benchmark performance across Light, Medium, and High modes
 */

const { spawnSync } = require('child_process');

async function benchmark() {
  console.log('=== BENCHMARKING LIGHT vs MEDIUM vs HIGH ===\n');

  // 1. LIGHT MODE (direct question, no tools)
  const lightStart = Date.now();
  const lightRes = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder-local',
      messages: [{ role: 'user', content: 'What is the syntax for a Python list comprehension?' }],
      stream: false,
    }),
  });
  const lightData = await lightRes.json();
  const lightLatency = Date.now() - lightStart;

  console.log('LIGHT MODE:');
  console.log('  Latency:', lightLatency, 'ms');
  console.log('  Prompt Tokens:', lightData.usage?.prompt_tokens);
  console.log('  Completion Tokens:', lightData.usage?.completion_tokens);
  console.log('  Tool calls:', 0);

  // 2. MEDIUM MODE (Tool search & inspection)
  const medStart = Date.now();
  const sampleTools = [
    { type: 'function', function: { name: 'read_file', description: 'Read file', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } } },
    { type: 'function', function: { name: 'search_files', description: 'Search files', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } } },
  ];

  const medReq1 = await fetch('http://127.0.0.1:8090/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder-local',
      messages: [
        { role: 'system', content: 'You are in MEDIUM MODE. Inspect discount_engine.py.' },
        { role: 'user', content: 'Use read_file to inspect discount_engine.py.' },
      ],
      tools: sampleTools,
      stream: false,
    }),
  });
  const medData1 = await medReq1.json();
  const medLatency = Date.now() - medStart;

  console.log('\nMEDIUM MODE:');
  console.log('  Latency (Turn 1):', medLatency, 'ms');
  console.log('  Prompt Tokens:', medData1.usage?.prompt_tokens);
  console.log('  Completion Tokens:', medData1.usage?.completion_tokens);
  console.log('  Tool call generated:', medData1.choices[0].message.tool_calls?.[0]?.function.name);

  // 3. HIGH MODE (Deep repair & verification)
  const highStart = Date.now();
  const highReq1 = await fetch('http://127.0.0.1:8090/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder-local',
      messages: [
        { role: 'system', content: 'You are in HIGH MODE with full workspace agent harness enabled.' },
        { role: 'user', content: 'Find discount_engine.py, analyze edge cases, and run tests.' },
      ],
      tools: sampleTools,
      stream: false,
    }),
  });
  const highData1 = await highReq1.json();
  const highLatency = Date.now() - highStart;

  console.log('\nHIGH MODE:');
  console.log('  Latency (Turn 1):', highLatency, 'ms');
  console.log('  Prompt Tokens:', highData1.usage?.prompt_tokens);
  console.log('  Completion Tokens:', highData1.usage?.completion_tokens);
  console.log('  Tool call generated:', highData1.choices[0].message.tool_calls?.[0]?.function.name);

  // Measure VRAM
  const smi = spawnSync('nvidia-smi', ['--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8' });
  console.log('\nVRAM usage (Used / Total MB):', smi.stdout.trim());
}

benchmark();
