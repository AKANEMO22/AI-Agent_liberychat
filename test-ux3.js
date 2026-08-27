const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.resolve(__dirname, 'audit-logs/2026-08-27_001000/tree-chat-final');

async function testUx3() {
  console.log('--- Testing UX-3: Focus discount_engine.py and test "đọc file này" ---');
  
  // 1. Focus discount_engine.py
  await fetch('http://127.0.0.1:3080/api/workspaces/focus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: 'ws_agent_test', filePath: 'discount_engine.py' })
  });

  // 2. Chat completion for "đọc file này"
  const chatRes = await fetch('http://127.0.0.1:8090/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer local-agent-secret-key-prod-8090',
    },
    body: JSON.stringify({
      model: 'qwen2.5-coder-local',
      messages: [
        { role: 'user', content: 'đọc file này' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read file contents from workspace',
            parameters: {
              type: 'object',
              properties: {
                file_path: { type: 'string', description: 'Relative path to file' }
              },
              required: ['file_path']
            }
          }
        }
      ],
      temperature: 0,
      max_tokens: 150
    })
  });

  const chatData = await chatRes.json();
  const toolCalls = chatData.choices?.[0]?.message?.tool_calls || [];
  console.log('UX-3 emitted tool call:', JSON.stringify(toolCalls));

  const existingLog = fs.readFileSync(path.join(EVIDENCE_DIR, '10-focused-chat.log'), 'utf-8');
  const updatedLog = `${existingLog}\n\n=== UX-3: SWITCH FOCUS TO discount_engine.py ===\n${JSON.stringify(chatData, null, 2)}`;
  fs.writeFileSync(path.join(EVIDENCE_DIR, '10-focused-chat.log'), updatedLog);
  console.log('UX-3 test recorded.');
}

testUx3().catch(console.error);
