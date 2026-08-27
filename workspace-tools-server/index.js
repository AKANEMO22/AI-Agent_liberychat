/**
 * @fileoverview MCP Workspace Tools Server for Local Qwen Coding Agent
 * Architecture:
 * - Server-Side Workspace & Structured Test Registry
 * - Filesystem Tool Confinement (resolveSafePath with realpathSync & Single-File Scope)
 * - Structured Test Execution (pre-registered test_id, no arbitrary shell)
 * - Process/Connection Scoped Session & Hard Budget Enforcement
 * - Zero Model-Controlled Session or Mode Authority
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline');

// ======================== SERVER-SIDE WORKSPACE & TEST REGISTRY ========================

const REGISTRY_FILE = path.resolve(__dirname, '../workspaces.json');

const WORKSPACE_TEST_REGISTRY = {
  'ws_agent_test': {
    tests: {
      'unit': { executable: 'python', args: ['test_discount_engine.py'], description: 'Run discount engine unit tests' },
      'calc': { executable: 'python', args: ['test_calculator.py'], description: 'Run calculator unit tests' },
      'all': { executable: 'python', args: ['-m', 'unittest', 'discover'], description: 'Run all unit tests in workspace' },
    },
  },
  'ws_librechat': {
    tests: {
      'backend': { executable: 'npm', args: ['test'], description: 'Run backend unit tests' },
    },
  },
  'default': {
    tests: {
      'unit': { executable: 'python', args: ['test_discount_engine.py'], description: 'Run default unit tests' },
    },
  },
};

/**
 * Dynamically resolve the active workspace from trusted server-side workspaces.json
 */
function resolveActiveWorkspace() {
  let activeRoot = path.resolve(__dirname, '../workspace-agent-test');
  let activeName = 'workspace-agent-test';
  let activeId = 'ws_agent_test';
  let projectType = 'Python / Unit Test Fixture';
  let hasGit = true;
  let workspaceType = 'project';
  let targetFile = null;
  let allowedFiles = null;

  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const reg = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
      const activeWs = (reg.workspaces || []).find((w) => w.id === reg.activeWorkspaceId) || reg.workspaces?.[0];
      if (activeWs && activeWs.root && fs.existsSync(activeWs.root)) {
        activeRoot = fs.realpathSync(activeWs.root);
        activeName = activeWs.name;
        activeId = activeWs.id;
        projectType = activeWs.projectType || (activeWs.type === 'single_file' ? 'Single File' : 'General Codebase');
        hasGit = !!activeWs.hasGit;
        workspaceType = activeWs.type || 'project';
        targetFile = activeWs.targetFile || (workspaceType === 'single_file' ? activeWs.name : null);
        allowedFiles = activeWs.allowedFiles || (targetFile ? [targetFile] : null);
      }
    }
  } catch {}

  return { activeRoot, activeName, activeId, projectType, hasGit, workspaceType, targetFile, allowedFiles };
}

// Active Mode Policy from trusted server environment (LIGHT, MEDIUM, HIGH)
const AGENT_MODE = (process.env.AGENT_MODE || 'HIGH').toUpperCase().trim();

// ======================== MODE BUDGETS & PERMISSIONS ========================

const MODE_POLICIES = {
  LIGHT: {
    allowedTools: [],
    maxTurns: 1,
    maxTotalTools: 0,
    maxSearches: 0,
    maxReads: 0,
    maxEdits: 0,
    maxTests: 0,
  },
  MEDIUM: {
    allowedTools: [
      'get_workspace_info',
      'workspace_tree',
      'list_directory',
      'search_files',
      'search_text',
      'read_file',
      'edit_file',
      'run_test',
      'git_status',
      'git_diff',
    ],
    maxTurns: 6,
    maxTotalTools: 8,
    maxSearches: 3,
    maxReads: 6,
    maxEdits: 3,
    maxTests: 2,
  },
  HIGH: {
    allowedTools: [
      'get_workspace_info',
      'workspace_tree',
      'list_directory',
      'search_files',
      'search_text',
      'read_file',
      'edit_file',
      'run_test',
      'git_status',
      'git_diff',
    ],
    maxTurns: 12,
    maxTotalTools: 20,
    maxSearches: 8,
    maxReads: 15,
    maxEdits: 8,
    maxTests: 4,
  },
};

