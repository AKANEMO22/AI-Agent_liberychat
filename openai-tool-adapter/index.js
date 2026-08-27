/**
 * @fileoverview Production-Hardened OpenAI-Compatible Tool Protocol Adapter
 * Connects LibreChat to local Ollama (qwen2.5-coder-local) with local bearer auth,
 * strict tool-call envelope normalization, schema validation, transparent streaming,
 * client abort propagation, health status checks, and compact telemetry logging.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

let WorkspaceRegistry = null;
try {
  WorkspaceRegistry = require('../LibreChat/api/server/services/WorkspaceRegistry');
} catch {}

const PORT = parseInt(process.env.ADAPTER_PORT || '8090', 10);
const HOST = '127.0.0.1';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'qwen2.5-coder-local';
const LOCAL_AGENT_API_KEY = process.env.LOCAL_AGENT_API_KEY || 'local-agent-secret-key-prod-8090';
const REQUEST_TIMEOUT_MS = 120000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Known Qwen placeholder strings that should be replaced with the focused file.
 * EXACT MATCH ONLY — no fuzzy includes() to prevent rewriting real file paths.
 */
const KNOWN_PLACEHOLDERS = new Set([
  '', 'file này', 'file_này', 'current_file', 'activeFile', 'active_file',
  '<focused-file>', '<file>', '<path>', '<đường_dẫn>', '<current_file>',
  'đọc', 'sửa', 'path', 'example', 'đường_dẫn',
  'file đang mở', 'this file', 'current file', 'this_file',
  'đọc file này', 'sửa file này', 'xem file này', 'đọc file',
]);

/**
 * Check if a raw file_path is a known placeholder that should be replaced.
 * Uses exact match against KNOWN_PLACEHOLDERS set, plus angle-bracket detection.
 * Does NOT use fuzzy includes() — a path like 'example_utils.py' will NOT match.
 */
function isPlaceholderPath(rawPath) {
  if (!rawPath) return true;
  if (KNOWN_PLACEHOLDERS.has(rawPath)) return true;
  if (rawPath.startsWith('<') && rawPath.endsWith('>')) return true;
  return false;
}

/**
 * Validate if a string is a strict tool call envelope matching one of the supplied tools.
 */
function parseStrictToolCall(content, suppliedTools) {
  if (!content || typeof content !== 'string') return null;
  const trimmed = content.trim();

  let candidateJson = trimmed;

  const codeBlockMatch = trimmed.match(/^```(?:json|xml)?\s*([\s\S]*?)\s*```$/);
  if (codeBlockMatch) {
    candidateJson = codeBlockMatch[1].trim();
  }

  const xmlMatch = candidateJson.match(/^<(?:xml|tool_call|function_call)>\s*([\s\S]*?)\s*<\/(?:xml|tool_call|function_call)>$/);
  if (xmlMatch) {
    candidateJson = xmlMatch[1].trim();
  }

  if (!candidateJson.startsWith('{') || !candidateJson.endsWith('}')) {
    const jsonMatch = candidateJson.match(/\{[\s\r\n]*"name"\s*:\s*"[^"]+"[\s\S]*\}/);
    if (jsonMatch) {
      candidateJson = jsonMatch[0].trim();
    } else {
      return null;
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(candidateJson);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  if (!parsed.name || typeof parsed.name !== 'string') {
    return null;
  }

  if (parsed.arguments === undefined || typeof parsed.arguments !== 'object' || parsed.arguments === null || Array.isArray(parsed.arguments)) {
    return null;
  }

  if (!suppliedTools || !Array.isArray(suppliedTools) || suppliedTools.length === 0) {
    return null;
  }

  const matchedTool = suppliedTools.find((t) => {
    const fn = t.function || t;
    return fn.name === parsed.name;
  });

  if (!matchedTool) {
    return null;
  }

  const schema = (matchedTool.function || matchedTool).parameters;
  if (schema && schema.required && Array.isArray(schema.required)) {
    for (const req of schema.required) {
      if (!(req in parsed.arguments)) {
        return null;
      }
    }
  }

  // Authoritative Focused File Normalization (exact placeholder match only)
  if (['read_file', 'edit_file'].includes(parsed.name) && parsed.arguments) {
    const rawPath = String(parsed.arguments.file_path || '').trim();

    if (isPlaceholderPath(rawPath) && WorkspaceRegistry) {
      const active = WorkspaceRegistry.getActiveFile();
      if (active) {
        parsed.arguments.file_path = active;
      }
    }
  }

  return {
    id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'function',
    function: {
      name: parsed.name,
      arguments: JSON.stringify(parsed.arguments),
    },
  };
}

function getFocusedFileHint() {
  try {
    if (WorkspaceRegistry) {
      const activeFile = WorkspaceRegistry.getActiveFile();
      if (activeFile) {
        return `You are a coding assistant. The workspace project has the active focused file: "${activeFile}".\nWhen the user refers to "this file", "file này", "current file", "file đang mở", or asks to read/inspect/edit the active file without giving another explicit path, you MUST call read_file or edit_file with {"file_path": "${activeFile}"}.`;
      }
    }
  } catch {}
  return null;
}

/**
 * Transform OpenAI messages containing role: 'tool' into format consumable by Ollama.
 */
function adaptMessagesForOllama(messages) {
  if (!messages || !Array.isArray(messages)) return messages;
  const adapted = [];

  const focusedHint = getFocusedFileHint();
  let systemMessageFound = false;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'system') {
      systemMessageFound = true;
      const enhancedContent = focusedHint ? `${focusedHint}\n\n${msg.content || ''}` : msg.content;
      adapted.push({
        ...msg,
        content: enhancedContent,
      });
    } else if (msg.role === 'tool') {
      adapted.push({
        role: 'user',
        content: `<tool_response>\n${msg.content || ''}\n</tool_response>`,
      });
    } else if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const toolCall = msg.tool_calls[0];
      const fn = toolCall.function || {};
      let argsObj = {};
      try {
        argsObj = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : (fn.arguments || {});
      } catch {
        argsObj = {};
      }
      adapted.push({
        role: 'assistant',
        content: JSON.stringify({ name: fn.name, arguments: argsObj }),
      });
    } else {
      adapted.push(msg);
    }
  }

  if (!systemMessageFound && focusedHint) {
    adapted.unshift({
      role: 'system',
      content: focusedHint,
    });
  }

  return adapted;
}

