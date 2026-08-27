/**
 * @fileoverview P1: Production Context Budget & Token Manager
 * Enforces strict GPU-resident context bounds (8K sweet spot / 12K / 16K hard ceiling).
 * Prevents VRAM spill to system RAM, ensuring generation speed remains >= 16-21 t/s.
 */

const BUDGETS = {
  INTERACTIVE: 8192,
  COMPLEX: 12288,
  HARD_CEILING: 16384,
};

/**
 * Fast calibrated token estimator for Qwen2.5 tokenizer.
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  // Non-ASCII (Vietnamese, Chinese, symbols) consume ~0.6-0.8 tokens per char
  const nonAsciiCount = (text.match(/[^\x00-\x7F]/g) || []).length;
  const asciiCount = text.length - nonAsciiCount;
  return Math.ceil(asciiCount / 3.8 + nonAsciiCount / 1.5);
}

/**
 * Estimate total tokens across an OpenAI-formatted messages array.
 */
function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  let total = 0;
  for (const m of messages) {
    total += 4; // per-message envelope overhead
    total += estimateTokens(m.content);
    if (m.tool_calls && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        total += 10;
        total += estimateTokens(tc.function?.name);
        total += estimateTokens(tc.function?.arguments);
      }
    }
  }
  return total;
}

/**
 * Enforce context budget on messages array.
 * If total tokens exceed targetBudget, compresses or trims the oldest non-system messages.
 */
function enforceContextBudget(messages, targetBudget = BUDGETS.INTERACTIVE) {
  if (!Array.isArray(messages) || messages.length <= 2) return messages;

  let currentTokens = estimateMessagesTokens(messages);
  if (currentTokens <= targetBudget) return messages;

  const result = [...messages];
  const systemMsg = result.find((m) => m.role === 'system');
  const nonSystem = result.filter((m) => m.role !== 'system');

  // Preserve the most recent 4 messages (active working context)
  const recentCount = Math.min(4, nonSystem.length);
  const recentMessages = nonSystem.slice(nonSystem.length - recentCount);
  let olderMessages = nonSystem.slice(0, nonSystem.length - recentCount);

  // Trim or truncate older messages from the beginning of history until within budget
  while (olderMessages.length > 0) {
    const candidateTokens =
      (systemMsg ? estimateTokens(systemMsg.content) + 4 : 0) +
      estimateMessagesTokens(olderMessages) +
      estimateMessagesTokens(recentMessages);

    if (candidateTokens <= targetBudget) break;

    // Drop the oldest message
    olderMessages.shift();
  }

  const finalMessages = [];
  if (systemMsg) finalMessages.push(systemMsg);
  finalMessages.push(...olderMessages);
  finalMessages.push(...recentMessages);

  return finalMessages;
}

module.exports = {
  BUDGETS,
  estimateTokens,
  estimateMessagesTokens,
  enforceContextBudget,
};
