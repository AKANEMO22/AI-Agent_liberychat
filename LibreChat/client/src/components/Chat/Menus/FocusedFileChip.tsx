import React, { useState, useEffect } from 'react';
import { useFocusConversationId } from '~/hooks';
import { FileCode, FileText, File, X } from 'lucide-react';

export default function FocusedFileChip() {
  const conversationId = useFocusConversationId(0);
  const [focusedFile, setFocusedFile] = useState<string | null>(null);

  const syncFocus = async () => {
    try {
      const res = await fetch(`/api/workspaces/focus?conversationId=${encodeURIComponent(conversationId)}`);
      if (res.ok) {
        const data = await res.json();
        setFocusedFile(data.activeFile || null);
      }
    } catch {}
  };

  useEffect(() => {
    syncFocus();

    const handleFocusEvent = (e: any) => {
      // Only accept events from same conversation (or unscoped for backward compat)
      if (!e.detail?.conversationId || e.detail.conversationId === conversationId) {
        setFocusedFile(e.detail?.filePath || null);
      }
    };

    window.addEventListener('local-qwen-focus-file', handleFocusEvent);
    return () => {
      window.removeEventListener('local-qwen-focus-file', handleFocusEvent);
    };
  }, [conversationId]);

  if (!focusedFile) return null;

  const fileName = focusedFile.split(/[\/\\]/).pop() || focusedFile;

  const clearFocus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/workspaces/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: '', conversationId }),
      });
      setFocusedFile(null);
      window.dispatchEvent(new CustomEvent('local-qwen-focus-file', {
        detail: { filePath: null, conversationId },
      }));
    } catch {}
  };

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-light bg-surface-secondary/70 px-2 py-1 text-xs text-text-primary shadow-xs transition-colors hover:bg-surface-secondary select-none"
      title={`Focused file: ${focusedFile} (Natural references like 'file này' resolve to this file)`}
    >
      <FileCode className="h-3.5 w-3.5 text-text-secondary flex-shrink-0" />
      <span className="font-mono text-[11px] font-medium truncate max-w-[140px] md:max-w-[200px]">
        {fileName}
      </span>
      <span className="text-[9px] font-semibold text-text-tertiary uppercase bg-surface-tertiary px-1 py-0.5 rounded">
        FILE
      </span>
      <button
        type="button"
        onClick={clearFocus}
        className="rounded p-0.5 text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition-colors ml-0.5"
        title="Clear file focus"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

