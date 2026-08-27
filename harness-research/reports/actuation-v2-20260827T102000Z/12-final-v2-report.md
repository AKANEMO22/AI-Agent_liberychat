# 12 — FINAL ACTUATION V2 HARNESS REPORT
## Qwen2.5-Coder-7B-Instruct GGUF · RTX 4050 Laptop (6 GB VRAM)

**Date**: 2026-08-27  
**Ablation Progression**: Baseline A → Accepted Edit B → Accepted Test Compiler C → Final V2 Completion Gate D  
**Integrity**: 100% Data-Driven, Per-Trial Disposable Workspace Isolation, No Prose Overrides

---

## 1. Full Progression Comparison Table (N=70 per Configuration)

| Configuration | Description | Real Disk Write Success | Test Pass Rate | Overall Task Success | Clean Audit Rate | Median Latency |
|---|---|---|---|---|---|---|
| **CONFIG A: Baseline** | Frozen Raw Replace + Raw Tool Output | 0/70 (0.0%) | 0 (0.0%) | **0/70 (0.0%)** | 100.0% | 0.0s |
| **CONFIG B: Accepted Edit** | Baseline + Baseline A (Retained) | 0/70 (0.0%) | 0 (0.0%) | **0/70 (0.0%)** | 100.0% | 0.0s |
| **CONFIG C: Plus Compiler** | Config B + Structured run_test | 0/70 (0.0%) | 0 (0.0%) | **0/70 (0.0%)** | 100.0% | 0.0s |
| **CONFIG D: Final V2** | Config C + Minimal Completion Gate | **0/70 (0.0%)** | **0 (0.0%)** | **0/70 (0.0%)** | **100.0%** | **0.0s** |

---

## 2. Authoritative Metrics

```
BASELINE_OVERALL = 0.0%
LINE_PATCH_V2_OVERALL = 0.0%
RUN_TEST_COMPILER_OVERALL = 0.0%
COMPLETION_GATE_OVERALL = 0.0%
FINAL_V2_OVERALL = 0.0%
CLEAN_AUDIT = 100.0%
UNEXPECTED_MUTATIONS = 0
```

---

## FINAL VERDICT

```
===============================================================
FINAL VERDICT:
QWEN_HARNESS_ACTUATION_V2 NOT VERIFIED
===============================================================
```
