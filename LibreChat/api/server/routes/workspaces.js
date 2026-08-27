/**
 * @fileoverview Express routes for Workspace / Project UX
 * Local-only endpoints for managing, selecting, picking, and browsing direct local workspaces and files.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const WorkspaceRegistry = require('../services/WorkspaceRegistry');

const router = express.Router();

function isLocalRequest(req) {
  const host = req.headers.host || '';
  const clientIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
  return (
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp === '::ffff:127.0.0.1' ||
    clientIp === 'localhost' ||
    clientIp.endsWith('127.0.0.1') ||
    clientIp.includes('127.0.0.1')
  );
}

// Middleware to enforce local-only access
router.use((req, res, next) => {
  if (!isLocalRequest(req)) {
    return res.status(403).json({ message: 'Forbidden: Workspace operations are restricted to localhost' });
  }
  next();
});

// GET /api/workspaces - List all registered workspaces + active workspace
router.get('/', (req, res) => {
  try {
    const data = WorkspaceRegistry.listWorkspaces();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/select - Select active workspace
router.post('/select', (req, res) => {
  const { workspaceId } = req.body || {};
  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing required field: workspaceId' });
  }

  try {
    const activeWs = WorkspaceRegistry.setActiveWorkspace(workspaceId);
    return res.status(200).json({ status: 'SELECTED', activeWorkspace: activeWs });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Alias for /select
router.post('/active', (req, res) => {
  const { workspaceId } = req.body || {};
  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing required field: workspaceId' });
  }

  try {
    const activeWs = WorkspaceRegistry.setActiveWorkspace(workspaceId);
    return res.status(200).json({ status: 'SELECTED', activeWorkspace: activeWs });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/workspaces/add - Validate and register a new local folder project
router.post('/add', (req, res) => {
  const { folderPath, name } = req.body || {};
  if (!folderPath) {
    return res.status(400).json({ error: 'Missing required field: folderPath' });
  }

  try {
    const addedWs = WorkspaceRegistry.addWorkspace(folderPath, name);
    return res.status(201).json({ status: 'REGISTERED', workspace: addedWs });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/workspaces/add-file - Validate and register a direct single-file workspace
router.post('/add-file', (req, res) => {
  const { filePath, name } = req.body || {};
  if (!filePath) {
    return res.status(400).json({ error: 'Missing required field: filePath' });
  }

  try {
    const addedWs = WorkspaceRegistry.addSingleFileWorkspace(filePath, name);
    return res.status(201).json({ status: 'REGISTERED', workspace: addedWs });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/workspaces/pick - Invoke fixed server-side native Windows picker asynchronously
router.post('/pick', async (req, res) => {
  const { mode = 'folder', initialDir = '' } = req.body || {};
  if (mode !== 'folder' && mode !== 'file') {
    return res.status(400).json({ error: "Invalid mode. Must be 'folder' or 'file'." });
  }

  // Create AbortController for true client connection drops only
  const ac = new AbortController();
  req.on('aborted', () => {
    ac.abort();
  });

  try {
    const selectedPath = await WorkspaceRegistry.pickNativePathAsync(mode, initialDir, ac.signal);
    if (!selectedPath) {
      return res.status(200).json({ status: 'CANCELLED', selectedPath: null });
    }

    let workspace;
    if (mode === 'folder') {
      workspace = WorkspaceRegistry.addWorkspace(selectedPath);
    } else {
      workspace = WorkspaceRegistry.addSingleFileWorkspace(selectedPath);
    }

    return res.status(200).json({
      status: 'SELECTED',
      mode,
      selectedPath,
      workspace,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/workspaces/escalate - Escalate single file workspace to containing folder project
router.post('/escalate', (req, res) => {
  const { workspaceId } = req.body || {};
  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing required field: workspaceId' });
  }

  try {
    const escalated = WorkspaceRegistry.escalateSingleFileToProject(workspaceId);
    return res.status(200).json({ status: 'ESCALATED', workspace: escalated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/workspaces/browse - Safe directory & file explorer for web UI modals
router.post('/browse', (req, res) => {
  const { targetPath, mode = 'folder' } = req.body || {};
  const sysDrive = process.env.SystemDrive || 'C:';
  const userHome = process.env.USERPROFILE || path.join(sysDrive, 'Users');

  let currentDir = targetPath ? path.resolve(targetPath) : userHome;

  try {
    if (!fs.existsSync(currentDir)) {
      currentDir = userHome;
    }

    const stat = fs.statSync(currentDir);
    if (!stat.isDirectory()) {
      currentDir = path.dirname(currentDir);
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const directories = [];
    const files = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('$')) continue;
      const fullPath = path.join(currentDir, entry.name);

      try {
        if (entry.isDirectory()) {
          fs.accessSync(fullPath, fs.constants.R_OK);
          directories.push({
            name: entry.name,
            path: fullPath,
          });
        } else if (entry.isFile() && mode === 'file') {
          fs.accessSync(fullPath, fs.constants.R_OK);
          files.push({
            name: entry.name,
            path: fullPath,
            size: fs.statSync(fullPath).size,
          });
        }
      } catch {}
    }

    const parent = path.dirname(currentDir);
    const hasParent = parent !== currentDir;

    return res.status(200).json({
      currentPath: currentDir,
      parentPath: hasParent ? parent : null,
      directories: directories.slice(0, 100),
      files: files.slice(0, 100),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/tree - Lazily fetch direct children of active workspace subfolder
router.get('/tree', (req, res) => {
  const { subDir = '' } = req.query || {};
  try {
    const tree = WorkspaceRegistry.getWorkspaceTree(subDir);
    return res.status(200).json(tree);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/workspaces/focus - Set focused file for current or specified workspace (conversation-scoped)
router.post('/focus', (req, res) => {
  const { workspaceId, filePath, conversationId } = req.body || {};
  try {
    const focused = WorkspaceRegistry.setActiveFile(workspaceId, filePath, conversationId);
    return res.status(200).json({ status: 'FOCUSED', activeFile: focused, conversationId: conversationId || null });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/workspaces/focus - Get focused file for active workspace (conversation-scoped)
router.get('/focus', (req, res) => {
  const { workspaceId, conversationId } = req.query || {};
  try {
    const activeFile = WorkspaceRegistry.getActiveFile(workspaceId, conversationId);
    return res.status(200).json({ activeFile, conversationId: conversationId || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workspaces/:id - Remove project or file from registry only (NEVER deletes real files)
router.delete('/:id', (req, res) => {
  const workspaceId = req.params.id;
  try {
    const result = WorkspaceRegistry.removeWorkspace(workspaceId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
