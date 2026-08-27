/**
 * @fileoverview Safe Line Patch V2 Implementation & Concurrency Guard
 * Implements strict bottom-to-top line patching with SHA256 integrity verification,
 * expected_old pre-validation, atomic temporary rename, and CRLF preservation.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

/**
 * Execute Safe Line Patch V2
 * @param {string} wsDir - Root workspace path
 * @param {object} args - { file_path, expected_sha256, edits: [{ start_line, end_line, expected_old, replacement }] }
 * @returns {object} { success: boolean, error?: string, new_sha256?: string, changed_lines?: number }
 */
function executeLinePatchV2(wsDir, args) {
  const { file_path, expected_sha256, edits } = args;

  if (!file_path) {
    return { success: false, error: 'MISSING_FILE_PATH' };
  }

  let target = path.resolve(wsDir, file_path);
  if (!target.startsWith(wsDir)) {
    return { success: false, error: 'SECURITY_ERROR: Access outside workspace forbidden' };
  }

  if (!fs.existsSync(target)) {
    const alt = path.resolve(wsDir, path.basename(file_path));
    if (fs.existsSync(alt) && alt.startsWith(wsDir)) {
      target = alt;
    } else {
      return { success: false, error: 'FILE_NOT_FOUND' };
    }
  }

  const currentSha = getSha256(target);
  if (expected_sha256) {
    const cleanExpected = String(expected_sha256).trim().toUpperCase();
    if (cleanExpected !== currentSha) {
      return { success: false, error: 'STALE_FILE', expected_sha256: cleanExpected, actual_sha256: currentSha };
    }
  }

  // Normalize edits payload (supports array of edits or single top-level edit)
  let editList = [];
  if (Array.isArray(edits) && edits.length > 0) {
    editList = edits;
  } else if (args.start_line !== undefined && args.end_line !== undefined) {
    editList = [
      {
        start_line: args.start_line,
        end_line: args.end_line,
        expected_old: args.expected_old !== undefined ? args.expected_old : (args.target_content || ''),
        replacement: args.replacement !== undefined ? args.replacement : (args.replacement_content || ''),
      },
    ];
  } else if (args.target_content !== undefined && args.replacement_content !== undefined) {
    // Fallback: exact target replacement with SHA verification
    const raw = fs.readFileSync(target, 'utf8');
    const hasCRLF = raw.includes('\r\n');
    const normRaw = raw.replace(/\r\n/g, '\n');
    const normTarget = args.target_content.replace(/\r\n/g, '\n');
    const normRep = args.replacement_content.replace(/\r\n/g, '\n');

    const idx = normRaw.indexOf(normTarget);
    if (idx === -1) return { success: false, error: 'TARGET_NOT_FOUND' };
    if (normRaw.indexOf(normTarget, idx + 1) !== -1) return { success: false, error: 'AMBIGUOUS_MATCH' };

    const updatedNorm = normRaw.substring(0, idx) + normRep + normRaw.substring(idx + normTarget.length);
    const finalContent = hasCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;

    const tmp = `${target}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
    fs.writeFileSync(tmp, finalContent, 'utf8');
    fs.renameSync(tmp, target);

    return { success: true, new_sha256: getSha256(target), changed_lines: normRep.split('\n').length };
  } else {
    return { success: false, error: 'INVALID_EDIT_PAYLOAD' };
  }

  const raw = fs.readFileSync(target, 'utf8');
  const hasCRLF = raw.includes('\r\n');
  const lines = raw.split(/\r?\n/);

  // Phase 1: Validate ALL edits before modifying anything
  const validatedEdits = [];
  for (const edit of editList) {
    const start = parseInt(edit.start_line, 10);
    const end = parseInt(edit.end_line, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end > lines.length || start > end) {
      return { success: false, error: `INVALID_LINE_RANGE: [${edit.start_line}, ${edit.end_line}] for file with ${lines.length} lines` };
    }

    if (edit.expected_old !== undefined && edit.expected_old !== null) {
      const actualOldSlice = lines.slice(start - 1, end).join('\n');
      const normExpected = String(edit.expected_old).replace(/\r\n/g, '\n').trim();
      const normActual = actualOldSlice.replace(/\r\n/g, '\n').trim();

      if (normExpected && normExpected !== normActual) {
        return {
          success: false,
          error: 'EXPECTED_OLD_MISMATCH',
          start_line: start,
          end_line: end,
          expected: normExpected,
          actual: normActual,
        };
      }
    }

    validatedEdits.push({
      start_line: start,
      end_line: end,
      replacement: String(edit.replacement || ''),
    });
  }

  // Check for overlapping edit ranges
  validatedEdits.sort((a, b) => a.start_line - b.start_line);
  for (let i = 0; i < validatedEdits.length - 1; i++) {
    if (validatedEdits[i].end_line >= validatedEdits[i + 1].start_line) {
      return { success: false, error: 'OVERLAPPING_EDIT_RANGES' };
    }
  }

  // Phase 2: Apply edits BOTTOM-TO-TOP (descending by start_line)
  validatedEdits.sort((a, b) => b.start_line - a.start_line);
  let totalChangedLines = 0;

  for (const edit of validatedEdits) {
    const repLines = edit.replacement.split(/\r?\n/);
    lines.splice(edit.start_line - 1, edit.end_line - edit.start_line + 1, ...repLines);
    totalChangedLines += repLines.length;
  }

  // Phase 3: Atomic write preserving CRLF/LF
  const finalContent = lines.join(hasCRLF ? '\r\n' : '\n');
  const tmpPath = `${target}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
  fs.writeFileSync(tmpPath, finalContent, 'utf8');
  fs.renameSync(tmpPath, target);

  return {
    success: true,
    new_sha256: getSha256(target),
    changed_lines: totalChangedLines,
  };
}

module.exports = {
  getSha256,
  executeLinePatchV2,
};
