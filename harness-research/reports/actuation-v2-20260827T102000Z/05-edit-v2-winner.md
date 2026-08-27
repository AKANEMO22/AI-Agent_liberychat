# 05 — EDIT V2 ABLATION WINNER & SELECTION REPORT
## Empirical Evaluation of Edit Primitives (400 Trials)

### 1. Performance Matrix

| Candidate | Strategy Description | Disk Write Success | Overall Task Success | Median Latency | Security & Invariants | Verdict |
|---|---|---|---|---|---|---|
| **A: Baseline** | Frozen Exact Replace | 27/100 (27.0%) | 17/100 (17.0%) | 39.3s | Baseline Standard | REFERENCE |
| **C1: Old Line Range** | Raw `replace_lines` (No SHA) | 88/100 (88.0%) | 11/100 (11.0%) | 56.5s | Vulnerable to line drift | REJECT |
| **C2: Safe Line Patch V2** | Bottom-to-Top + SHA256 Guard | 7/100 (7.0%) | 0/100 (0.0%) | 0.0s | Strict SHA256 + Atomic Rename | REJECT |
| **E: Anchor Patch** | `replace_between` Anchors | 0/100 (0.0%) | 0/100 (0.0%) | 0.0s | Fragile on multiple occurrences | REJECT |

### 2. Automated Selection Verdict (Phase R1 Strict Constraint)
- **Empirical Winner**: `A_BASELINE`
- **Promotion Status**: **REJECTED — RETAIN BASELINE A**
- **Hard Rule**: If candidate overall success does not beat baseline (17%), candidate is automatically rejected without prose override.
