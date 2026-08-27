const toolDef = [
  {
    type: 'function',
    function: {
      name: 'get_current_weather',
      description: 'Get current weather in location',
      parameters: {
        type: 'object',
        properties: { location: { type: 'string' } },
        required: ['location'],
      },
    },
  },
];

(async () => {
  console.log('=== PHASE C: TOOL RESULT ROUND TRIP TEST ===');

  // Step 1: User asks question with tool definition
  console.log('Step 1: Sending user message with tool definition...');
  const req1 = {
    model: 'qwen2.5-coder-local',
    messages: [
      { role: 'system', content: 'You are a helpful assistant with access to weather tools.' },
      { role: 'user', content: 'What is the weather in Tokyo right now?' },
    ],
    tools: toolDef,
    temperature: 0,
    stream: false,
  };

  const res1 = await fetch('http://127.0.0.1:8090/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req1),
  });
  const data1 = await res1.json();
  const choice1 = data1.choices[0];
  const toolCall = choice1.message.tool_calls?.[0];

  console.log('Received Step 1 response:', {
    role: choice1.message.role,
    tool_calls: choice1.message.tool_calls,
    finish_reason: choice1.finish_reason,
  });

  if (!toolCall) {
    console.error('FAIL: No tool_call received in Step 1');
    return;
  }

  // Step 2: Send tool result back in OpenAI format
  console.log('\nStep 2: Sending tool observation back to adapter...');
  const req2 = {
    model: 'qwen2.5-coder-local',
    messages: [
      { role: 'system', content: 'You are a helpful assistant with access to weather tools.' },
      { role: 'user', content: 'What is the weather in Tokyo right now?' },
      choice1.message,
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: '{"temperature": "22°C", "condition": "Sunny and pleasant"}',
      },
    ],
    tools: toolDef,
    temperature: 0,
    stream: false,
  };

  const res2 = await fetch('http://127.0.0.1:8090/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req2),
  });
  const data2 = await res2.json();
  const choice2 = data2.choices[0];

  console.log('Received Step 2 final answer:', {
    role: choice2.message.role,
    content: choice2.message.content,
    finish_reason: choice2.finish_reason,
  });

  const hasWeatherInfo = choice2.message.content && (choice2.message.content.includes('22') || choice2.message.content.includes('Sunny') || choice2.message.content.includes('Tokyo'));

  console.log(`\nPhase C Round Trip Result: ${hasWeatherInfo ? 'PASS (Correctly incorporated observation)' : 'FAIL'}`);
})();
