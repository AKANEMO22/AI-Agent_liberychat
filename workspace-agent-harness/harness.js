/**
 * @fileoverview Deterministic Workspace Agent Harness for Local Qwen 7B
 * Executes bounded agent loops with real tool execution, failure diagnosis, and telemetry.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434/v1/chat/completions';
const MODEL_NAME = process.env.MODEL_NAME || 'qwen2.5-coder-local';
const WORKSPACE_ROOT = path.resolve(process.env.WORKSPACE_ROOT || path.resolve(__dirname, '..'));

// Mode Budgets
const MODE_BUDGETS = {
  LIGHT: {
    maxTurns: 2,
    maxToolCalls: 2,
    maxSearches: 1,
    maxReads: 2,
    maxEdits: 0,
    maxTests: 0,
    maxContextTokens: 2048,
    maxOutputTokens: 768,
    systemPrompt: `You are operating in LIGHT MODE.
- Priority: Speed, concise answers, and minimal overhead.
- Provide direct, correct, and efficient solutions without unnecessary exposition.
- Avoid multi-step exploration or extensive theoretical background unless explicitly requested.`,
  },
  MEDIUM: {
    maxTurns: 6,
    maxToolCalls: 8,
    maxSearches: 3,
    maxReads: 6,
    maxEdits: 3,
    maxTests: 2,
    maxContextTokens: 4096,
    maxOutputTokens: 2048,
    systemPrompt: `You are operating in MEDIUM MODE with workspace tools enabled.
- Priority: Balanced reliability, targeted analysis, and structured verification.
- You have access to workspace tools (workspace_tree, search_files, search_text, read_file, edit_file, run_command, run_test, git_diff, git_status).
- Inspect relevant code before modifying it.
- When you have obtained sufficient information from tool outputs, STOP calling tools and provide your final complete answer.`,
  },
  HIGH: {
    maxTurns: 12,
    maxToolCalls: 20,
    maxSearches: 8,
    maxReads: 15,
    maxEdits: 8,
    maxTests: 4,
    maxContextTokens: 4096,
    maxOutputTokens: 4096,
    systemPrompt: `You are operating in HIGH MODE with full workspace agent harness enabled.
- Priority: Rigorous root-cause diagnosis, deep architectural analysis, and comprehensive verification.
- Execute the complete agent loop:
  1. Search and inspect the workspace using search_files, search_text, read_file.
  2. Formulate diagnosis and apply targeted modifications using edit_file.
  3. Execute automated tests using run_test or run_command to verify changes.
  4. If tests fail, inspect the failure output, diagnose the root cause, repatch, and retest.
  5. Inspect git_diff before returning the final verified response.
- When you have completed the task and verified the results, STOP calling tools and output your final detailed response.`,
  },
};

// Tool schemas
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'workspace_tree',
      description: 'Display a bounded hierarchical directory tree of the workspace.',
      parameters: {
        type: 'object',
        properties: {
          subpath: { type: 'string', description: 'Relative path in workspace (default: ".")' },
          max_depth: { type: 'number', description: 'Maximum depth to traverse (default: 3)' },
          max_entries: { type: 'number', description: 'Maximum number of items to display (default: 100)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List contents of a directory with file types and sizes.',
      parameters: {
        type: 'object',
        properties: {
          subpath: { type: 'string', description: 'Relative path in workspace (default: ".")' },
          max_entries: { type: 'number', description: 'Maximum items to return (default: 50)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Find files matching a glob or substring pattern in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern, e.g. "*.ts", "*config*", "package.json"' },
          subpath: { type: 'string', description: 'Relative folder to search in (default: ".")' },
          max_results: { type: 'number', description: 'Maximum results to return (default: 50)' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_text',
      description: 'Search for text or symbols inside files across the workspace.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text or symbol to search for' },
          subpath: { type: 'string', description: 'Folder to search in (default: ".")' },
          file_pattern: { type: 'string', description: 'Optional filename filter, e.g. "*.js"' },
          max_results: { type: 'number', description: 'Maximum matches to return (default: 30)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read contents of a file in the workspace with line numbers and bounds.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Relative path to file' },
          start_line: { type: 'number', description: '1-indexed starting line (default: 1)' },
          end_line: { type: 'number', description: '1-indexed ending line (optional)' },
          max_lines: { type: 'number', description: 'Max lines to return (default: 200)' },
        },
        required: ['file_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Safely edit a file by replacing exact target content with replacement content.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Relative path to file' },
          target_content: { type: 'string', description: 'Exact string/block in the file to replace' },
          replacement_content: { type: 'string', description: 'New string/block to replace it with' },
        },
        required: ['file_path', 'target_content', 'replacement_content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute a safe, workspace-scoped developer command (e.g. pytest, python, npm).',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to run in WORKSPACE_ROOT' },
          timeout_ms: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_test',
      description: 'Execute targeted automated test command in workspace.',
      parameters: {
        type: 'object',
        properties: {
          test_command: { type: 'string', description: 'Test command (default: "npm test" or "pytest")' },
          target_file: { type: 'string', description: 'Optional specific test file to run' },
          timeout_ms: { type: 'number', description: 'Timeout in milliseconds' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'View current git diff of changes in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Optional specific file path' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Check git status in the workspace.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

// Execute tool directly using workspace tools implementation
function executeTool(name, args, budgetState) {
  if (name === 'search_files' || name === 'search_text' || name === 'workspace_tree' || name === 'list_directory') {
    budgetState.searchesUsed++;
  } else if (name === 'read_file') {
    budgetState.readsUsed++;
  } else if (name === 'edit_file') {
    budgetState.editsUsed++;
  } else if (name === 'run_command' || name === 'run_test') {
    budgetState.testsUsed++;
  }

  const DANGEROUS = [/\brm\s+-rf\b/i, /\bdel\s+\/s\b/i, /\bRemove-Item\b.*-Recurse/i, /\bformat\b/i];

  function safePath(p) {
    const cl = (p || '.').replace(/^[/\\]+/, '');
    const res = path.resolve(WORKSPACE_ROOT, cl);
    if (!path.normalize(res).toLowerCase().startsWith(path.normalize(WORKSPACE_ROOT).toLowerCase())) {
      throw new Error(`Security Error: Access outside WORKSPACE_ROOT (${WORKSPACE_ROOT})`);
    }
    return res;
  }

  try {
    switch (name) {
      case 'workspace_tree': {
        const dir = safePath(args.subpath);
        const maxD = args.max_depth || 3;
        const maxE = args.max_entries || 100;
        const lines = [path.relative(WORKSPACE_ROOT, dir) || '.'];
        let c = 0;
        const walk = (d, dep, pref) => {
          if (dep > maxD || c >= maxE) return;
          const ents = fs.readdirSync(d, { withFileTypes: true }).filter(e => !['.git', 'node_modules', 'dist', '.cache', '__pycache__'].includes(e.name));
          ents.sort((a,b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
          for (let i = 0; i < ents.length && c < maxE; i++) {
            const e = ents[i];
            const isL = i === ents.length - 1;
            c++;
            lines.push(pref + (isL ? '└── ' : '├── ') + e.name + (e.isDirectory() ? '/' : ''));
            if (e.isDirectory()) walk(path.join(d, e.name), dep + 1, pref + (isL ? '    ' : '│   '));
          }
        };
        walk(dir, 1, '');
        return lines.join('\n');
      }
      case 'list_directory': {
        const dir = safePath(args.subpath);
        const ents = fs.readdirSync(dir, { withFileTypes: true }).filter(e => !['.git', 'node_modules', 'dist', '__pycache__'].includes(e.name)).slice(0, args.max_entries || 50);
        return JSON.stringify({ directory: path.relative(WORKSPACE_ROOT, dir) || '.', entries: ents.map(e => ({ name: e.name, type: e.isDirectory() ? 'directory' : 'file' })) }, null, 2);
      }
      case 'search_files': {
        const dir = safePath(args.subpath);
        const reg = new RegExp((args.pattern || '').replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i');
        const matched = [];
        const s = (d) => {
          if (matched.length >= (args.max_results || 50)) return;
          const ents = fs.readdirSync(d, { withFileTypes: true }).filter(e => !['.git', 'node_modules', 'dist', '__pycache__'].includes(e.name));
          for (const e of ents) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) s(full);
            else if (reg.test(e.name)) matched.push(path.relative(WORKSPACE_ROOT, full).replace(/\\/g, '/'));
          }
        };
        s(dir);
        return JSON.stringify({ pattern: args.pattern, matches_found: matched.length, files: matched }, null, 2);
      }
      case 'search_text': {
        const dir = safePath(args.subpath);
        const q = (args.query || '').toLowerCase();
        const matches = [];
        const s = (d) => {
          if (matches.length >= (args.max_results || 30)) return;
          const ents = fs.readdirSync(d, { withFileTypes: true }).filter(e => !['.git', 'node_modules', 'dist', '__pycache__'].includes(e.name));
          for (const e of ents) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) s(full);
            else {
              try {
                if (fs.statSync(full).size > 2 * 1024 * 1024) continue;
                const txt = fs.readFileSync(full, 'utf8');
                const lns = txt.split(/\r?\n/);
                for (let i = 0; i < lns.length; i++) {
                  if (lns[i].toLowerCase().includes(q)) {
                    matches.push({ file: path.relative(WORKSPACE_ROOT, full).replace(/\\/g, '/'), line: i + 1, snippet: lns[i].trim().substring(0, 160) });
                    if (matches.length >= (args.max_results || 30)) return;
                  }
                }
              } catch {}
            }
          }
        };
        s(dir);
        return JSON.stringify({ query: args.query, total_matches: matches.length, matches }, null, 2);
      }
      case 'read_file': {
        const f = safePath(args.file_path);
        const txt = fs.readFileSync(f, 'utf8');
        const lns = txt.split(/\r?\n/);
        const start = Math.max(1, parseInt(args.start_line, 10) || 1);
        const end = Math.min(lns.length, args.end_line ? parseInt(args.end_line, 10) : start + (args.max_lines || 200) - 1);
        const out = [`--- File: ${path.relative(WORKSPACE_ROOT, f).replace(/\\/g, '/')} (Lines ${start}-${end} of ${lns.length}) ---`];
        for (let i = start - 1; i < end; i++) {
          out.push(`${String(i + 1).padStart(5, ' ')} | ${lns[i]}`);
        }
        return out.join('\n');
      }
      case 'edit_file': {
        const f = safePath(args.file_path);
        const orig = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
        const target = (args.target_content || '').replace(/\r\n/g, '\n');
        const repl = (args.replacement_content || '').replace(/\r\n/g, '\n');
        if (!orig.includes(target)) {
          return JSON.stringify({ error: `target_content not found in ${args.file_path}` });
        }
        const updated = orig.replace(target, repl);
        fs.writeFileSync(f, updated, 'utf8');
        return JSON.stringify({ status: 'SUCCESS', file: args.file_path, message: 'Replaced target content successfully' });
      }
      case 'run_command':
      case 'run_test': {
        const cmd = name === 'run_test' ? (args.target_file ? `${args.test_command || 'npm test'} ${args.target_file}` : (args.test_command || 'npm test')) : args.command;
        for (const p of DANGEROUS) {
          if (p.test(cmd)) throw new Error('Restricted command pattern');
        }
        try {
          const out = execSync(cmd, { cwd: WORKSPACE_ROOT, timeout: args.timeout_ms || 30000, encoding: 'utf8' });
          return JSON.stringify({ command: cmd, exit_code: 0, status: 'SUCCESS', output: out.substring(0, 3000).trim() });
        } catch (err) {
          const stdout = err.stdout ? err.stdout.toString() : '';
          const stderr = err.stderr ? err.stderr.toString() : '';
          return JSON.stringify({ command: cmd, exit_code: err.status || 1, status: 'FAILURE', output: (stdout + '\n' + stderr).substring(0, 3000).trim() });
        }
      }
      case 'git_diff': {
        const cmd = args.file_path ? `git diff -- "${args.file_path}"` : 'git diff';
        const d = execSync(cmd, { cwd: WORKSPACE_ROOT, encoding: 'utf8' });
        return JSON.stringify({ diff: d.substring(0, 3000).trim() || 'clean (no diff)' });
      }
      case 'git_status': {
        const s = execSync('git status --short', { cwd: WORKSPACE_ROOT, encoding: 'utf8' });
        return JSON.stringify({ status: s.trim() || 'clean' });
      }
      default:
        return `Error: Unknown tool ${name}`;
    }
  } catch (err) {
    return JSON.stringify({ error: err.message, stdout: err.stdout ? err.stdout.toString().substring(0, 1000) : undefined });
  }
}

/**
 * Execute a complete bounded agent loop with telemetry
 */
