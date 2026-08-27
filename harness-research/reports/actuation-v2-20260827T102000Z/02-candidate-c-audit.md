# 02 — CANDIDATE C ARCHITECTURAL & EMPIRICAL AUDIT
## Investigation into Old Line Range vs Safe Line Patch V2

### 1. Root Cause of "Line Drift" Vulnerability in Candidate C1
- In Phase 9 Candidate C (`replace_lines`), line replacement took raw line bounds `[start_line, end_line]` without verifying:
  1. `expected_sha256` concurrency token (was optional and not enforced).
  2. `expected_old` text pre-validation (if line numbering shifted due to earlier edits, arbitrary lines were replaced).
  3. Top-to-bottom replacement order caused all subsequent line indices to shift if replacement line count differed from original line count.

### 2. Line Patch V2 Architectural Invariants
`LINE_PATCH_V2` resolves all three vulnerabilities:
- **Strict SHA256 concurrency token**: Returns `STALE_FILE` if file changed on disk.
- **Expected Old Pre-Validation**: Every line in `[start_line, end_line]` is validated before any mutation occurs.
- **Bottom-to-Top Ordering**: Edits are sorted descending by `start_line` so earlier edit lengths never invalidate later indices.
- **Atomic Writes**: Temp file write + atomic rename prevents half-written files.