const activePolicy = MODE_POLICIES[AGENT_MODE] || MODE_POLICIES['HIGH'];

// ======================== PROCESS / CONNECTION SCOPED USAGE COUNTERS ========================
const PROCESS_INSTANCE_ID = `proc_${process.pid}_${Date.now()}`;
const processCounters = {
  total: 0,
  searches: 0,
  reads: 0,
  edits: 0,
  tests: 0,
};

// Ignore patterns for directory scanning
const DEFAULT_IGNORES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.cache',
  'venv',
  '.venv',
  '__pycache__',
  '.idea',
  '.vscode',
  '.turbo',
  'obj',
  'bin',
]);

/**
 * Validate and resolve a path safely within the active project root (Filesystem Tool Confinement).
 * Enforces strict single-file scope when active workspace is a single file.
 */
function resolveSafePath(userPath, allowDirectoryForScan = false) {
  const { activeRoot, workspaceType, targetFile } = resolveActiveWorkspace();
  if (!userPath || typeof userPath !== 'string') {
    if (workspaceType === 'single_file' && !allowDirectoryForScan && targetFile) {
      return path.join(activeRoot, targetFile);
    }
    return activeRoot;
  }

  const cleanPath = userPath.replace(/^[/\\]+/, '');
  const candidate = path.resolve(activeRoot, cleanPath);

  let realCandidate;
  try {
    realCandidate = fs.realpathSync(candidate);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const parent = path.dirname(candidate);
      try {
        const realParent = fs.realpathSync(parent);
        realCandidate = path.join(realParent, path.basename(candidate));
      } catch {
        realCandidate = candidate;
      }
    } else {
      throw err;
    }
  }

  const rel = path.relative(activeRoot, realCandidate);

  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `Security Violation: Access denied. Path '${userPath}' resolves outside current workspace project root.`
    );
  }

  // Single file scope restriction: Sibling files are prohibited
  if (workspaceType === 'single_file' && targetFile) {
    const isTargetFile =
      rel.toLowerCase() === targetFile.toLowerCase() ||
      path.basename(realCandidate).toLowerCase() === targetFile.toLowerCase();

    if (!isTargetFile && (!allowDirectoryForScan || realCandidate !== activeRoot)) {
      throw new Error(
        `Security Violation: Access denied. Single-file workspace is strictly confined to '${targetFile}'. Sibling files are prohibited.`
      );
    }
  }

  return realCandidate;
}

/**
 * Check and enforce tool budget on the trusted process-level counter.
 */
function checkAndIncrementBudget(toolName) {
  // 1. Verify tool permission in current mode
  if (!activePolicy.allowedTools.includes(toolName)) {
    throw new Error(
      `Permission Denied: Tool '${toolName}' is not allowed in ${AGENT_MODE} mode. Allowed tools: [${activePolicy.allowedTools.join(', ')}]`
    );
  }

  // 2. Total tool call budget
  if (processCounters.total >= activePolicy.maxTotalTools) {
    throw new Error(
      `[MODE_BUDGET_EXHAUSTED] ${AGENT_MODE} mode total tool budget reached: ${processCounters.total}/${activePolicy.maxTotalTools}. Please summarize findings and conclude response.`
    );
  }

  // 3. Category-specific hard limits
  if (['workspace_tree', 'list_directory', 'search_files', 'search_text'].includes(toolName)) {
    if (processCounters.searches >= activePolicy.maxSearches) {
      throw new Error(
        `[MODE_BUDGET_EXHAUSTED] ${AGENT_MODE} mode search budget reached: ${processCounters.searches}/${activePolicy.maxSearches}. Please conclude response.`
      );
    }
    processCounters.searches++;
  } else if (toolName === 'read_file') {
    if (processCounters.reads >= activePolicy.maxReads) {
      throw new Error(
        `[MODE_BUDGET_EXHAUSTED] ${AGENT_MODE} mode read budget reached: ${processCounters.reads}/${activePolicy.maxReads}. Please conclude response.`
      );
    }
    processCounters.reads++;
  } else if (toolName === 'edit_file') {
    if (processCounters.edits >= activePolicy.maxEdits) {
      throw new Error(
        `[MODE_BUDGET_EXHAUSTED] ${AGENT_MODE} mode edit budget reached: ${processCounters.edits}/${activePolicy.maxEdits}. Please verify and conclude response.`
      );
    }
    processCounters.edits++;
  } else if (toolName === 'run_test') {
    if (processCounters.tests >= activePolicy.maxTests) {
      throw new Error(
        `[MODE_BUDGET_EXHAUSTED] ${AGENT_MODE} mode test budget reached: ${processCounters.tests}/${activePolicy.maxTests}. Please conclude response.`
      );
    }
    processCounters.tests++;
  }

  processCounters.total++;
}

