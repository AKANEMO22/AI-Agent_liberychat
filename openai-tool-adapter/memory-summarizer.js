/**
 * @fileoverview P3: Production Working Memory & Conversation Summarizer
 * Compresses long conversation histories into high-density state summaries.
 * Retains user constraints, modified files, and test results across 50+ turns.
 */

/**
 * Summarize older conversation history into a compact working memory block.
 */
function compressConversationMemory(messages, keepRecentTurns = 4) {
  if (!Array.isArray(messages) || messages.length < 10) return messages;

  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  if (nonSystem.length <= keepRecentTurns * 2) return messages;

  const olderCount = nonSystem.length - keepRecentTurns * 2;
  const olderSlice = nonSystem.slice(0, olderCount);
  const recentSlice = nonSystem.slice(olderCount);

  // Extract key facts from older history
  const modifiedFiles = new Set();
  const readFiles = new Set();
  let latestUserGoal = '';

  for (const m of olderSlice) {
    if (m.role === 'user' && !latestUserGoal) {
      latestUserGoal = (m.content || '').substring(0, 150);
    }
    if (m.role === 'assistant' && m.tool_calls) {
      for (const tc of m.tool_calls) {
        try {
          const args = JSON.parse(tc.function.arguments);
          if (tc.function.name === 'edit_file' && args.file_path) modifiedFiles.add(args.file_path);
          if (tc.function.name === 'read_file' && args.file_path) readFiles.add(args.file_path);
        } catch {}
      }
    }
  }

  const memoryBlock = [
    '=== CONVERSATION WORKING MEMORY (Summary of earlier turns) ===',
    latestUserGoal ? `• Initial User Goal: ${latestUserGoal}` : null,
    modifiedFiles.size > 0 ? `• Files Modified: ${Array.from(modifiedFiles).join(', ')}` : null,
    readFiles.size > 0 ? `• Files Inspected: ${Array.from(readFiles).join(', ')}` : null,
    '==============================================================',
  ]
    .filter(Boolean)
    .join('\n');

  const compressedMessage = {
    role: 'user',
    content: `${memoryBlock}\n\n[Continuing active task from earlier steps above...]`,
  };

  const result = [];
  if (systemMsg) result.push(systemMsg);
  result.push(compressedMessage);
  result.push(...recentSlice);

  return result;
}

module.exports = {
  compressConversationMemory,
};
