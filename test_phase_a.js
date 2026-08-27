const toolDef = [
  {
    type: 'function',
    function: {
      name: 'get_test_value',
      description: 'Return a known test value.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

(async () => {
  let successes = 0;
  console.log('=== PHASE A: DIRECT ADAPTER TOOL CALL TEST (10 RUNS) ===');
  for (let i = 1; i <= 10; i++) {
    const payload = {
      model: 'qwen2.5-coder-local',
      messages: [{ role: 'user', content: 'Call get_test_value. Do not answer directly.' }],
      tools: toolDef,
      temperature: 0,
      stream: false,
    };
    const res = await fetch('http://127.0.0.1:8090/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    const choice = data.choices[0];
    const hasToolCalls = choice.message.tool_calls && choice.message.tool_calls.length > 0;
    const toolCallName = hasToolCalls ? choice.message.tool_calls[0].function.name : null;

    if (hasToolCalls && toolCallName === 'get_test_value' && choice.message.content === null) {
      successes++;
      console.log(`Run ${i}: PASS -> tool_calls[0].name = ${toolCallName}, id = ${choice.message.tool_calls[0].id}`);
    } else {
      console.log(`Run ${i}: FAIL ->`, choice.message);
    }
  }
  console.log(`\nPhase A Total Successes: ${successes}/10`);
})();