// ======================== TOOL HANDLERS ========================

function handleGetWorkspaceInfo() {
  const { activeName, activeId, projectType, hasGit, workspaceType, targetFile, allowedFiles } = resolveActiveWorkspace();
  const availableTests = WORKSPACE_TEST_REGISTRY[activeId]?.tests || WORKSPACE_TEST_REGISTRY['default']?.tests || {};

  return JSON.stringify(
    {
      project_name: activeName,
      workspace_id: activeId,
      workspace_type: workspaceType,
      target_file: targetFile,
      allowed_files: allowedFiles,
      project_type: projectType,
      has_git: hasGit,
      mode: AGENT_MODE,
      budget_used: { ...processCounters },
      budget_limits: activePolicy,
      available_test_ids: Object.keys(availableTests).map((k) => ({
        test_id: k,
        description: availableTests[k].description,
      })),
    },
    null,
    2
  );
}

function handleWorkspaceTree(args = {}) {
  const { activeRoot, workspaceType, targetFile } = resolveActiveWorkspace();

  if (workspaceType === 'single_file' && targetFile) {
    return JSON.stringify(
      {
        workspace: activeRoot,
        workspace_type: 'single_file',
        target_file: targetFile,
        tree: [{ name: targetFile, type: 'file' }],
        truncated: false,
        total_entries: 1,
      },
      null,
      2
    );
  }

  const subpath = typeof args.subpath === 'string' ? args.subpath : '.';
  const maxDepth = Math.min(Math.max(parseInt(args.max_depth, 10) || 3, 1), 5);
  const maxEntries = Math.min(Math.max(parseInt(args.max_entries, 10) || 100, 1), 200);

  const startPath = resolveSafePath(subpath, true);
  let count = 0;
  let truncated = false;

  function buildTree(currentPath, depth) {
    if (depth > maxDepth || count >= maxEntries) {
      if (count >= maxEntries) truncated = true;
      return [];
    }

    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const result = [];
    for (const entry of entries) {
      if (DEFAULT_IGNORES.has(entry.name)) continue;
      count++;
      if (count > maxEntries) {
        truncated = true;
        break;
      }

      const fullChild = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          type: 'directory',
          children: buildTree(fullChild, depth + 1),
        });
      } else {
        result.push({
          name: entry.name,
          type: 'file',
        });
      }
    }
    return result;
  }

  const tree = buildTree(startPath, 1);
  return JSON.stringify(
    {
      workspace: activeRoot,
      subpath,
      tree,
      truncated: truncated ? '[TRUNCATED] Max entry limit reached' : false,
      total_entries: count,
    },
    null,
    2
  );
}

