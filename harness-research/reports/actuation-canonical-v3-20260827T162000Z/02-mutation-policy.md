# 02 — WORKSPACE MUTATION & CLEANLINESS POLICY
## Phase R15.3 & R15.4: Authoritative File Modification Invariants

### 1. Classification Hierarchy
- **SOURCE MUTATION**: Modification to application source files (`*.py`, `*.json`, `*.txt`). Counted strictly towards `clean_audit` and `TASK_MUTATION_PRECISION`.
- **TEST ARTIFACT / CACHE**: Ephemeral runtime files (`__pycache__/`, `.pytest_cache/`, `*.pyc`). Excluded by policy from `snapshotDir` to prevent false dirty flags.
- **BENCHMARK FIXTURE FILE**: Initialized strictly prior to `beforeSnapshot`.

### 2. Explicit Allowed Change Manifest
| Task ID | Focused File | Target File | Allowed Modified Manifest | Forbidden Modifications |
|---|---|---|---|---|
| **M1_EXACT_FILE** | None | `calculator.py` | `["calculator.py"]` | All other files |
| **M2_DISCOVER_FILE** | None | `discount_engine.py` | `["discount_engine.py"]` | `tests/*`, `calculator.py` |
| **M3_NESTED_FILE** | None | `nested/formatter.py` | `["nested/formatter.py"]` | All other files |
| **M4_OVERWRITE_PROOF** | None | `overwrite-test.txt` | `["overwrite-test.txt"]` | All other files |
| **M5_SMALL_PATCH** | None | `calculator.py` | `["calculator.py"]` | All other files |
| **M6_PRESERVE_SENTINELS** | None | `calculator.py` | `["calculator.py"]` | `tests/*` |
| **M7_LINE_ENDINGS** | None | `calculator.py` | `["calculator.py"]` | All other files |
| **M8_DISTRACTOR_FILES** | None | `calculator.py` | `["calculator.py"]` | `calculator_backup.py`, `calculator_old.py` |
| **M9_DISAMBIGUATION** | None | `module_b.py` | `["module_b.py"]` | `module_a.py`, `module_c.py` |
| **M10_RETRY_RECOVERY** | None | `discount_engine.py` | `["discount_engine.py"]` | `tests/*` |
| **M11_CONSTRAINT_RETENTION** | None | `calculator.py` | `["calculator.py"]` | `public_api.py` |
| **M12_FOCUSED_FILE** | `calculator.py` | `calculator.py` | `["calculator.py"]` | All other files |
| **M13_EXPLICIT_OVERRIDES_FOCUS** | `calculator.py` | `discount_engine.py` | `["discount_engine.py"]` | `calculator.py` |
| **M14_STALE_CONTENT_SAFETY** | None | `calculator.py` | `["calculator.py"]` | All other files |
