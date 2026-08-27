import React, { useState, useEffect, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import store from '~/store';
import { useFocusConversationId } from '~/hooks';
import {
  Folder,
  FolderOpen,
  FolderMinus,
  FileCode,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  HardDrive,
  Check,
  AlertCircle,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@librechat/client';

interface TreeFileItem {
  name: string;
  relativePath: string;
  size?: number;
}

interface TreeDirItem {
  name: string;
  relativePath: string;
}

interface TreeResponse {
  type: 'project' | 'single_file';
  workspaceId: string;
  workspaceName: string;
  workspaceRoot: string;
  targetFile?: string;
  subDir: string;
  directories: TreeDirItem[];
  files: TreeFileItem[];
  truncated: boolean;
}

function formatBytes(bytes?: number) {
  if (bytes === undefined || bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'cs':
    case 'cpp':
    case 'c':
    case 'java':
    case 'go':
    case 'rs':
      return <FileCode className="h-4 w-4 text-text-secondary flex-shrink-0" />;
    case 'md':
    case 'txt':
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'html':
    case 'css':
      return <FileText className="h-4 w-4 text-text-secondary flex-shrink-0" />;
    default:
      return <File className="h-4 w-4 text-text-secondary flex-shrink-0" />;
  }
}

export default function ProjectExplorerPanel() {
  const conversationId = useFocusConversationId(0);
  const [workspace, setWorkspace] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeCache, setTreeCache] = useState<Record<string, { directories: TreeDirItem[]; files: TreeFileItem[]; truncated?: boolean }>>({});
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [isEscalating, setIsEscalating] = useState(false);

  // Fetch initial workspace tree
  const fetchTree = useCallback(async (subDir = '') => {
    try {
      if (!subDir) setLoading(true);
      else setLoadingDirs((prev) => new Set(prev).add(subDir));

      const res = await fetch(`/api/workspaces/tree?subDir=${encodeURIComponent(subDir)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load project tree');

      if (!subDir) {
        setWorkspace(data);
        setTreeCache({
          '': {
            directories: data.directories || [],
            files: data.files || [],
            truncated: data.truncated,
          },
        });

        // Initialize active file
        if (data.type === 'single_file') {
          const singleTarget = data.targetFile || data.workspaceName;
          setActiveFile(singleTarget);
          fetch('/api/workspaces/focus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId: data.workspaceId, filePath: singleTarget, conversationId }),
          }).catch(() => {});
        } else {
          // Check conversation-scoped saved active file, then workspace-level fallback
          const savedActive = localStorage.getItem(`local_qwen_active_file_${data.workspaceId}_${conversationId}`) ||
            (conversationId === 'new' ? null : null);
          if (savedActive) {
            setActiveFile(savedActive);
            fetch('/api/workspaces/focus', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workspaceId: data.workspaceId, filePath: savedActive, conversationId }),
            }).catch(() => {});
          } else {
            // Try server-side conversation-scoped focus
            fetch(`/api/workspaces/focus?workspaceId=${data.workspaceId}&conversationId=${conversationId}`)
              .then(r => r.json())
              .then(d => { if (d.activeFile) setActiveFile(d.activeFile); })
              .catch(() => {});
          }
        }
      } else {
        setTreeCache((prev) => ({
          ...prev,
          [subDir]: {
            directories: data.directories || [],
            files: data.files || [],
            truncated: data.truncated,
          },
        }));
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error loading directory tree');
    } finally {
      if (!subDir) setLoading(false);
      else setLoadingDirs((prev) => {
        const next = new Set(prev);
        next.delete(subDir);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    fetchTree('');
  }, [fetchTree]);

  // Listen for focus events scoped to current conversation
  useEffect(() => {
    const handleFocusSync = (e: any) => {
      if (e.detail && e.detail.filePath !== undefined) {
        // Only accept events from same conversation (or unscoped for backward compat)
        if (!e.detail.conversationId || e.detail.conversationId === conversationId) {
          setActiveFile(e.detail.filePath || null);
        }
      }
    };

    window.addEventListener('local-qwen-focus-file', handleFocusSync);
    return () => {
      window.removeEventListener('local-qwen-focus-file', handleFocusSync);
    };
  }, [conversationId]);

  // Collapse all folders
  const handleCollapseAll = useCallback(() => {
    setExpandedDirs(new Set());
  }, []);

  // Toggle directory expansion
  const toggleDir = useCallback(
    async (dirPath: string) => {
      if (expandedDirs.has(dirPath)) {
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          next.delete(dirPath);
          return next;
        });
      } else {
        setExpandedDirs((prev) => new Set(prev).add(dirPath));
        if (!treeCache[dirPath]) {
          await fetchTree(dirPath);
        }
      }
    },
    [expandedDirs, treeCache, fetchTree]
  );

  // Focus a file (conversation-scoped)
  const handleSelectFile = useCallback(
    async (relativePath: string) => {
      setActiveFile(relativePath);
      if (workspace?.workspaceId) {
        localStorage.setItem(`local_qwen_active_file_${workspace.workspaceId}_${conversationId}`, relativePath);
        try {
          await fetch('/api/workspaces/focus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspaceId: workspace.workspaceId,
              filePath: relativePath,
              conversationId,
            }),
          });
          // Dispatch conversation-scoped focus event
          window.dispatchEvent(new CustomEvent('local-qwen-focus-file', {
            detail: { filePath: relativePath, conversationId },
          }));
        } catch {}
      }
    },
    [workspace?.workspaceId, conversationId]
  );

  // Escalate single-file workspace to folder
  const handleEscalate = async () => {
    if (!workspace?.workspaceId) return;
    setIsEscalating(true);
    try {
      const res = await fetch('/api/workspaces/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.workspaceId }),
      });
      if (res.ok) {
        await fetchTree('');
      }
    } catch {}
    finally {
      setIsEscalating(false);
    }
  };

  // Render recursive directory node
  const renderDirNode = (subDir: string, depth = 0) => {
    const node = treeCache[subDir];
    if (!node) return null;

    return (
      <div key={subDir} className="space-y-0.5">
        {node.directories.map((dir) => {
          const isExpanded = expandedDirs.has(dir.relativePath);
          const isLoadingThis = loadingDirs.has(dir.relativePath);

          return (
            <div key={dir.relativePath}>
              <div
                onClick={() => toggleDir(dir.relativePath)}
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
                className="group flex cursor-pointer items-center justify-between rounded-lg py-1.5 pr-2 text-xs text-text-primary transition-colors hover:bg-surface-hover select-none"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="h-4 w-4 text-text-secondary flex-shrink-0" />
                  ) : (
                    <Folder className="h-4 w-4 text-text-secondary flex-shrink-0" />
                  )}
                  <span className="truncate font-medium text-text-primary">{dir.name}</span>
                </div>
                {isLoadingThis && (
                  <RefreshCw className="h-3 w-3 animate-spin text-text-tertiary" />
                )}
              </div>

              {isExpanded && renderDirNode(dir.relativePath, depth + 1)}
            </div>
          );
        })}

        {node.files.map((file) => {
          const isFocused = activeFile === file.relativePath;

          return (
            <div
              key={file.relativePath}
              onClick={() => handleSelectFile(file.relativePath)}
              style={{ paddingLeft: `${depth * 14 + (node.directories.length > 0 ? 24 : 12)}px` }}
              className={`group flex cursor-pointer items-center justify-between rounded-lg py-1.5 pr-2.5 text-xs transition-colors select-none ${
                isFocused
                  ? 'bg-surface-active text-text-primary font-semibold border-l-2 border-border-heavy'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
              title={file.relativePath}
            >
              <div className="flex items-center gap-2 min-w-0">
                {getFileIcon(file.name)}
                <span className="truncate">{file.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {file.size !== undefined && (
                  <span className="text-[10px] font-mono text-text-tertiary">
                    {formatBytes(file.size)}
                  </span>
                )}
                {isFocused && <Check className="h-3.5 w-3.5 text-text-primary flex-shrink-0" />}
              </div>
            </div>
          );
        })}

        {node.truncated && (
          <div
            style={{ paddingLeft: `${depth * 14 + 16}px` }}
            className="py-1 text-[11px] font-mono text-text-tertiary italic"
          >
            [Listing truncated: max 500 items reached]
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-surface-primary text-text-primary overflow-hidden select-none">
      {/* Panel Top Header */}
      <div className="flex items-center justify-between border-b border-border-light px-3.5 py-2.5 bg-surface-secondary/40">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-4 w-4 text-text-secondary flex-shrink-0" />
            <span className="text-xs font-semibold truncate text-text-primary">
              {workspace?.workspaceName || 'Project Explorer'}
            </span>
          </div>
          <div className="text-[10px] font-medium text-text-tertiary truncate mt-0.5">
            Project Files {workspace?.workspaceRoot ? `• ${workspace.workspaceRoot}` : ''}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCollapseAll}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            title="Collapse All Folders"
          >
            <FolderMinus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => fetchTree('')}
            disabled={loading}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors disabled:opacity-50"
            title="Refresh Directory Tree"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Focused File Context Bar */}
      {activeFile && (
        <div className="flex items-center justify-between border-b border-border-light bg-surface-secondary/20 px-3.5 py-1.5 text-xs">
          <span className="text-[11px] text-text-tertiary uppercase tracking-wider">Focused:</span>
          <span className="font-mono text-[11px] font-medium text-text-primary truncate max-w-[200px]" title={activeFile}>
            {activeFile}
          </span>
        </div>
      )}

      {/* Single-File Workspace Notice */}
      {workspace?.type === 'single_file' && (
        <div className="m-3 rounded-xl border border-border-light bg-surface-secondary/30 p-3 space-y-2">
          <div className="text-xs font-medium text-text-primary">Single-File Workspace</div>
          <p className="text-[11px] text-text-tertiary leading-relaxed">
            Strict single-file confinement is active. Sibling files in this folder are protected and hidden from the agent.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleEscalate}
            disabled={isEscalating}
            className="w-full text-xs flex items-center justify-center gap-1.5 mt-1"
          >
            <span>Open Containing Folder</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Error View */}
      {error && (
        <div className="m-3 flex items-start gap-2 rounded-lg border border-border-destructive bg-surface-destructive-subtle p-2.5 text-xs text-text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Tree View Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading && !treeCache[''] && (
          <div className="flex h-32 items-center justify-center text-xs text-text-tertiary">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            <span>Loading files...</span>
          </div>
        )}

        {!loading && treeCache[''] && renderDirNode('')}

        {!loading && treeCache['']?.directories.length === 0 && treeCache['']?.files.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs text-text-tertiary">
            Empty directory
          </div>
        )}
      </div>
    </div>
  );
}