function handleListDirectory(args = {}) {
  const { activeRoot, workspaceType, targetFile } = resolveActiveWorkspace();

  if (workspaceType === 'single_file' && targetFile) {
    const fullPath = path.join(activeRoot, targetFile);
    let size = 0;
    try { size = fs.statSync(fullPath).size; } catch {}

    return JSON.stringify(
      {
        directory: '.',
        workspace_type: 'single_file',
        items: [{ name: targetFile, type: 'file', size_bytes: size }],
        truncated: false,
      },
      null,
      2
    );
  }

  const subpath = typeof args.subpath === 'string' ? args.subpath : '.';
  const maxEntries = Math.min(Math.max(parseInt(args.max_entries, 10) || 50, 1), 100);

  const targetPath = resolveSafePath(subpath, true);
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });

  const items = [];
  let truncated = false;

  for (const entry of entries) {
    if (DEFAULT_IGNORES.has(entry.name)) continue;
    if (items.length >= maxEntries) {
      truncated = true;
      break;
    }

    const fullPath = path.join(targetPath, entry.name);
    let size = 0;
    try {
      size = entry.isFile() ? fs.statSync(fullPath).size : 0;
    } catch {}

    items.push({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size_bytes: size,
    });
  }

  return JSON.stringify(
    {
      directory: path.relative(activeRoot, targetPath) || '.',
      items,
      truncated: truncated ? '[TRUNCATED] Max entries reached' : false,
    },
    null,
    2
  );
}

function handleSearchFiles(args = {}) {
  const { activeRoot, workspaceType, targetFile } = resolveActiveWorkspace();
  const pattern = args.pattern;
  if (!pattern || typeof pattern !== 'string') throw new Error('Missing required argument: pattern (string)');

  if (workspaceType === 'single_file' && targetFile) {
    const regexPattern = new RegExp(pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
    const matched = regexPattern.test(targetFile) ? [{ path: targetFile, type: 'file' }] : [];
    return JSON.stringify({ pattern, matches: matched, count: matched.length, truncated: false }, null, 2);
  }

  const subpath = typeof args.subpath === 'string' ? args.subpath : '.';
  const maxResults = Math.min(Math.max(parseInt(args.max_results, 10) || 50, 1), 100);

  const startPath = resolveSafePath(subpath, true);
  const matched = [];
  let truncated = false;

  const regexPattern = new RegExp(pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');

  function scan(dir) {
    if (matched.length >= maxResults) {
      truncated = true;
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (DEFAULT_IGNORES.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(activeRoot, fullPath);

      if (regexPattern.test(entry.name) || regexPattern.test(relPath)) {
        matched.push({
          path: relPath.replace(/\\/g, '/'),
          type: entry.isDirectory() ? 'directory' : 'file',
        });
        if (matched.length >= maxResults) {
          truncated = true;
          return;
        }
      }

      if (entry.isDirectory()) {
        scan(fullPath);
      }
    }
  }

  scan(startPath);

  return JSON.stringify(
    {
      pattern,
      matches: matched,
      count: matched.length,
      truncated: truncated ? '[TRUNCATED] Max search results reached' : false,
    },
    null,
    2
  );
}

function handleSearchText(args = {}) {
  const { activeRoot, workspaceType, targetFile } = resolveActiveWorkspace();
  const query = args.query;
  if (!query || typeof query !== 'string') throw new Error('Missing required argument: query (string)');

  if (workspaceType === 'single_file' && targetFile) {
    const fullPath = path.join(activeRoot, targetFile);
    const matches = [];
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(query)) {
          matches.push({
            file: targetFile,
            line_number: i + 1,
            line_content: lines[i].trim().substring(0, 200),
          });
        }
      }
    } catch {}
    return JSON.stringify({ query, matches, count: matches.length, truncated: false }, null, 2);
  }

  const subpath = typeof args.subpath === 'string' ? args.subpath : '.';
  const filePattern = typeof args.file_pattern === 'string' ? new RegExp(args.file_pattern.replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i') : null;
  const maxResults = Math.min(Math.max(parseInt(args.max_results, 10) || 30, 1), 50);

  const startPath = resolveSafePath(subpath, true);
  const matches = [];
  let truncated = false;

  function scan(dir) {
    if (matches.length >= maxResults) {
      truncated = true;
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (DEFAULT_IGNORES.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        if (filePattern && !filePattern.test(entry.name)) continue;

        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > 2 * 1024 * 1024) continue;

          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('\0')) continue;

          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(query)) {
              matches.push({
                file: path.relative(activeRoot, fullPath).replace(/\\/g, '/'),
                line_number: i + 1,
                line_content: lines[i].trim().substring(0, 200),
              });

              if (matches.length >= maxResults) {
                truncated = true;
                return;
              }
            }
          }
        } catch {}
      }
    }
  }

  scan(startPath);

  return JSON.stringify(
    {
      query,
      matches,
      count: matches.length,
      truncated: truncated ? '[TRUNCATED] Max text search results reached' : false,
    },
    null,
    2
  );
}

