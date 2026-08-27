import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FolderGit2, FileCode, ChevronDown, Plus, X, Check, FolderOpen, FileText, ArrowUpRight } from 'lucide-react';
import { Button } from '@librechat/client';
import LocalExplorerModal from './LocalExplorerModal';

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

export default function ProjectSelector() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'folder' | 'file'>('folder');
  const [newPath, setNewPath] = useState('');
  const [newCustomName, setNewCustomName] = useState('');
  const [addError, setAddError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [switchConfirmId, setSwitchConfirmId] = useState<string | null>(null);

  // In-app Explorer Modal State
  const [showExplorer, setShowExplorer] = useState(false);
  const [explorerMode, setExplorerMode] = useState<'folder' | 'file'>('folder');

  const menuRef = useRef<HTMLDivElement>(null);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
        setActiveWorkspaceId(data.activeWorkspaceId || '');
      }
    } catch {}
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSwitchConfirmId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const handleSelectWorkspace = (wsId: string) => {
    if (wsId === activeWorkspaceId) {
      setIsOpen(false);
      return;
    }
    setSwitchConfirmId(wsId);
  };

  const confirmSwitch = async (wsId: string) => {
    try {
      const res = await fetch('/api/workspaces/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: wsId }),
      });
      if (res.ok) {
        setActiveWorkspaceId(wsId);
        setIsOpen(false);
        setSwitchConfirmId(null);
        navigate('/c/new', { replace: true });
        window.location.reload();
      }
    } catch {}
  };

  const handleNativePick = async (mode: 'folder' | 'file') => {
    setIsSubmitting(true);
    setAddError('');
    try {
      const res = await fetch('/api/workspaces/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open native picker');

      if (data.status === 'SELECTED' && data.workspace) {
        await fetchWorkspaces();
        setActiveWorkspaceId(data.workspace.id);
        setIsOpen(false);
        navigate('/c/new', { replace: true });
        window.location.reload();
      }
    } catch (err: any) {
      setAddError(err.message || 'Error opening native picker');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenExplorer = (mode: 'folder' | 'file') => {
    setExplorerMode(mode);
    setShowExplorer(true);
    setIsOpen(false);
  };

  const handleSelectFromExplorer = async (selectedPath: string) => {
    setIsSubmitting(true);
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

      await fetchWorkspaces();
      setActiveWorkspaceId(data.workspace.id);
      navigate('/c/new', { replace: true });
      window.location.reload();
    } catch (err: any) {
      setAddError(err.message || 'Error opening selected path');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalateToProject = async () => {
    if (!activeWs || activeWs.type !== 'single_file') return;
    try {
      const res = await fetch('/api/workspaces/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: activeWs.id }),
      });
      const data = await res.json();
      if (res.ok && data.workspace) {
        await fetchWorkspaces();
        setActiveWorkspaceId(data.workspace.id);
        setIsOpen(false);
        navigate('/c/new', { replace: true });
        window.location.reload();
      }
    } catch {}
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPath.trim()) return;

    setIsSubmitting(true);
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
      if (!res.ok) throw new Error(data.error || 'Failed to add workspace');

      await fetchWorkspaces();
      setShowAddModal(false);
      setNewPath('');
      setNewCustomName('');
      setIsOpen(false);

      navigate('/c/new', { replace: true });
      window.location.reload();
    } catch (err: any) {
      setAddError(err.message || 'Error registering workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Header Project / File Trigger Button */}
      <button
        id="project-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="my-1 flex h-9 max-w-full items-center gap-1.5 rounded-xl border border-border-light bg-presentation px-3 py-2 text-sm text-text-primary hover:bg-surface-active-alt focus-visible:outline-none transition-colors"
        title={activeWs?.type === 'single_file' ? `Single File: ${activeWs.name}` : `Project: ${activeWs?.name || 'Workspace'}`}
      >
        {activeWs?.type === 'single_file' ? (
          <FileCode className="h-4 w-4 text-text-secondary flex-shrink-0" />
        ) : activeWs?.hasGit ? (
          <FolderGit2 className="h-4 w-4 text-text-secondary flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-text-secondary flex-shrink-0" />
        )}
        <span className="max-w-[140px] truncate text-left font-medium">
          {activeWs?.name || 'Workspace'}
        </span>
        {activeWs?.type === 'single_file' && (
          <span className="rounded bg-surface-secondary px-1 text-[10px] text-text-secondary font-mono">
            FILE
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1 w-80 origin-top-left rounded-xl border border-border-light bg-surface-primary p-2 shadow-theme-surface z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-border-light px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            <span>Workspaces & Files</span>
            <span>{workspaces.length}</span>
          </div>

          {/* Quick Actions: Open Folder & Open File */}
          <div className="my-1.5 grid grid-cols-2 gap-1.5 border-b border-border-light pb-2">
            <button
              onClick={() => handleNativePick('folder')}
              className="flex items-center justify-center gap-1 rounded-lg border border-border-light bg-surface-secondary px-2 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5 text-text-secondary" />
              <span>Open Folder...</span>
            </button>
            <button
              onClick={() => handleNativePick('file')}
              className="flex items-center justify-center gap-1 rounded-lg border border-border-light bg-surface-secondary px-2 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-text-secondary" />
              <span>Open File...</span>
            </button>
          </div>

          {/* User Escalation Option if currently on a single file */}
          {activeWs?.type === 'single_file' && (
            <div className="mb-1.5 rounded-lg border border-border-light bg-surface-secondary/40 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-secondary truncate">Containing folder: {activeWs.root}</span>
              </div>
              <button
                onClick={handleEscalateToProject}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md bg-surface-secondary py-1 text-[11px] font-medium text-text-primary hover:bg-surface-hover transition-colors"
              >
                <ArrowUpRight className="h-3 w-3" />
                <span>Open Folder as Project</span>
              </button>
            </div>
          )}

          {/* Registered Workspaces List */}
          <div className="my-1 max-h-52 space-y-1 overflow-y-auto pr-1">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              const isConfirming = switchConfirmId === ws.id;

              return (
                <div key={ws.id} className="rounded-lg">
                  {!isConfirming ? (
                    <button
                      onClick={() => handleSelectWorkspace(ws.id)}
                      className={`flex w-full items-start justify-between gap-2 rounded-lg p-2 text-left transition-colors ${
                        isActive
                          ? 'bg-surface-secondary text-text-primary'
                          : 'hover:bg-surface-hover text-text-primary'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          {ws.type === 'single_file' ? (
                            <FileCode className="h-3.5 w-3.5 text-text-secondary flex-shrink-0" />
                          ) : ws.hasGit ? (
                            <FolderGit2 className="h-3.5 w-3.5 text-text-secondary flex-shrink-0" />
                          ) : (
                            <Folder className="h-3.5 w-3.5 text-text-secondary flex-shrink-0" />
                          )}
                          <span className="truncate">{ws.name}</span>
                          {ws.type === 'single_file' && (
                            <span className="rounded bg-surface-active px-1 text-[9px] text-text-tertiary">
                              FILE
                            </span>
                          )}
                          {isActive && (
                            <Check className="h-3 w-3 text-text-primary ml-auto flex-shrink-0" />
                          )}
                        </div>
                        <div className="mt-0.5 text-[10px] text-text-tertiary truncate">
                          {ws.projectType}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-lg border border-border-medium bg-surface-secondary p-2.5 text-xs">
                      <p className="text-xs font-medium text-text-primary">
                        Switching to <strong>{ws.name}</strong> will start a new conversation.
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <Button
                          variant="submit"
                          size="sm"
                          onClick={() => confirmSwitch(ws.id)}
                          className="flex-1"
                        >
                          Switch
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSwitchConfirmId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-border-light pt-1.5">
            <button
              onClick={() => {
                setShowAddModal(true);
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-light bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Enter Path Manually</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Path Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-light bg-surface-primary p-6 shadow-theme-surface">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary">Open Workspace</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-text-tertiary hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              Enter a real Windows filesystem path for direct local access.
            </p>

            <form onSubmit={handleAddManual} className="mt-4 space-y-3">
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
                  {addMode === 'folder' ? 'Folder Path (Absolute)' : 'File Path (Absolute)'}
                </label>
                <input
                  type="text"
                  placeholder={addMode === 'folder' ? 'C:\\path\\to\\project' : 'C:\\path\\to\\file.py'}
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="My Workspace"
                  value={newCustomName}
                  onChange={(e) => setNewCustomName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
                />
              </div>

              {addError && (
                <div className="rounded-lg border border-border-destructive bg-surface-destructive-subtle p-2.5 text-xs text-text-destructive">
                  {addError}
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="submit"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Opening...' : 'Open'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Local File & Folder Explorer Modal */}
      <LocalExplorerModal
        isOpen={showExplorer}
        onClose={() => setShowExplorer(false)}
        mode={explorerMode}
        onSelect={handleSelectFromExplorer}
      />
    </div>
  );
}
