/**
 * @fileoverview P2: Production Signal Assembler & Noise Reducer
 * Collapses duplicate tool outputs, removes superseded file reads, and eliminates prompt noise.
 */

/**
 * Filter and assemble messages to maximize signal-to-noise ratio.
 */
function assembleSignal(messages) {
  if (!Array.isArray(messages) || messages.length <= 3) return messages;

  const assembled = [];
  const seenFileReads = new Map(); // file_path -> index in assembled

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Check if this message is a tool response for read_file
    if (msg.role === 'tool') {
      // Find corresponding assistant tool call
      const prevMsg = i > 0 ? messages[i - 1] : null;
      const tc = prevMsg?.tool_calls?.find((c) => c.id === msg.tool_call_id);

      if (tc && tc.function?.name === 'read_file') {
        let filePath = '';
        try {
          const args = JSON.parse(tc.function.arguments);
          filePath = args.file_path || '';
        } catch {}

        if (filePath) {
          if (seenFileReads.has(filePath)) {
            // Replace the older read_file content with a compact reference
            const prevIdx = seenFileReads.get(filePath);
            if (assembled[prevIdx]) {
              assembled[prevIdx] = {
                ...assembled[prevIdx],
                content: `[Previous content of ${filePath} superseded by latest inspection below]`,
              };
            }
          }
          seenFileReads.set(filePath, assembled.length);
        }
      }
    }

    assembled.push(msg);
  }

  return assembled;
}

module.exports = {
  assembleSignal,
};
