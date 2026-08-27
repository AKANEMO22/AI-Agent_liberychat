/**
 * @fileoverview Trusted Server-Side Workspace Registry for Local Qwen Coding Agent
 * Manages persistent project and single-file registrations, root validation,
 * security blacklisting, read-only metadata detection, and active workspace tracking.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const REGISTRY_FILE = path.resolve(__dirname, '../../../../workspaces.json');

// Default starter workspaces
const DEFAULT_REGISTRY = {
  activeWorkspaceId: 'ws_agent_test',
  workspaces: [
    {
      id: 'ws_agent_test',
      type: 'project',
      name: 'workspace-agent-test',
      root: path.resolve(__dirname, '../../../../workspace-agent-test'),
      createdAt: Date.now(),
      lastOpened: Date.now(),
      projectType: 'Python / Unit Test Fixture',
      hasGit: true,
    },
    {
      id: 'ws_librechat',
      type: 'project',
      name: 'LibreChat',
      root: path.resolve(__dirname, '../../../../LibreChat'),
      createdAt: Date.now(),
      lastOpened: Date.now(),
      projectType: 'TypeScript / React / Node.js',
      hasGit: true,
    },
  ],
};

/**
 * Blacklisted dangerous filesystem roots that must never be registered as normal workspaces.
 */
function isDangerousRoot(candidatePath) {
  const normalized = path.normalize(candidatePath).toLowerCase().trim();

  // 1. Drive roots: "C:\", "D:\", "C:", etc.
  if (/^[a-zA-Z]:[/\\]?$/.test(normalized)) {
    return 'Drive root cannot be registered as a workspace.';
  }

  // 2. Windows and System folders
  const winDir = (process.env.WINDIR || 'C:\\Windows').toLowerCase();
  const sysDrive = (process.env.SystemDrive || 'C:').toLowerCase();
  const progFiles = (process.env['ProgramFiles'] || 'C:\\Program Files').toLowerCase();
  const progFilesX86 = (process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)').toLowerCase();
  const progData = (process.env['ProgramData'] || 'C:\\ProgramData').toLowerCase();

  if (normalized === winDir || normalized.startsWith(winDir + '\\')) {
    return 'System directory (Windows) cannot be registered as a workspace.';
  }

  if (normalized === progFiles || normalized === progFilesX86 || normalized === progData) {
    return 'Program Files or ProgramData root cannot be registered as a workspace.';
  }

  // 3. Whole C:\Users root
  const usersDir = path.join(sysDrive, 'users').toLowerCase();
  if (normalized === usersDir || normalized === usersDir + '\\') {
    return 'The global Users directory cannot be registered as a workspace. Select a specific project directory.';
  }

  // 4. AppData / Temp roots
  const appData = (process.env.APPDATA || '').toLowerCase();
  const localAppData = (process.env.LOCALAPPDATA || '').toLowerCase();
  const tempDir = (process.env.TEMP || '').toLowerCase();

  if (normalized === appData || normalized === localAppData || normalized === tempDir) {
    return 'Application data or Temp root cannot be registered as a workspace.';
  }

  return null;
}

/**
 * Detect project features read-only without executing any code.
 */
function detectProjectMetadata(realDir) {
  let projectType = 'General Codebase';
  let hasGit = false;

  try {
    const entries = fs.readdirSync(realDir);
    const entrySet = new Set(entries);

    hasGit = entrySet.has('.git');

    if (entrySet.has('package.json')) {
      if (entrySet.has('tsconfig.json')) {
        projectType = 'TypeScript / Node.js';
      } else {
        projectType = 'JavaScript / Node.js';
      }
    } else if (entrySet.has('pyproject.toml') || entrySet.has('requirements.txt') || entrySet.has('setup.py')) {
      projectType = 'Python Project';
    } else if (entrySet.has('Cargo.toml')) {
      projectType = 'Rust Crate';
    } else if (entrySet.has('go.mod')) {
      projectType = 'Go Module';
    } else if (entrySet.has('pom.xml') || entrySet.has('build.gradle')) {
      projectType = 'Java / Gradle / Maven';
    } else if (entrySet.has('CMakeLists.txt') || entrySet.has('Makefile')) {
      projectType = 'C / C++ Project';
    }
  } catch {}

  return { projectType, hasGit };
}