async function runAgentTask({ mode = 'HIGH', userPrompt, onStep = () => {} }) {
  const budget = MODE_BUDGETS[mode] || MODE_BUDGETS.HIGH;
  const messages = [
    { role: 'system', content: budget.systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const telemetry = {
    mode,
    startTime: Date.now(),
    llmTurns: 0,
    toolCalls: 0,
    searchesUsed: 0,
    readsUsed: 0,
    editsUsed: 0,
    testsUsed: 0,
    retryLoops: 0,
    toolTraces: [],
    finalAnswer: null,
    success: false,
    durationMs: 0,
  };

  const tools = mode === 'LIGHT' ? [] : TOOL_DEFINITIONS;

  while (telemetry.llmTurns < budget.maxTurns) {
    telemetry.llmTurns++;
    onStep({ type: 'llm_start', turn: telemetry.llmTurns });

    const payload = {
      model: MODEL_NAME,
      messages,
      temperature: 0.2,
      max_tokens: budget.maxOutputTokens,
      stream: false,
      ...(tools.length > 0 ? { tools } : {}),
    };

    let response;
    try {
      const res = await fetch(OLLAMA_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      response = data.choices[0].message;
    } catch (err) {
      telemetry.finalAnswer = `API Error: ${err.message}`;
      break;
    }

    // Check if model returned tool calls
    let toolCalls = [];
    if (response.tool_calls && response.tool_calls.length > 0) {
      toolCalls = response.tool_calls;
    } else if (response.content) {
      // Parse possible JSON / XML function calls from content if raw
      const toolCallMatch = response.content.match(/<tool_call>([\s\S]*?)<\/tool_call>/i) ||
                            response.content.match(/```(?:json|xml)?\s*(?:<function_call>)?\s*(\{[\s\S]*?"name"[\s\S]*?\})\s*(?:<\/function_call>)?\s*```/i) ||
                            response.content.match(/(\{"name":\s*"[a-zA-Z0-9_]+",\s*"arguments":\s*\{[\s\S]*?\}\})/);
      if (toolCallMatch) {
        try {
          const parsed = JSON.parse(toolCallMatch[1]);
          if (parsed.name) {
            toolCalls = [{ id: `call_${Date.now()}`, function: { name: parsed.name, arguments: typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments) } }];
          }
        } catch {}
      }
    }

    // If no tool calls or tool calling is disabled (LIGHT), we reached the final response
    if (toolCalls.length === 0 || tools.length === 0) {
      telemetry.finalAnswer = response.content;
      telemetry.success = true;
      messages.push({ role: 'assistant', content: response.content });
      break;
    }

    // If budget reached, do final synthesis without tools
    if (telemetry.toolCalls >= budget.maxToolCalls || telemetry.llmTurns >= budget.maxTurns) {
      messages.push({ role: 'assistant', content: response.content || '' });
      messages.push({ role: 'user', content: 'You have reached your tool budget. Please synthesize all gathered information and provide your complete final response now.' });
      try {
        const finalRes = await fetch(OLLAMA_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: MODEL_NAME,
            messages,
            temperature: 0.2,
            max_tokens: budget.maxOutputTokens,
            stream: false,
          }),
        });
        const finalData = await finalRes.json();
        telemetry.finalAnswer = finalData.choices[0].message.content;
        telemetry.success = true;
      } catch (err) {
        telemetry.finalAnswer = response.content || `Completed with ${telemetry.toolCalls} tool calls.`;
        telemetry.success = true;
      }
      break;
    }

    // Process tool calls
    messages.push({ role: 'assistant', content: response.content || '', tool_calls: toolCalls });

    for (const call of toolCalls) {
      telemetry.toolCalls++;
      const toolName = call.function.name;
      let toolArgs = {};
      try {
        toolArgs = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;
      } catch {
        toolArgs = {};
      }

      onStep({ type: 'tool_start', tool: toolName, args: toolArgs, turn: telemetry.llmTurns });
      const resultText = executeTool(toolName, toolArgs, telemetry);
      onStep({ type: 'tool_end', tool: toolName, result: resultText.substring(0, 100) });

      // Check if this was a failed test run triggering retry
      if (toolName === 'run_test' || toolName === 'run_command') {
        if (resultText.includes('FAIL') || resultText.includes('ERROR') || resultText.includes('"status": "FAILURE"')) {
          telemetry.retryLoops++;
        }
      }

      telemetry.toolTraces.push({
        turn: telemetry.llmTurns,
        tool: toolName,
        args: toolArgs,
        resultSnippet: resultText.substring(0, 200),
      });

      messages.push({
        role: 'tool',
        tool_call_id: call.id || `call_${telemetry.toolCalls}`,
        content: resultText,
      });
    }
  }

  telemetry.durationMs = Date.now() - telemetry.startTime;
  return telemetry;
}

module.exports = {
  runAgentTask,
  executeTool,
  MODE_BUDGETS,
  TOOL_DEFINITIONS,
};
