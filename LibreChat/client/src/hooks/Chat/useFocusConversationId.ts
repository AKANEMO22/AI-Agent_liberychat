import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import store from '~/store';

/**
 * Returns a stable, conversation-scoped or tab-scoped draft identity.
 * 
 * Rules:
 * 1. If conversation is permanent (rawConversationId !== 'new' && rawConversationId != null),
 *    return the permanent conversation ID.
 * 2. If at /c/new or draft, return a tab-isolated draft ID stored in sessionStorage.
 *    This guarantees that two simultaneous new-chat tabs on the same workspace never collide.
 * 3. When rawConversationId transitions from 'new' to a permanent UUID, migrates the focused file
 *    from draft ID to the permanent ID on both client and server (POST /api/workspaces/focus).
 */
export function useFocusConversationId(index = 0): string {
  const rawConversationId = useRecoilValue(store.conversationIdByIndex(index));
  const prevConvoRef = useRef<string | null>(rawConversationId);

  // Get or create tab-unique draft ID for new chat sessions
  const getDraftId = () => {
    let draftId = sessionStorage.getItem('local_qwen_draft_focus_id');
    if (!draftId) {
      draftId = `draft_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('local_qwen_draft_focus_id', draftId);
    }
    return draftId;
  };

  const effectiveId = (rawConversationId && rawConversationId !== 'new')
    ? rawConversationId
    : getDraftId();

  // Migration Effect: when transitioning from 'new'/draft to permanent conversationId
  useEffect(() => {
    const prev = prevConvoRef.current;
    const current = rawConversationId;
    prevConvoRef.current = current;

    if (current && current !== 'new' && (!prev || prev === 'new')) {
      const draftId = sessionStorage.getItem('local_qwen_draft_focus_id');
      if (draftId) {
        // Query server focus for draftId and migrate
        fetch(`/api/workspaces/focus?conversationId=${encodeURIComponent(draftId)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data && data.activeFile) {
              // Migrate server-side focus to permanent conversationId
              fetch('/api/workspaces/focus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filePath: data.activeFile,
                  conversationId: current,
                }),
              }).catch(() => {});

              // Dispatch focus event under permanent conversationId
              window.dispatchEvent(
                new CustomEvent('local-qwen-focus-file', {
                  detail: { filePath: data.activeFile, conversationId: current },
                })
              );
            }
          })
          .catch(() => {})
          .finally(() => {
            sessionStorage.removeItem('local_qwen_draft_focus_id');
          });
      }
    }
  }, [rawConversationId]);

  return effectiveId;
}

export default useFocusConversationId;