/**
 * Detect file type description based on extension.
 */
function detectFileMetadata(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.py': 'Python Source File',
    '.js': 'JavaScript File',
    '.ts': 'TypeScript File',
    '.tsx': 'React TypeScript File',
    '.jsx': 'React JavaScript File',
    '.cpp': 'C++ Source File',
    '.c': 'C Source File',
    '.h': 'C/C++ Header File',
    '.hpp': 'C++ Header File',
    '.rs': 'Rust Source File',
    '.go': 'Go Source File',
    '.java': 'Java Source File',
    '.html': 'HTML Document',
    '.css': 'CSS Stylesheet',
    '.json': 'JSON Document',
    '.md': 'Markdown Document',
    '.txt': 'Plain Text File',
    '.yml': 'YAML File',
    '.yaml': 'YAML File',
    '.sh': 'Shell Script',
    '.bat': 'Batch Script',
    '.ps1': 'PowerShell Script',
  };
  return map[ext] || 'Source File';
}

class WorkspaceRegistry {
  static loadRegistry() {
    try {
      if (fs.existsSync(REGISTRY_FILE)) {
        const raw = fs.readFileSync(REGISTRY_FILE, 'utf8');
        const data = JSON.parse(raw);
        data.workspaces = (data.workspaces || []).map((w) => ({
          ...w,
          type: w.type || 'project',
        }));
        return data;
      }
    } catch {}

    WorkspaceRegistry.saveRegistry(DEFAULT_REGISTRY);
    return DEFAULT_REGISTRY;
  }

  static saveRegistry(data) {
    try {
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[WorkspaceRegistry] Error saving registry:', err);
    }
  }

  static listWorkspaces() {
    const reg = WorkspaceRegistry.loadRegistry();
    const list = (reg.workspaces || []).map((w) => {
      let isAvailable = false;
      try {
        if (w.type === 'single_file') {
          const filePath = path.join(w.root, w.targetFile || w.name);
          isAvailable = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
        } else {
          isAvailable = fs.existsSync(w.root) && fs.statSync(w.root).isDirectory();
        }
      } catch {
        isAvailable = false;
      }

      return {
        id: w.id,
        type: w.type || 'project',
        name: w.name,
        root: w.root,
        targetFile: w.targetFile || null,
        allowedFiles: w.allowedFiles || null,
        createdAt: w.createdAt,
        lastOpened: w.lastOpened || w.createdAt,
        projectType: w.projectType || (w.type === 'single_file' ? 'Single File' : 'General Codebase'),
        hasGit: !!w.hasGit,
        isAvailable,
      };
    });

    return {
      activeWorkspaceId: reg.activeWorkspaceId || list[0]?.id,
      workspaces: list,
    };
  }

  static getActiveWorkspace() {
    const reg = WorkspaceRegistry.loadRegistry();
    const activeId = reg.activeWorkspaceId;
    const ws = (reg.workspaces || []).find((w) => w.id === activeId) || reg.workspaces?.[0];
    return ws || null;
  }

  static setActiveWorkspace(workspaceId) {
    const reg = WorkspaceRegistry.loadRegistry();
    const ws = (reg.workspaces || []).find((w) => w.id === workspaceId);
    if (!ws) {
      throw new Error(`Workspace ID '${workspaceId}' not found in trusted registry.`);
    }

    if (ws.type === 'single_file') {
      const filePath = path.join(ws.root, ws.targetFile || ws.name);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw new Error(`File '${ws.name}' is currently unavailable (file not found on disk).`);
      }
    } else {
      if (!fs.existsSync(ws.root) || !fs.statSync(ws.root).isDirectory()) {
        throw new Error(`Workspace '${ws.name}' is currently unavailable (folder not found on disk).`);
      }
    }