function handleReadFile(args = {}) {
  const { activeRoot } = resolveActiveWorkspace();
  const filePath = args.file_path;
  if (!filePath || typeof filePath !== 'string') throw new Error('Missing required argument: file_path (string)');

  const realPath = resolveSafePath(filePath);
  const stat = fs.statSync(realPath);

  if (stat.isDirectory()) {
    throw new Error(`Cannot read '${filePath}': Target is a directory. Use list_directory instead.`);
  }

  if (stat.size > 2 * 1024 * 1024) {
    throw new Error(`File '${filePath}' exceeds 2MB safety size limit.`);
  }

  const raw = fs.readFileSync(realPath);
  if (raw.includes(0)) {
    throw new Error(`File '${filePath}' appears to be binary and cannot be read as text.`);
  }

  const content = raw.toString('utf8');
  const allLines = content.split(/\r?\n/);
  const totalLines = allLines.length;

  const startLine = Math.max(parseInt(args.start_line, 10) || 1, 1);
  const maxLines = Math.min(Math.max(parseInt(args.max_lines, 10) || 200, 1), 300);
  const endLine = args.end_line ? Math.min(parseInt(args.end_line, 10), totalLines) : Math.min(startLine + maxLines - 1, totalLines);

  const selectedLines = [];
  for (let i = startLine; i <= endLine; i++) {
    selectedLines.push(`${i}: ${allLines[i - 1]}`);
  }

  const isTruncated = endLine < totalLines;

  return JSON.stringify(
    {
      file_path: path.relative(activeRoot, realPath).replace(/\\/g, '/'),
      total_lines: totalLines,
      start_line: startLine,
      end_line: endLine,
      truncated: isTruncated ? `[TRUNCATED] Showing lines ${startLine}-${endLine} of ${totalLines}` : false,
      content: selectedLines.join('\n'),
    },
    null,
    2
  );
}

