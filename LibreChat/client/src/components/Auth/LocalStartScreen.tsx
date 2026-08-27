import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, AlertCircle, AlertTriangle, Folder, FolderGit2, FileCode, Plus, X, ArrowRight, Loader2, FolderOpen, FileText, HardDrive } from 'lucide-react';
import { Button, ThemeSelector } from '@librechat/client';
import { useAuthContext } from '~/hooks/AuthContext';
import LocalExplorerModal from '~/components/Chat/Menus/LocalExplorerModal';

interface CheckItem {
  id: string;
  label: string;
  detail?: string;
  status: 'pending' | 'running' | 'success' | 'warn' | 'error';
}

interface WorkspaceItem {
  id: string;
  type?: 'project' | 'single_file';
  name: string;
  root: string;
  targetFile?: string;
  projectType: string;
  hasGit: boolean;
  isAvailable: boolean;
  lastOpened: number;
}

/**
 * 1. Start View Component (IDLE state)
 */
function StartView({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border-light bg-surface-secondary/40 p-3.5 text-center text-xs text-text-secondary">
        <span>Local Single-User Environment • Direct Filesystem Access</span>
      </div>

      <Button
        id="local-qwen-start-btn"
        variant="submit"
        size="lg"
        onClick={onStart}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-sm transition-all"
      >
        <span>Initialize Local Qwen</span>
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * 2. Bootstrap Checklist View (INITIALIZING state)
 */
function BootstrapView({ checklist }: { checklist: CheckItem[] }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border-light bg-surface-secondary/30 p-3.5 space-y-2.5">
        {checklist.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {item.status === 'pending' && <div className="h-3.5 w-3.5 rounded-full border border-border-medium" />}
              {item.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-primary" />}
              {item.status === 'success' && <Check className="h-3.5 w-3.5 text-text-success font-bold" />}
              {item.status === 'warn' && <AlertTriangle className="h-3.5 w-3.5 text-text-warning" />}
              {item.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-text-destructive" />}
              <span className={item.status === 'pending' ? 'text-text-tertiary' : 'text-text-primary'}>
                {item.label}
              </span>
            </div>
            {item.detail && (
              <span className="text-[11px] font-mono text-text-secondary">
                {item.detail}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 3. Projects View Component (PROJECTS state)
 */
function ProjectsView({
  workspaces,
  activeWs,
  showAddForm,
  setShowAddForm,
  newPath,
  setNewPath,
  newCustomName,
  setNewCustomName,
  addMode,
  setAddMode,
  addError,
  dragError,
  isAdding,
  isEntering,
  addingMode,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onNativePick,
  onOpenExplorer,
  onAddManual,
  onSelectProject,
  onRemoveProject,
}: {
  workspaces: WorkspaceItem[];
  activeWs: WorkspaceItem | undefined;
  showAddForm: boolean;
  setShowAddForm: (show: boolean) => void;
  newPath: string;
  setNewPath: (val: string) => void;
  newCustomName: string;
  setNewCustomName: (val: string) => void;
  addMode: 'folder' | 'file';
  setAddMode: (mode: 'folder' | 'file') => void;
  addError: string;
  dragError: string;
  isAdding: boolean;
  isEntering: boolean;
  addingMode: 'folder' | 'file' | null;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onNativePick: (mode: 'folder' | 'file') => void;
  onOpenExplorer: (mode: 'folder' | 'file') => void;
  onAddManual: (e: React.FormEvent) => void;
  onSelectProject: (id: string) => void;
  onRemoveProject: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Visual Desktop Drop Target */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
          isDragging
            ? 'border-border-heavy bg-surface-secondary/80 scale-[1.01]'
            : 'border-border-light bg-surface-secondary/30 hover:border-border-medium hover:bg-surface-secondary/50'
        }`}
      >
        <HardDrive className="mb-1.5 h-6 w-6 text-text-secondary" />
        <span className="text-xs font-semibold text-text-primary">
          Drop a local folder or file here
        </span>
        <span className="mt-0.5 text-[11px] text-text-tertiary">
          Direct physical filesystem access • Zero upload
        </span>

        {/* Action Buttons: Open Folder & Open File */}
        <div className="mt-3 grid w-full grid-cols-2 gap-2">
          <Button
            id="open-folder-btn"
            type="button"
            variant="secondary"
            size="default"
            disabled={isAdding}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNativePick('folder');
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border-light text-xs font-medium hover:border-border-heavy"
          >
            {isAdding && addingMode === 'folder' ? (
              <Loader2 className="h-4 w-4 animate-spin text-text-primary" />
            ) : (
              <FolderOpen className="h-4 w-4 text-text-secondary" />
            )}
            <span>Open Folder</span>
          </Button>

          <Button
            id="open-file-btn"
            type="button"
            variant="secondary"
            size="default"
            disabled={isAdding}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNativePick('file');
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border-light text-xs font-medium hover:border-border-heavy"
          >
            {isAdding && addingMode === 'file' ? (
              <Loader2 className="h-4 w-4 animate-spin text-text-primary" />
            ) : (
              <FileText className="h-4 w-4 text-text-secondary" />
            )}
            <span>Open File</span>
          </Button>
        </div>
      </div>

      {dragError && (
        <div className="rounded-lg border border-border-medium bg-surface-secondary p-2 text-center text-xs text-text-secondary">
          {dragError}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-border-light pb-2.5">
        <span className="text-xs font-medium text-text-secondary">Or choose workspace</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenExplorer('folder')}
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <Folder className="h-3 w-3" />
            Browse list
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <Plus className="h-3 w-3" />
            {showAddForm ? 'Cancel' : 'Enter path'}
          </button>
        </div>
      </div>

      {/* Inline Manual Path Entry Form */}
      {showAddForm && (
        <form onSubmit={onAddManual} className="rounded-xl border border-border-light bg-surface-secondary/60 p-3.5 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddMode('folder')}
              className={`flex-1 rounded-lg py-1 text-xs font-medium transition-colors ${
                addMode === 'folder' ? 'bg-surface-active text-text-primary' : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              Folder Project
            </button>
            <button
              type="button"
              onClick={() => setAddMode('file')}
              className={`flex-1 rounded-lg py-1 text-xs font-medium transition-colors ${
                addMode === 'file' ? 'bg-surface-active text-text-primary' : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              Single File
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary">
              {addMode === 'folder' ? 'Folder Absolute Path' : 'File Absolute Path'}
            </label>
            <input
              type="text"
              placeholder={addMode === 'folder' ? 'C:\\path\\to\\project' : 'C:\\path\\to\\file.py'}
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-2.5 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary">Display Name (Optional)</label>
            <input
              type="text"
              placeholder="My Workspace"
              value={newCustomName}
              onChange={(e) => setNewCustomName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
            />
          </div>

          {addError && (
            <div className="rounded-md border border-border-destructive bg-surface-destructive-subtle p-2 text-xs text-text-destructive">
              {addError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="submit"
              size="sm"
              disabled={isAdding}
            >
              {isAdding ? 'Opening...' : 'Open'}
            </Button>
          </div>
        </form>
      )}

      {/* Recent Workspace Quick Open Card */}
      {activeWs && !showAddForm && (
        <div className="rounded-xl border border-border-light bg-surface-secondary/30 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
              {activeWs.type === 'single_file' ? 'Recent File' : 'Recent Project'}
            </span>
            <span className="text-[11px] text-text-secondary">{activeWs.projectType}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                {activeWs.type === 'single_file' ? (
                  <FileCode className="h-4 w-4 text-text-secondary flex-shrink-0" />
                ) : activeWs.hasGit ? (
                  <FolderGit2 className="h-4 w-4 text-text-secondary flex-shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 text-text-secondary flex-shrink-0" />
                )}
                <span className="truncate">{activeWs.name}</span>
              </div>
              <div className="text-[11px] font-mono text-text-tertiary truncate">
                {activeWs.type === 'single_file' ? `${activeWs.root}\\${activeWs.targetFile || activeWs.name}` : activeWs.root}
              </div>
            </div>
            <Button
              id="open-active-project-btn"
              variant="submit"
              size="sm"
              disabled={isEntering}
              onClick={() => onSelectProject(activeWs.id)}
              className="flex-shrink-0"
            >
              {isEntering ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Opening...</span>
                </div>
              ) : (
                'Open'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* All Registered Workspaces List */}
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">All Workspaces</span>
        <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => onSelectProject(ws.id)}
              className="group flex cursor-pointer items-center justify-between rounded-lg border border-border-light bg-surface-primary px-3 py-2 transition-colors hover:bg-surface-secondary"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {ws.type === 'single_file' ? (
                    <FileCode className="h-3.5 w-3.5 text-text-secondary flex-shrink-0" />
                  ) : ws.hasGit ? (
                    <FolderGit2 className="h-3.5 w-3.5 text-text-secondary flex-shrink-0" />
                  ) : (
                    <Folder className="h-3.5 w-3.5 text-text-secondary flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium text-text-primary truncate">{ws.name}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-text-tertiary truncate">
                  {ws.projectType} • {ws.root}
                </div>
              </div>

              <div className="flex items-center gap-2 pl-2">
                <button
                  onClick={(e) => onRemoveProject(e, ws.id)}
                  className="opacity-0 group-hover:opacity-100 rounded p-1 text-text-tertiary hover:text-text-destructive transition-opacity"
                  title="Remove from list"
                >
                  <X className="h-3 w-3" />
                </button>
                <ArrowRight className="h-3.5 w-3.5 text-text-tertiary group-hover:text-text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 4. Error / Warning Action View
 */
function AlertActionView({
  stage,
  errorMessage,
  onRetry,
  onContinueLight,
}: {
  stage: 'ERROR_OLLAMA' | 'WARN_ADAPTER';
  errorMessage: string;
  onRetry: () => void;
  onContinueLight: () => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      {errorMessage && (
        <div className="rounded-lg border border-border-destructive bg-surface-destructive-subtle p-3 text-xs text-text-destructive">
          <div className="font-semibold">{stage === 'ERROR_OLLAMA' ? 'Error' : 'Notice'}</div>
          <div className="mt-0.5">{errorMessage}</div>
        </div>
      )}

      {stage === 'ERROR_OLLAMA' && (
        <Button
          variant="secondary"
          size="default"
          onClick={onRetry}
          className="w-full"
        >
          Retry
        </Button>
      )}

      {stage === 'WARN_ADAPTER' && (
        <div className="flex gap-2">
          <Button
            variant="submit"
            size="default"
            onClick={onContinueLight}
            className="flex-1"
          >
            Continue in Light
          </Button>
          <Button
            variant="secondary"
            size="default"
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Main LocalStartScreen Container Component (Shared Shell)
 */
export default function LocalStartScreen() {
  const { setUserContext } = useAuthContext();
  const navigate = useNavigate();

  const [stage, setStage] = useState<'IDLE' | 'INITIALIZING' | 'PROJECTS' | 'ERROR_OLLAMA' | 'WARN_ADAPTER'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isEntering, setIsEntering] = useState(false);

  // Project selection state
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'folder' | 'file'>('folder');
  const [newPath, setNewPath] = useState('');
  const [newCustomName, setNewCustomName] = useState('');
  const [addError, setAddError] = useState('');
  const [dragError, setDragError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addingMode, setAddingMode] = useState<'folder' | 'file' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // In-app Explorer Modal State
  const [showExplorer, setShowExplorer] = useState(false);
  const [explorerMode, setExplorerMode] = useState<'folder' | 'file'>('folder');

  const [checklist, setChecklist] = useState<CheckItem[]>([
    { id: 'ollama', label: 'Ollama service (:11434)', status: 'pending' },
    { id: 'model', label: 'Qwen 2.5 Coder 7B model', status: 'pending' },
    { id: 'gpu', label: 'GPU acceleration', status: 'pending' },
    { id: 'adapter', label: 'Agent tool adapter (:8090)', status: 'pending' },
    { id: 'mcp', label: 'Workspace tools server', status: 'pending' },
    { id: 'warmup', label: 'Model memory initialization', status: 'pending' },
    { id: 'modes', label: 'Agent modes configuration', status: 'pending' },
  ]);

  const updateCheckItem = (id: string, status: CheckItem['status'], detail?: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status, detail: detail || item.detail } : item))
    );
  };

  const fetchWorkspacesList = async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
        setSelectedWorkspaceId(data.activeWorkspaceId || data.workspaces?.[0]?.id || '');
      }
    } catch {}
  };

  useEffect(() => {
    fetchWorkspacesList();
  }, []);

  const executeBootstrapPipeline = useCallback(async (isLightFallback = false) => {
    setStage('INITIALIZING');
    setErrorMessage('');

    setChecklist([
      { id: 'ollama', label: 'Ollama service (:11434)', status: 'running' },
      { id: 'model', label: 'Qwen 2.5 Coder 7B model', status: 'pending' },
      { id: 'gpu', label: 'GPU acceleration', status: 'pending' },
      { id: 'adapter', label: 'Agent tool adapter (:8090)', status: 'pending' },
      { id: 'mcp', label: 'Workspace tools server', status: 'pending' },
      { id: 'warmup', label: 'Model memory initialization', status: 'pending' },
      { id: 'modes', label: 'Agent modes configuration', status: 'pending' },
    ]);

    try {
      // 1. Fetch Real Local Status
      updateCheckItem('ollama', 'running');
      const statusRes = await fetch('/api/auth/local-status');
      if (!statusRes.ok) throw new Error(`Status check failed: HTTP ${statusRes.status}`);
      const statusData = await statusRes.json();

      // Check Ollama
      if (!statusData.ollama?.ok) {
        updateCheckItem('ollama', 'error', statusData.ollama?.error || 'Offline');
        updateCheckItem('model', 'error', 'Aborted');
        setErrorMessage(statusData.ollama?.error || 'Ollama service is unreachable on port 11434');
        setStage('ERROR_OLLAMA');
        return;
      }
      updateCheckItem('ollama', 'success', 'Online');

      // Check Exact Model
      if (statusData.ollama.model !== 'qwen2.5-coder-local') {
        updateCheckItem('model', 'error', 'Missing');
        setErrorMessage('Required model qwen2.5-coder-local is not installed in Ollama');
        setStage('ERROR_OLLAMA');
        return;
      }
      updateCheckItem('model', 'success', 'Verified');

      // Check GPU Runtime
      updateCheckItem('gpu', 'running');
      if (statusData.gpu?.ok) {
        updateCheckItem('gpu', 'success', 'Available');
      } else {
        updateCheckItem('gpu', 'warn', 'CPU only');
      }

      // Check Adapter
      updateCheckItem('adapter', 'running');
      const adapterOk = statusData.adapter?.ok;
      if (adapterOk) {
        updateCheckItem('adapter', 'success', 'Healthy');
      } else {
        updateCheckItem('adapter', 'warn', 'Offline');
      }

      // Check MCP Tools
      updateCheckItem('mcp', 'running');
      const mcpOk = statusData.mcp?.ok;
      if (mcpOk) {
        updateCheckItem('mcp', 'success', `${statusData.mcp.toolCount || 10} tools`);
      } else {
        updateCheckItem('mcp', 'warn', 'Unavailable');
      }

      const hasAgentCapabilities = adapterOk && mcpOk;
      if (!hasAgentCapabilities && !isLightFallback) {
        updateCheckItem('modes', 'warn', 'Light mode only');
        setErrorMessage('Agent Tool Adapter or Workspace Tools Server is offline. Coding tools will be unavailable.');
        setStage('WARN_ADAPTER');
        return;
      }

      // Warmup Qwen Model
      updateCheckItem('warmup', 'running');
      try {
        const warmupRes = await fetch('/api/auth/local-warmup', { method: 'POST' });
        if (warmupRes.ok) {
          const warmupData = await warmupRes.json();
          updateCheckItem('warmup', 'success', `${warmupData.latencyMs || 0}ms`);
        } else {
          updateCheckItem('warmup', 'warn', 'Skipped');
        }
      } catch {
        updateCheckItem('warmup', 'warn', 'Skipped');
      }

      // Modes Configuration
      updateCheckItem('modes', 'success', hasAgentCapabilities ? 'Light / Medium / High' : 'Light only');

      // Fetch fresh workspace list and transition to PROJECTS screen
      await fetchWorkspacesList();
      setTimeout(() => {
        setStage('PROJECTS');
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'System initialization error');
      setStage('ERROR_OLLAMA');
    }
  }, []);

  const handleEnterAppWithWorkspace = async (workspaceId: string) => {
    setIsEntering(true);
    setErrorMessage('');
    try {
      // 1. Select active workspace on backend
      await fetch('/api/workspaces/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      // 2. Authenticate persistent Local User
      const loginRes = await fetch('/api/auth/local-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!loginRes.ok) throw new Error('Failed to start session');
      const loginData = await loginRes.json();

      sessionStorage.setItem('local_qwen_started', 'true');

      // 3. Set authenticated user context and redirect
      setUserContext({
        token: loginData.token,
        user: loginData.user,
        isAuthenticated: true,
        redirect: '/c/new',
      });
      window.location.href = '/c/new';
    } catch (err: any) {
      setIsEntering(false);
      setErrorMessage(err.message || 'Error opening workspace');
    }
  };

  const handleNativePick = async (mode: 'folder' | 'file') => {
    setIsAdding(true);
    setAddingMode(mode);
    setAddError('');
    setDragError('');
    try {
      const res = await fetch('/api/workspaces/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open native picker');

      if (data.status === 'SELECTED' && data.workspace) {
        await fetchWorkspacesList();
        await handleEnterAppWithWorkspace(data.workspace.id);
      }
    } catch (err: any) {
      setAddError(err.message || 'Error opening Windows native dialog');
    } finally {
      setIsAdding(false);
      setAddingMode(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragError('');

    const dt = e.dataTransfer;
    if (!dt || !dt.files || dt.files.length === 0) return;

    if (dt.files.length > 1) {
      setDragError('Please drop one file or folder at a time.');
      return;
    }

    const file = dt.files[0];
    const bridgePath = (window as any).desktopBridge?.getPathForFile
      ? (window as any).desktopBridge.getPathForFile(file)
      : '';
    const filePath = bridgePath || (file as any).path || '';

    if (filePath) {
      // Running in desktop shell with native absolute path access!
      setIsAdding(true);
      try {
        const isDirectory = !file.name.includes('.') || file.size === 0;
        const endpoint = isDirectory ? '/api/workspaces/add' : '/api/workspaces/add-file';
        const body = isDirectory ? { folderPath: filePath } : { filePath };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to register dropped path');

        await fetchWorkspacesList();
        await handleEnterAppWithWorkspace(data.workspace.id);
      } catch (err: any) {
        setDragError(err.message || 'Error processing dropped path');
      } finally {
        setIsAdding(false);
      }
    } else {
      // Normal browser sandbox: absolute path is concealed by browser security policy.
      // Automatically prompt the user with native Windows dialog so they choose directly from Windows Explorer!
      setDragError(`Dropped "${file.name}". Opening native Windows picker to confirm location...`);
      setTimeout(() => {
        handleNativePick(file.type ? 'file' : 'folder');
      }, 300);
    }
  };

  const handleOpenExplorer = (mode: 'folder' | 'file') => {
    setExplorerMode(mode);
    setShowExplorer(true);
  };

  const handleSelectFromExplorer = async (selectedPath: string) => {
    setIsAdding(true);
    setAddError('');
    try {
      const endpoint = explorerMode === 'folder' ? '/api/workspaces/add' : '/api/workspaces/add-file';
      const body = explorerMode === 'folder' ? { folderPath: selectedPath } : { filePath: selectedPath };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register selected path');

      await fetchWorkspacesList();
      await handleEnterAppWithWorkspace(data.workspace.id);
    } catch (err: any) {
      setAddError(err.message || 'Error opening selected path');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPath.trim()) return;

    setIsAdding(true);
    setAddError('');

    try {
      const endpoint = addMode === 'folder' ? '/api/workspaces/add' : '/api/workspaces/add-file';
      const body =
        addMode === 'folder'
          ? { folderPath: newPath.trim(), name: newCustomName.trim() || undefined }
          : { filePath: newPath.trim(), name: newCustomName.trim() || undefined };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register workspace');

      await fetchWorkspacesList();
      setShowAddForm(false);
      setNewPath('');
      setNewCustomName('');

      await handleEnterAppWithWorkspace(data.workspace.id);
    } catch (err: any) {
      setAddError(err.message || 'Failed to register workspace path');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveProject = async (e: React.MouseEvent, wsId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/workspaces/${wsId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchWorkspacesList();
      }
    } catch {}
  };

  const activeWs = workspaces.find((w) => w.id === selectedWorkspaceId) || workspaces[0];

  return (
    <div className="relative flex min-h-screen flex-col bg-surface-primary text-text-primary selection:bg-surface-active">
      {/* Theme Selector in bottom-left corner */}
      <div className="absolute bottom-4 left-4 z-20">
        <ThemeSelector />
      </div>

      <main className="flex flex-grow items-center justify-center p-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border-light bg-surface-primary p-6 shadow-theme-surface transition-all duration-200 sm:p-8">
          {/* Header Branding */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-secondary text-text-primary">
              <img src="assets/logo.svg" alt="LibreChat" className="h-7 w-7 object-contain" />
            </div>
            <h1 className="text-xl font-semibold text-text-primary">Local Qwen</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Qwen 2.5 Coder 7B running locally
            </p>
          </div>

          {/* Stage View Content */}
          {stage === 'IDLE' && <StartView onStart={() => executeBootstrapPipeline(false)} />}

          {stage === 'INITIALIZING' && <BootstrapView checklist={checklist} />}

          {stage === 'PROJECTS' && (
            <ProjectsView
              workspaces={workspaces}
              activeWs={activeWs}
              showAddForm={showAddForm}
              setShowAddForm={setShowAddForm}
              newPath={newPath}
              setNewPath={setNewPath}
              newCustomName={newCustomName}
              setNewCustomName={setNewCustomName}
              addMode={addMode}
              setAddMode={setAddMode}
              addError={addError}
              dragError={dragError}
              isAdding={isAdding}
              isEntering={isEntering}
              addingMode={addingMode}
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onNativePick={handleNativePick}
              onOpenExplorer={handleOpenExplorer}
              onAddManual={handleAddManual}
              onSelectProject={handleEnterAppWithWorkspace}
              onRemoveProject={handleRemoveProject}
            />
          )}

          {(stage === 'ERROR_OLLAMA' || stage === 'WARN_ADAPTER') && (
            <AlertActionView
              stage={stage}
              errorMessage={errorMessage}
              onRetry={() => executeBootstrapPipeline(false)}
              onContinueLight={() => executeBootstrapPipeline(true)}
            />
          )}
        </div>
      </main>

      {/* Interactive Local File & Folder Explorer Modal */}
      <LocalExplorerModal
        isOpen={showExplorer}
        onClose={() => setShowExplorer(false)}
        mode={explorerMode}
        onSelect={handleSelectFromExplorer}
      />
    </div>
  );
}