    ws.lastOpened = Date.now();
    reg.activeWorkspaceId = ws.id;
    WorkspaceRegistry.saveRegistry(reg);
    return ws;
  }

  /**
   * Register a full folder project workspace.
   */
  static addWorkspace(folderCandidate, customName) {
    if (!folderCandidate || typeof folderCandidate !== 'string') {
      throw new Error('Missing folder path');
    }

    const trimmed = folderCandidate.trim();
    const resolvedCandidate = path.resolve(trimmed);

    if (!fs.existsSync(resolvedCandidate)) {
      throw new Error(`Directory does not exist: '${trimmed}'`);
    }

    let realRoot;
    try {
      realRoot = fs.realpathSync(resolvedCandidate);
    } catch {
      throw new Error(`Cannot resolve real path for '${trimmed}'`);
    }

    const stat = fs.statSync(realRoot);
    if (!stat.isDirectory()) {
      throw new Error(`Selected path is a file, not a directory: '${realRoot}'. Use Open File instead.`);
    }

    const dangerError = isDangerousRoot(realRoot);
    if (dangerError) {
      throw new Error(`Security Violation: ${dangerError}`);
    }

    const reg = WorkspaceRegistry.loadRegistry();
    const existing = (reg.workspaces || []).find((w) => {
      try {
        return w.type !== 'single_file' && fs.realpathSync(w.root).toLowerCase() === realRoot.toLowerCase();
      } catch {
        return false;
      }
    });

    if (existing) {
      existing.type = existing.type || 'project';
      existing.lastOpened = Date.now();
      reg.activeWorkspaceId = existing.id;
      WorkspaceRegistry.saveRegistry(reg);
      return existing;
    }

    const { projectType, hasGit } = detectProjectMetadata(realRoot);
    const id = `ws_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const name = customName?.trim() || path.basename(realRoot) || 'Project';

    const newWs = {
      id,
      type: 'project',
      name,
      root: realRoot,
      createdAt: Date.now(),
      lastOpened: Date.now(),
      projectType,
      hasGit,
    };

    reg.workspaces = reg.workspaces || [];
    reg.workspaces.push(newWs);
    reg.activeWorkspaceId = id;
    WorkspaceRegistry.saveRegistry(reg);

    return newWs;
  }

  /**
   * Register a controlled single-file workspace.
   */
  static addSingleFileWorkspace(fileCandidate, customName) {
    if (!fileCandidate || typeof fileCandidate !== 'string') {
      throw new Error('Missing file path');
    }

    const trimmed = fileCandidate.trim();
    const resolvedCandidate = path.resolve(trimmed);

    if (!fs.existsSync(resolvedCandidate)) {
      throw new Error(`File does not exist: '${trimmed}'`);
    }

    let realFilePath;
    try {
      realFilePath = fs.realpathSync(resolvedCandidate);
    } catch {
      throw new Error(`Cannot resolve real path for '${trimmed}'`);
    }

    const stat = fs.statSync(realFilePath);
    if (!stat.isFile()) {
      throw new Error(`Selected path is a directory, not a file: '${realFilePath}'. Use Open Folder instead.`);
    }

    const parentDir = path.dirname(realFilePath);
    const dangerError = isDangerousRoot(parentDir);
    if (dangerError) {
      throw new Error(`Security Violation: Parent directory '${parentDir}' is restricted.`);
    }

    const fileName = path.basename(realFilePath);
    const reg = WorkspaceRegistry.loadRegistry();

    const existing = (reg.workspaces || []).find((w) => {
      try {
        if (w.type === 'single_file') {
          const p = path.join(w.root, w.targetFile || w.name);
          return fs.realpathSync(p).toLowerCase() === realFilePath.toLowerCase();
        }
        return false;
      } catch {
        return false;
      }
    });

    if (existing) {
      existing.lastOpened = Date.now();
      reg.activeWorkspaceId = existing.id;
      WorkspaceRegistry.saveRegistry(reg);
      return existing;
    }

    const projectType = detectFileMetadata(realFilePath);
    const id = `ws_file_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const name = customName?.trim() || fileName;

    let hasGit = false;
    try {
      hasGit = fs.existsSync(path.join(parentDir, '.git'));
    } catch {}

    const newWs = {
      id,
      type: 'single_file',
      name,
      root: parentDir,
      targetFile: fileName,
      allowedFiles: [fileName],
      createdAt: Date.now(),
      lastOpened: Date.now(),
      projectType,
      hasGit,
    };

    reg.workspaces = reg.workspaces || [];
    reg.workspaces.push(newWs);
    reg.activeWorkspaceId = id;
    WorkspaceRegistry.saveRegistry(reg);

    return newWs;
  }

  /**
   * User escalation: escalate a single file workspace to its containing folder project.
   */
  static escalateSingleFileToProject(workspaceId) {
    const reg = WorkspaceRegistry.loadRegistry();
    const ws = (reg.workspaces || []).find((w) => w.id === workspaceId);
    if (!ws) {
      throw new Error(`Workspace '${workspaceId}' not found.`);
    }
    if (ws.type !== 'single_file') {
      return ws;
    }

    const containingFolder = ws.root;
    return WorkspaceRegistry.addWorkspace(containingFolder);
  }

  static removeWorkspace(workspaceId) {
    const reg = WorkspaceRegistry.loadRegistry();
    const idx = (reg.workspaces || []).findIndex((w) => w.id === workspaceId);
    if (idx === -1) {
      throw new Error(`Workspace '${workspaceId}' not found.`);
    }

    const removed = reg.workspaces.splice(idx, 1)[0];

    if (reg.activeWorkspaceId === workspaceId) {
      reg.activeWorkspaceId = reg.workspaces[0]?.id || null;
    }

    WorkspaceRegistry.saveRegistry(reg);
    return { status: 'REMOVED_FROM_REGISTRY', removedId: workspaceId, name: removed.name };
  }

  /**
   * Trigger native Windows picker dialog asynchronously via fixed server-side PowerShell script.
   * Keeps Node.js event loop completely non-blocking for concurrent requests.
   * Automatically kills the child process if the client connection is aborted/cancelled.
   */
  static pickNativePathAsync(mode = 'folder', initialDir = '', signal = null) {
    return new Promise((resolve) => {
      const scriptPath = path.resolve(__dirname, 'native-picker.ps1');
      const startDir = initialDir && fs.existsSync(initialDir) ? initialDir : (process.env.USERPROFILE || 'C:\\');

      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-STA',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          '-Mode',
          mode,
          '-InitialDir',
          startDir,
        ],
        {
          windowsHide: false,
        }
      );

      let stdout = '';
      let stderr = '';
      let isSettled = false;

      const safeFinish = (result) => {
        if (isSettled) return;
        isSettled = true;
        if (signal) {
          try {
            signal.removeEventListener('abort', onAbort);
          } catch {}
        }
        resolve(result);
      };

      const onAbort = () => {
        try {
          if (!child.killed) {
            child.kill('SIGTERM');
          }
        } catch {}
        safeFinish(null);
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        try {
          signal.addEventListener('abort', onAbort);
        } catch {}
      }

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', (err) => {
        console.error('[WorkspaceRegistry.pickNativePathAsync] Child process error:', err);
        safeFinish(null);
      });

      child.on('close', () => {
        const lines = (stdout || '').trim().split('\n').map((l) => l.trim()).filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i]);
            if (parsed.status === 'selected' && parsed.path) {
              return safeFinish(path.normalize(parsed.path));
            }
            if (parsed.status === 'cancelled') {
              return safeFinish(null);
            }
          } catch {}
        }

        const raw = lines.pop() || '';
        safeFinish(raw && fs.existsSync(raw) ? path.normalize(raw) : null);
      });
    });
  }

  /**
   * Synchronous fallback for legacy synchronous tests only.
   */
  static pickNativePath(mode = 'folder', initialDir = '') {
    const scriptPath = path.resolve(__dirname, 'native-picker.ps1');
    const startDir = initialDir && fs.existsSync(initialDir) ? initialDir : (process.env.USERPROFILE || 'C:\\');

    try {
      const res = spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-STA',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          '-Mode',
          mode,
          '-InitialDir',
          startDir,
        ],
        {
          encoding: 'utf8',
          timeout: 120000,
          windowsHide: false,
        }
      );

      if (res.error) throw res.error;

      const lines = (res.stdout || '').trim().split('\n').map((l) => l.trim()).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(lines[i]);
          if (parsed.status === 'selected' && parsed.path) {
            return path.normalize(parsed.path);
          }
          if (parsed.status === 'cancelled') {
            return null;
          }
        } catch {}
      }

      const raw = lines.pop() || '';
      return raw && fs.existsSync(raw) ? path.normalize(raw) : null;
    } catch (err) {
      console.error('[WorkspaceRegistry.pickNativePath] Error:', err);
      return null;
    }
  }

  // Default presentation noise ignore list
  static IGNORE_LIST = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.next',
    '.cache',
    '__pycache__',
    'venv',
    '.venv',
  ]);

  static activeFilesByWorkspace = {};

  /**
   * Lazily enumerate direct children of a subfolder within the active workspace.
   * Enforces strict realpath and traversal boundaries.
   */
  static getWorkspaceTree(subDir = '') {
    const activeWs = this.getActiveWorkspace();
    if (!activeWs) {
      throw new Error('No active workspace selected.');
    }

    if (activeWs.type === 'single_file') {
      const fileName = activeWs.targetFile || activeWs.name;
      let fileSize = 0;
      try {
        const fullPath = path.resolve(activeWs.root, fileName);
        if (fs.existsSync(fullPath)) {
          fileSize = fs.statSync(fullPath).size;
        }
      } catch {}
      return {
        type: 'single_file',
        workspaceId: activeWs.id,
        workspaceName: activeWs.name,
        workspaceRoot: activeWs.root,
        targetFile: fileName,
        subDir: '',
        directories: [],
        files: [{ name: fileName, relativePath: fileName, size: fileSize }],
        truncated: false,
      };
    }

    const wsRoot = fs.realpathSync(activeWs.root);
    const cleanSubDir = (subDir || '').replace(/^[\/\\]+/, '').replace(/[\/\\]+$/, '');
    const targetDir = path.resolve(wsRoot, cleanSubDir);

    // Boundary check
    if (!targetDir.startsWith(wsRoot)) {
      throw new Error('Access denied: Path traverses outside active workspace.');
    }

    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory not found: ${cleanSubDir || '.'}`);
    }

    const realTarget = fs.realpathSync(targetDir);
    if (!realTarget.startsWith(wsRoot)) {
      throw new Error('Access denied: Symlink points outside active workspace.');
    }

    const stat = fs.statSync(realTarget);
    if (!stat.isDirectory()) {
      throw new Error('Target path is not a directory.');
    }

    const rawEntries = fs.readdirSync(realTarget, { withFileTypes: true });
    const directories = [];
    const files = [];

    const MAX_CHILDREN = 500;
    let count = 0;
    let truncated = false;

    for (const entry of rawEntries) {
      if (count >= MAX_CHILDREN) {
        truncated = true;
        break;
      }
      if (this.IGNORE_LIST.has(entry.name)) continue;
      if (entry.name.startsWith('$')) continue;

      const relativeEntryPath = cleanSubDir ? `${cleanSubDir}/${entry.name}` : entry.name;
      const fullEntryPath = path.join(realTarget, entry.name);

      try {
        if (entry.isDirectory()) {
          directories.push({
            name: entry.name,
            relativePath: relativeEntryPath,
          });
          count++;
        } else if (entry.isFile()) {
          const fileStat = fs.statSync(fullEntryPath);
          files.push({
            name: entry.name,
            relativePath: relativeEntryPath,
            size: fileStat.size,
          });
          count++;
        }
      } catch {}
    }

    // Sort: directories first (alpha), files second (alpha)
    directories.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return {
      type: 'project',
      workspaceId: activeWs.id,
      workspaceName: activeWs.name,
      workspaceRoot: activeWs.root,
      subDir: cleanSubDir,
      directories,
      files,
      truncated,
    };
  }

  /**
   * Set the focused file for a specific conversation + workspace pair.
   * Also updates the workspace-level default (used as fallback for new conversations).
   * @param {string} workspaceId
   * @param {string} relativePath
   * @param {string} [conversationId] - If provided, scopes focus to this conversation
   */
  static setActiveFile(workspaceId, relativePath, conversationId) {
    const reg = this.loadRegistry();
    if (!workspaceId) {
      workspaceId = reg.activeWorkspaceId || (reg.workspaces?.[0]?.id);
    }
    if (!workspaceId) return null;

    const clean = relativePath ? relativePath.trim().replace(/^[\/\\]+/, '') : '';

    // Update workspace-level default (fallback for new conversations)
    // Only clear workspace-level if no conversationId is provided (global clear)
    // When conversation-scoped, only update workspace-level with positive values
    if (!reg.activeFilesByWorkspace) {
      reg.activeFilesByWorkspace = {};
    }
    if (clean) {
      reg.activeFilesByWorkspace[workspaceId] = clean;
    } else if (!conversationId || conversationId === 'new') {
      // Only clear workspace-level default for non-conversation-scoped clears
      delete reg.activeFilesByWorkspace[workspaceId];
    }

    // If conversationId provided, store conversation-scoped focus
    if (conversationId && conversationId !== 'new') {
      if (!reg.activeFilesByConversation) {
        reg.activeFilesByConversation = {};
      }
      if (!clean) {
        delete reg.activeFilesByConversation[conversationId];
      } else {
        reg.activeFilesByConversation[conversationId] = {
          workspaceId,
          activeFile: clean,
        };
      }
    }

    this.saveRegistry(reg);
    return clean || null;
  }

  /**
   * Get the focused file, strictly scoped by conversationId.
   * Deterministic Rules:
   * 1. Single-file workspaces always focus their target file (if existing on disk).
   * 2. New conversations ('new') start with NO focused file (null).
   * 3. Specific conversations return only their explicitly focused file, or null (no bleed).
   * 4. Missing/deleted files on disk return null and purge stale records.
   * @param {string} [workspaceId]
   * @param {string} [conversationId]
   */
  static getActiveFile(workspaceId, conversationId) {
    const reg = this.loadRegistry();
    if (!workspaceId) {
      workspaceId = reg.activeWorkspaceId || (reg.workspaces?.[0]?.id);
    }
    if (!workspaceId) return null;

    const ws = (reg.workspaces || []).find((w) => w.id === workspaceId);
    if (!ws) return null;

    // Single-file workspace always focuses its target file
    if (ws.type === 'single_file') {
      const singleTarget = ws.targetFile || ws.name;
      const fullPath = path.resolve(ws.root, singleTarget);
      if (fs.existsSync(fullPath)) {
        return singleTarget;
      }
      return null;
    }

    let activeFile = null;

    // 1. If conversationId is specified:
    if (conversationId) {
      if (conversationId === 'new') {
        // Deterministic rule: New conversation starts with NO focused file
        return null;
      }
      if (reg.activeFilesByConversation && reg.activeFilesByConversation[conversationId]) {
        const convFocus = reg.activeFilesByConversation[conversationId];
        if (convFocus && convFocus.workspaceId === workspaceId && convFocus.activeFile) {
          activeFile = convFocus.activeFile;
        }
      }
      // If this conversation has no focused file, return null (never bleed from other convs)
      if (!activeFile) {
        return null;
      }
    } else {
      // Unscoped query (e.g. adapter fallback)
      if (reg.activeFilesByWorkspace) {
        activeFile = reg.activeFilesByWorkspace[workspaceId] || null;
      }
    }

    if (!activeFile) return null;

    // 2. Validate file still exists on disk
    if (ws.root) {
      const fullPath = path.resolve(ws.root, activeFile);
      try {
        if (!fs.existsSync(fullPath)) {
          // File removed — clean up stale reference
          if (conversationId && reg.activeFilesByConversation) {
            delete reg.activeFilesByConversation[conversationId];
          }
          if (reg.activeFilesByWorkspace && reg.activeFilesByWorkspace[workspaceId] === activeFile) {
            delete reg.activeFilesByWorkspace[workspaceId];
          }
          this.saveRegistry(reg);
          return null;
        }
      } catch {
        return null;
      }
    }

    return activeFile;
  }

  /**
   * Clear focused file state for a specific conversation.
   */
  static clearConversationFocus(conversationId) {
    if (!conversationId) return;
    const reg = this.loadRegistry();
    if (reg.activeFilesByConversation && reg.activeFilesByConversation[conversationId]) {
      delete reg.activeFilesByConversation[conversationId];
      this.saveRegistry(reg);
    }
  }
}

module.exports = WorkspaceRegistry;