function handleEditFile(args = {}) {
  const { activeRoot } = resolveActiveWorkspace();
  const filePath = args.file_path;
  const targetContent = args.target_content;
  const replacementContent = args.replacement_content;

  if (typeof filePath !== 'string' || typeof targetContent !== 'string' || typeof replacementContent !== 'string') {
    throw new Error('Missing required arguments: file_path (string), target_content (string), replacement_content (string)');
  }

  const realPath = resolveSafePath(filePath);

  if (!fs.existsSync(realPath)) {
    throw new Error(`File '${filePath}' does not exist. edit_file requires an existing file.`);
  }

  const stat = fs.statSync(realPath);
  if (stat.size > 2 * 1024 * 1024) {
    throw new Error(`File '${filePath}' exceeds 2MB safety limit.`);
  }

  const currentContent = fs.readFileSync(realPath, 'utf8');
  const normalizedCurrent = currentContent.replace(/\r\n/g, '\n');
  const normalizedTarget = targetContent.replace(/\r\n/g, '\n');
  const normalizedReplacement = replacementContent.replace(/\r\n/g, '\n');

  const firstIndex = normalizedCurrent.indexOf(normalizedTarget);
  if (firstIndex === -1) {
    throw new Error(`Target content not found in '${filePath}'. Ensure exact character and whitespace match.`);
  }

  const secondIndex = normalizedCurrent.indexOf(normalizedTarget, firstIndex + 1);
  if (secondIndex !== -1) {
    throw new Error(
      `Target content appears multiple times in '${filePath}'. Please provide more surrounding lines for a unique match.`
    );
  }

  const updatedContent =
    normalizedCurrent.substring(0, firstIndex) +
    normalizedReplacement +
    normalizedCurrent.substring(firstIndex + normalizedTarget.length);

  // Preserve line endings of original file
  const finalContent = currentContent.includes('\r\n') ? updatedContent.replace(/\n/g, '\r\n') : updatedContent;

  // Direct Atomic Write: write temp file then rename over target
  const tmpPath = `${realPath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
  fs.writeFileSync(tmpPath, finalContent, 'utf8');
  fs.renameSync(tmpPath, realPath);

  const newLines = finalContent.split(/\r?\n/).length;

  return JSON.stringify(
    {
      file_path: path.relative(activeRoot, realPath).replace(/\\/g, '/'),
      status: 'SUCCESS',
      bytes_written: Buffer.byteLength(finalContent, 'utf8'),
      total_lines: newLines,
      message: `File '${filePath}' successfully modified on disk (direct atomic write).`,
    },
    null,
    2
  );
}

function handleRunTest(args = {}) {
  const { activeRoot, activeId } = resolveActiveWorkspace();
  const testId = (args.test_id || 'unit').toLowerCase().trim();

  const workspaceTests = WORKSPACE_TEST_REGISTRY[activeId]?.tests || WORKSPACE_TEST_REGISTRY['default']?.tests || {};
  const testConfig = workspaceTests[testId];

  if (!testConfig) {
    const available = Object.keys(workspaceTests).join(', ');
    throw new Error(
      `Invalid test_id '${testId}'. Pre-registered tests for workspace '${activeId}': [${available}]. Arbitrary shell commands are prohibited.`
    );
  }

  const startTime = Date.now();
  let proc;
  try {
    proc = spawnSync(testConfig.executable, testConfig.args, {
      cwd: activeRoot,
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, PYTHONUNBUFFERED: '1', CI: '1' },
      shell: false,
    });
  } catch (err) {
    throw new Error(`Failed to execute structured test '${testId}': ${err.message}`);
  }

  const durationMs = Date.now() - startTime;
  const stdout = (proc.stdout || '').substring(0, 3000);
  const stderr = (proc.stderr || '').substring(0, 3000);
  const exitCode = proc.status ?? (proc.signal ? -1 : 1);
  const passed = exitCode === 0;

  return JSON.stringify(
    {
      test_id: testId,
      description: testConfig.description,
      exit_code: exitCode,
      passed,
      duration_ms: durationMs,
      stdout: stdout.trim() || null,
      stderr: stderr.trim() || null,
    },
    null,
    2
  );
}

function handleGitStatus() {
  const { activeRoot, hasGit } = resolveActiveWorkspace();
  if (!hasGit) {
    return JSON.stringify({ status: 'Not a git repository' }, null, 2);
  }

  try {
    const res = spawnSync('git', ['status', '--short'], {
      cwd: activeRoot,
      encoding: 'utf8',
      timeout: 10000,
      shell: false,
    });
    return JSON.stringify({ status: (res.stdout || '').trim() || 'Clean working directory' }, null, 2);
  } catch (err) {
    return JSON.stringify({ error: err.message }, null, 2);
  }
}

function handleGitDiff(args = {}) {
  const { activeRoot, hasGit } = resolveActiveWorkspace();
  if (!hasGit) {
    return JSON.stringify({ diff: 'Not a git repository' }, null, 2);
  }

  const filePath = args.file_path ? [args.file_path] : [];
  try {
    const res = spawnSync('git', ['diff', ...filePath], {
      cwd: activeRoot,
      encoding: 'utf8',
      timeout: 10000,
      shell: false,
    });
    const out = (res.stdout || '').substring(0, 5000);
    return JSON.stringify({ diff: out.trim() || 'No changes' }, null, 2);
  } catch (err) {
    return JSON.stringify({ error: err.message }, null, 2);
  }
}

// ======================== MCP TOOL DEFINITIONS ========================

const MCP_TOOLS = [
  {
    name: 'get_workspace_info',
    description: 'Get active workspace project info, test IDs, and budget usage.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'workspace_tree',
    description: 'Explore directory structure of the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        subpath: { type: 'string', description: 'Relative path to inspect' },
        max_depth: { type: 'integer', description: 'Max depth (1-5)' },
        max_entries: { type: 'integer', description: 'Max entries to list' },
      },
    },
  },
  {
    name: 'list_directory',
    description: 'List direct children of a folder.',
    inputSchema: {
      type: 'object',
      properties: {
        subpath: { type: 'string', description: 'Folder relative path' },
        max_entries: { type: 'integer', description: 'Max entries' },
      },
    },
  },
  {
    name: 'search_files',
    description: 'Find files matching a glob/filename pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Filename pattern e.g. *.py' },
        subpath: { type: 'string', description: 'Start directory' },
        max_results: { type: 'integer', description: 'Max results' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'search_text',
    description: 'Search for text/symbols across workspace files.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        subpath: { type: 'string', description: 'Start directory' },
        file_pattern: { type: 'string', description: 'Optional file filter' },
        max_results: { type: 'integer', description: 'Max results' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_file',
    description: 'Read contents of a file in the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Relative path to file' },
        start_line: { type: 'integer', description: 'Start line (1-indexed)' },
        max_lines: { type: 'integer', description: 'Max lines to read' },
        end_line: { type: 'integer', description: 'End line (1-indexed)' },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'edit_file',
    description: 'Directly and atomically modify a file in the workspace by exact string replacement.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Relative path to file' },
        target_content: { type: 'string', description: 'Exact content to replace' },
        replacement_content: { type: 'string', description: 'New replacement content' },
      },
      required: ['file_path', 'target_content', 'replacement_content'],
    },
  },
  {
    name: 'run_test',
    description: 'Execute a pre-registered unit test suite.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: { type: 'string', description: 'Pre-registered test ID' },
      },
      required: ['test_id'],
    },
  },
  {
    name: 'git_status',
    description: 'Get short git status of workspace.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'git_diff',
    description: 'Get git diff for modified files.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Optional specific file' },
      },
    },
  },
];

// ======================== MCP JSON-RPC DISPATCHER ========================

function sendResponse(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  if (!line.trim()) return;

  let request;
  try {
    request = JSON.parse(line);
  } catch {
    sendResponse({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    });
    return;
  }

  const { id, method, params } = request;

  if (method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'workspace-tools-server',
          version: '3.0.0',
        },
      },
    });
    return;
  }

  if (method === 'ping') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {},
    });
    return;
  }

  if (method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS,
      },
    });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    try {
      checkAndIncrementBudget(toolName);

      let resultText;
      switch (toolName) {
        case 'get_workspace_info':
          resultText = handleGetWorkspaceInfo();
          break;
        case 'workspace_tree':
          resultText = handleWorkspaceTree(toolArgs);
          break;
        case 'list_directory':
          resultText = handleListDirectory(toolArgs);
          break;
        case 'search_files':
          resultText = handleSearchFiles(toolArgs);
          break;
        case 'search_text':
          resultText = handleSearchText(toolArgs);
          break;
        case 'read_file':
          resultText = handleReadFile(toolArgs);
          break;
        case 'edit_file':
          resultText = handleEditFile(toolArgs);
          break;
        case 'run_test':
          resultText = handleRunTest(toolArgs);
          break;
        case 'git_status':
          resultText = handleGitStatus(toolArgs);
          break;
        case 'git_diff':
          resultText = handleGitDiff(toolArgs);
          break;
        default:
          sendResponse({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method '${toolName}' not found` },
          });
          return;
      }

      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: resultText }],
        },
      });
    } catch (err) {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: `ERROR: ${err.message}` }],
          isError: true,
        },
      });
    }
  }
});
