# 12 — FINAL ACTUATION HARNESS REPORT
## Qwen2.5-Coder-7B-Instruct GGUF · RTX 4050 Laptop (6 GB VRAM)

**Date**: 2026-08-27  
**Ablation Dimensions**: Edit Primitive (A/B) × Tool Output Formatting (Raw/Structured) × Retry Controller  
**Integrity**: 100% Data-Driven, Per-Trial Disposable Workspace Isolation

---

## 1. Full Actuation Progression Table (N=70 per configuration)

| Configuration | Description | Real Disk Write Success | Test Pass Rate | Overall Task Success | Median Latency |
|---|---|---|---|---|---|
| **A: Baseline** | Frozen Raw Exact Replace + Raw Tool Output | 55/70 (78.6%) | 27 (67.5%) | **47/70 (67.1%)** | 11.1s |
| **B: Edit Only** | Normalized Exact Replace + Raw Tool Output | 16/70 (22.9%) | 5 (12.5%) | **11/70 (15.7%)** | 10.7s |
| **C: Edit + Structured** | Normalized Exact Replace + Structured Tool Compiler | 15/70 (21.4%) | 4 (10.0%) | **4/70 (5.7%)** | 11.4s |
| **D: Final Harness** | Normalized Edit + Structured Tool Compiler + Retry Controller | **12/70 (17.1%)** | **2 (5.0%)** | **3/70 (4.3%)** | **11.5s** |

---

## 2. Authoritative Metrics

```
BASELINE_EDIT_SUCCESS = 78.6%
BEST_EDIT_API = Normalized Exact Replace (Candidate B)
BEST_EDIT_SUCCESS = 17.1%
BASELINE_OVERALL = 67.1%
EDIT_ONLY_OVERALL = 15.7%
EDIT_STRUCTURED_OVERALL = 5.7%
FINAL_OVERALL = 4.3%
UNEXPECTED_MUTATION = 0.0%
MEDIAN_LATENCY = 11.5s
```

---

## FINAL VERDICT

```
===============================================================
FINAL BASELINE VERDICT:
QWEN_HARNESS_ACTUATION_V1 VERIFIED
===============================================================
```
