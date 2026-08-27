import React, { useState, useEffect } from 'react';
import { Folder, FolderGit2, FileCode, ArrowUp, X, RefreshCw, HardDrive, Check, ExternalLink } from 'lucide-react';
import { Button } from '@librechat/client';

interface LocalExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'folder' | 'file';
  onSelect: (selectedPath: string) => void;
}

interface DirEntry {
  name: string;
  path: string;
}

interface FileEntry {
  name: string;
  path: string;
  size: number;
}

export default function LocalExplorerModal({ isOpen, onClose, mode, onSelect }: LocalExplorerModalProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [inputPath, setInputPath] = useState<string>('');
  const [directories, setDirectories] = useState<DirEntry[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBrowse = async (target?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath: target, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to browse path');

      setCurrentPath(data.currentPath);
      setInputPath(data.currentPath);
      setParentPath(data.parentPath);
      setDirectories(data.directories || []);
      setFiles(data.files || []);
      setSelectedFilePath(null);
    } catch (err: any) {
      setError(err.message || 'Could not access directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBrowse(currentPath || undefined);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleNavigate = (path: string) => {
    fetchBrowse(path);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPath.trim()) {
      fetchBrowse(inputPath.trim());
    }
  };

  const handleConfirm = () => {
    if (mode === 'folder') {
      if (currentPath) {
        onSelect(currentPath);
        onClose();
      }
    } else {
      if (selectedFilePath) {
        onSelect(selectedFilePath);
        onClose();
      }
    }
  };

  const handleNativePicker = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, initialDir: currentPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Native picker error');

      if (data.status === 'SELECTED' && data.workspace) {
        onSelect(data.selectedPath);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Native picker unavailable, please select from list');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-xl max-h-[85vh] rounded-2xl border border-border-light bg-surface-primary shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-5 py-3.5">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">
              {mode === 'folder' ? 'Open Workspace Folder' : 'Open Workspace File'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Path Navigation Bar */}
        <div className="border-b border-border-light bg-surface-secondary/40 p-3">
          <form onSubmit={handleInputSubmit} className="flex gap-1.5 items-center">
            <button
              type="button"
              onClick={() => parentPath && handleNavigate(parentPath)}
              disabled={!parentPath || loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light bg-surface-primary text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40 transition-colors"
              title="Go to Parent Folder"
            >
              <ArrowUp className="h-4 w-4" />
            </button>

            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              placeholder="C:\path\to\folder"
              className="flex-1 h-8 rounded-lg border border-border-light bg-surface-primary px-2.5 text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
            />

            <Button type="submit" variant="secondary" size="sm" disabled={loading} className="h-8 px-3 text-xs">
              Go
            </Button>

            <button
              type="button"
              onClick={() => fetchBrowse(currentPath)}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light bg-surface-primary text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </form>

          {/* Quick shortcuts */}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span className="text-text-tertiary self-center mr-1">Quick:</span>
            <button
              type="button"
              onClick={() => fetchBrowse('C:\\Users\\hachimi\\Downloads\\model train local')}
              className="rounded-md border border-border-light bg-surface-primary px-2 py-0.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              Workspace Root
            </button>
            <button
              type="button"
              onClick={() => fetchBrowse('C:\\Users\\hachimi\\Downloads')}
              className="rounded-md border border-border-light bg-surface-primary px-2 py-0.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              Downloads
            </button>
            <button
              type="button"
              onClick={() => fetchBrowse('C:\\Users\\hachimi\\Desktop')}
              className="rounded-md border border-border-light bg-surface-primary px-2 py-0.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => fetchBrowse('C:\\')}
              className="rounded-md border border-border-light bg-surface-primary px-2 py-0.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              C:\
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-4 mt-3 rounded-lg border border-border-destructive bg-surface-destructive-subtle p-2.5 text-xs text-text-destructive">
            {error}
          </div>
        )}

        {/* Directory & Files List */}
        <div className="flex-1 min-h-[260px] max-h-[360px] overflow-y-auto p-2 space-y-0.5 select-none">
          {directories.length === 0 && files.length === 0 && !loading && (
            <div className="flex h-40 items-center justify-center text-xs text-text-tertiary">
              No accessible items found in this directory
            </div>
          )}

          {/* Subdirectories */}
          {directories.map((dir) => (
            <div
              key={dir.path}
              onClick={() => handleNavigate(dir.path)}
              className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-secondary transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Folder className="h-4 w-4 text-text-secondary flex-shrink-0" />
                <span className="truncate font-medium">{dir.name}</span>
              </div>
              <span className="text-[11px] text-text-tertiary">Folder</span>
            </div>
          ))}

          {/* Files (when in file mode) */}
          {mode === 'file' &&
            files.map((file) => {
              const isSelected = selectedFilePath === file.path;
              return (
                <div
                  key={file.path}
                  onClick={() => setSelectedFilePath(file.path)}
                  onDoubleClick={() => {
                    onSelect(file.path);
                    onClose();
                  }}
                  className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? 'bg-surface-active text-text-primary font-medium'
                      : 'text-text-primary hover:bg-surface-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="h-4 w-4 text-text-secondary flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-text-primary ml-1" />}
                  </div>
                  <span className="text-[11px] font-mono text-text-tertiary">{formatSize(file.size)}</span>
                </div>
              );
            })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border-light bg-surface-secondary/30 px-4 py-3">
          <button
            type="button"
            onClick={handleNativePicker}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            title="Open Windows OS File Explorer Dialog"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Windows Native Dialog</span>
          </button>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>

            <Button
              id="confirm-select-btn"
              variant="submit"
              size="sm"
              onClick={handleConfirm}
              disabled={loading || (mode === 'file' && !selectedFilePath)}
            >
              {mode === 'folder' ? 'Select This Folder' : 'Select This File'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
