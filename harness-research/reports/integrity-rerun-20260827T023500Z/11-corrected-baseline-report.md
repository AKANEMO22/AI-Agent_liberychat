# 11 — CORRECTED REAL FILE MUTATION REPORT (RIGOROUS AUDIT)
## Qwen2.5-Coder-7B-Instruct GGUF · RTX 4050 Laptop (6 GB VRAM)

**Run ID**: `20260827T023500Z`  
**Isolation**: Disposable per-trial workspace copies with baseline SHA256 manifest check  
**Integrity Status**: `SELF_CONSISTENT_VERIFIED` (100% computed from raw data)

---

## 1. Authoritative Summary Metrics

| Metric | Measured Value (Counts) | Target | Status |
|---|---|---|---|
| **REAL_FILE_EDIT_SUCCESS_RATE** | **4/14 = 28.6%** | 100% | ⚠️ PARTIAL |
| **TEST_PASS_RATE** | **0/8 = 0.0%** | ≥90% | ⚠️ PARTIAL |
| **UNEXPECTED_MUTATION_RATE** | **0/15 = 0.0%** | 0% | ✅ PASS |
| **OVERALL_TASK_SUCCESS_RATE** | **3/15 = 20.0%** | ≥80% | ⚠️ NEEDS ATTENTION |

---

## 2. Full Trial Matrix (M1 – M15)

| Task ID | Target Files | Actual Mutated Files | Disk Write | Test Result | Clean Audit | Overall Verdict |
|---|---|---|---|---|---|---|
| **M1_EXACT_FILE** | `calculator.py` | `none` | ❌ FAIL | ❌ FAIL | ✅ CLEAN | **FAIL** |
| **M2_DISCOVER_FILE** | `discount_engine.py` | `discount_engine.py` | ✅ PASS | ❌ FAIL | ✅ CLEAN | **FAIL** |
| **M3_NESTED_FILE** | `nested/formatter.py` | `none` | ❌ FAIL | ❌ FAIL | ✅ CLEAN | **FAIL** |
| **M4_OVERWRITE_PROOF** | `overwrite-test.txt` | `none` | ❌ FAIL | N/A | ✅ CLEAN | **FAIL** |
| **M5_SMALL_PATCH** | `calculator.py` | `none` | ❌ FAIL | N/A | ✅ CLEAN | **FAIL** |
| **M6_PRESERVE_SENTINELS** | `calculator.py` | `calculator.py` | ✅ PASS | N/A | ✅ CLEAN | **PASS** |
| **M7_LINE_ENDINGS** | `calculator.py` | `none` | ❌ FAIL | N/A | ✅ CLEAN | **FAIL** |
| **M8_DISTRACTOR_FILES** | `calculator.py` | `none` | ❌ FAIL | ❌ FAIL | ✅ CLEAN | **FAIL** |
| **M9_DISAMBIGUATION** | `module_b.py` | `none` | ❌ FAIL | ❌ FAIL | ✅ CLEAN | **FAIL** |
| **M10_RETRY_RECOVERY** | `discount_engine.py` | `discount_engine.py` | ✅ PASS | ❌ FAIL | ✅ CLEAN | **FAIL** |
| **M11_CONSTRAINT_RETENTION** | `calculator.py` | `none` | ❌ FAIL | ❌ FAIL | ✅ CLEAN | **FAIL** |
| **M12_FOCUSED_FILE** | `calculator.py` | `none` | ❌ FAIL | ❌ FAIL | ✅ CLEAN | **FAIL** |
| **M13_EXPLICIT_OVERRIDES_FOCUS** | `discount_engine.py` | `discount_engine.py` | ✅ PASS | N/A | ✅ CLEAN | **PASS** |
| **M14_STALE_CONTENT_SAFETY** | `calculator.py` | `none` | ❌ FAIL | N/A | ✅ CLEAN | **FAIL** |
| **M15_SECURITY_SANDBOX** | `none` | `none` | N/A | N/A | ✅ CLEAN | **PASS** |

---

## 3. Factorial Context Length Analysis (N=5 per cell)

| Context Window | Trials | Successes | Success Rate | Median Latency |
|---|---|---|---|---|
| **4096** | 25 | 0 | **0.0%** | 12.4s |
| **8192** | 25 | 0 | **0.0%** | 12.6s |
| **12288** | 25 | 0 | **0.0%** | 11.9s |
| **16384** | 25 | 0 | **0.0%** | 12.0s |

---

## 4. Factorial Tool Output Format Analysis (N=5 per cell)

| Tool Output Format | Trials | Repair Success | Median Latency | Latency Reduction |
|---|---|---|---|---|
| **raw** | 5 | 0/5 | 72.0s | **0.0%** |
| **bounded** | 5 | 1/5 | 13.6s | **81.1%** |
| **structured** | 5 | 1/5 | 14.4s | **80.0%** |

---

## FINAL BASELINE VERDICT

```
===============================================================
FINAL BASELINE VERDICT:
QWEN_HARNESS_BASELINE DATA-INTEGRITY VERIFIED
===============================================================
```