function createServer() {
  const srv = http.createServer(async (req, res) => {
    const reqStartTime = Date.now();
    const reqId = Math.random().toString(36).substring(2, 8);
    const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
    const pathname = parsedUrl.pathname;

    req.setTimeout(REQUEST_TIMEOUT_MS);

    // Abort controller for downstream client cancellation
    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
        console.log(`[adapter] req=${reqId} client closed connection before response completed -> upstream aborted`);
      }
    });

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // GET /health (unauthenticated for monitoring)
    if (req.method === 'GET' && pathname === '/health') {
      try {
        const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!ollamaRes.ok) throw new Error(`Ollama HTTP ${ollamaRes.status}`);
        const data = await ollamaRes.json();
        const models = (data.models || []).map((m) => m.name);
        const hasModel = models.some((m) => m.includes('qwen2.5-coder'));

        const status = hasModel ? 'ok' : 'degraded';
        const httpCode = hasModel ? 200 : 503;

        res.writeHead(httpCode, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status,
            adapter: 'ok',
            ollama: 'ok',
            target_model: DEFAULT_MODEL,
            available_models: models,
          })
        );
      } catch (err) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'unhealthy',
            adapter: 'ok',
            ollama: 'unreachable',
            error: err.message,
          })
        );
      }
      return;
    }

    // Local Authentication Check for API endpoints
    const authHeader = req.headers['authorization'] || '';
    const expectedBearer = `Bearer ${LOCAL_AGENT_API_KEY}`;
    if (LOCAL_AGENT_API_KEY && authHeader !== expectedBearer) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing local agent API key' }));
      return;
    }

    // GET /v1/models or GET /models
    if (req.method === 'GET' && (pathname === '/v1/models' || pathname === '/models')) {
      try {
        const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await ollamaRes.json();
        const modelsList = (data.models || []).map((m) => ({
          id: m.name,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'ollama',
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: modelsList }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // POST /v1/chat/completions
    if (req.method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions')) {
      let bodyText = '';
      let bodyOverflow = false;

      req.on('data', (chunk) => {
        bodyText += chunk;
        if (bodyText.length > MAX_BODY_BYTES) {
          bodyOverflow = true;
          req.destroy();
        }
      });

      req.on('end', async () => {
        if (bodyOverflow) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload exceeds 10MB limit' }));
          return;
        }

        let body;
        try {
          body = JSON.parse(bodyText);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
          return;
        }

        const hasTools = body.tools && Array.isArray(body.tools) && body.tools.length > 0;
        const isStreaming = body.stream === true;
        const targetModel = body.model || DEFAULT_MODEL;

        const adaptedMessages = adaptMessagesForOllama(body.messages);

        // Path A: Non-streaming request
        if (!isStreaming) {
          try {
            const ollamaPayload = {
              ...body,
              model: targetModel,
              messages: adaptedMessages,
              stream: false,
            };

            const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(ollamaPayload),
              signal: abortController.signal,
            });

            const ollamaData = await ollamaRes.json();
            if (!ollamaData.choices || ollamaData.choices.length === 0) {
              res.writeHead(ollamaRes.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(ollamaData));
              return;
            }

            const choice = ollamaData.choices[0];
            const rawContent = choice.message?.content || '';
            let toolCall = null;

            if (hasTools) {
              if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
                choice.message.tool_calls = choice.message.tool_calls.map((tc) => {
                  if (tc.function && ['read_file', 'edit_file'].includes(tc.function.name)) {
                    try {
                      const args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : (tc.function.arguments || {});
                      const rawPath = String(args.file_path || '').trim();

                      if (isPlaceholderPath(rawPath) && WorkspaceRegistry) {
                        const active = WorkspaceRegistry.getActiveFile();
                        if (active) {
                          args.file_path = active;
                          tc.function.arguments = JSON.stringify(args);
                        }
                      }
                    } catch {}
                  }
                  return tc;
                });
                toolCall = choice.message.tool_calls[0];
              } else {
                toolCall = parseStrictToolCall(rawContent, body.tools);
                if (toolCall) {
                  choice.message.content = null;
                  choice.message.tool_calls = [toolCall];
                  choice.finish_reason = 'tool_calls';
                }
              }
            }

            const latency = Date.now() - reqStartTime;
            console.log(
              `[adapter] req=${reqId} model=${targetModel} tools=${hasTools ? body.tools.length : 0} stream=false tool_call=${toolCall ? toolCall.function.name : 'none'} latency=${latency}ms status=200`
            );

            res.writeHead(ollamaRes.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(ollamaData));
          } catch (err) {
            if (err.name === 'AbortError') {
              console.log(`[adapter] req=${reqId} request aborted by client`);
              return;
            }
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // Path B: Streaming with tools
        if (hasTools) {
          try {
            const ollamaPayload = {
              ...body,
              model: targetModel,
              messages: adaptedMessages,
              stream: false,
            };

            const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(ollamaPayload),
              signal: abortController.signal,
            });

            const ollamaData = await ollamaRes.json();
            const choice = ollamaData.choices[0];
            const rawContent = choice.message?.content || '';
            const toolCall = parseStrictToolCall(rawContent, body.tools);

            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            });

            const id = ollamaData.id || `chatcmpl-${Date.now()}`;
            const model = ollamaData.model || targetModel;

            if (toolCall) {
              const chunk1 = {
                id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      role: 'assistant',
                      content: null,
                      tool_calls: [
                        {
                          index: 0,
                          id: toolCall.id,
                          type: 'function',
                          function: {
                            name: toolCall.function.name,
                            arguments: toolCall.function.arguments,
                          },
                        },
                      ],
                    },
                    finish_reason: null,
                  },
                ],
              };
              res.write(`data: ${JSON.stringify(chunk1)}\n\n`);

              const chunkEnd = {
                id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
              };
              res.write(`data: ${JSON.stringify(chunkEnd)}\n\n`);
            } else {
              const chunkText = {
                id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{ index: 0, delta: { role: 'assistant', content: rawContent }, finish_reason: null }],
              };
              res.write(`data: ${JSON.stringify(chunkText)}\n\n`);

              const chunkEnd = {
                id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
              };
              res.write(`data: ${JSON.stringify(chunkEnd)}\n\n`);
            }

            res.write('data: [DONE]\n\n');
            res.end();

            const latency = Date.now() - reqStartTime;
            console.log(
              `[adapter] req=${reqId} model=${targetModel} tools=${body.tools.length} stream=sse tool_call=${toolCall ? toolCall.function.name : 'none'} latency=${latency}ms status=200`
            );
          } catch (err) {
            if (err.name === 'AbortError') return;
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // Path C: Transparent streaming for ordinary chat (no tools)
        try {
          const ollamaPayload = {
            ...body,
            model: targetModel,
            messages: adaptedMessages,
            stream: true,
          };

          const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ollamaPayload),
            signal: abortController.signal,
          });

          res.writeHead(ollamaRes.status, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          const reader = ollamaRes.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();

          const latency = Date.now() - reqStartTime;
          console.log(`[adapter] req=${reqId} model=${targetModel} tools=0 stream=transparent latency=${latency}ms status=200`);
        } catch (err) {
          if (err.name === 'AbortError') return;
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  return srv;
}

if (require.main === module) {
  const app = createServer();
  app.listen(PORT, HOST, () => {
    console.log(`[adapter] OpenAI-Compatible Tool Adapter listening on http://${HOST}:${PORT}`);
    console.log(`[adapter] Upstream Ollama target: ${OLLAMA_BASE_URL}`);
    console.log(`[adapter] Local API Auth Key configured: ${LOCAL_AGENT_API_KEY ? 'ENABLED' : 'DISABLED'}`);
  });
}

module.exports = { parseStrictToolCall, adaptMessagesForOllama, createServer, LOCAL_AGENT_API_KEY };
