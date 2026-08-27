# 08 — BASELINE STABILITY & REPRODUCIBILITY AUDIT
## Phase F6: 3 Independent Baseline Batches (N=70 per Batch, Total 210 Trials)

### 1. Batch Comparison Matrix

| Batch Identifier | Valid Trials | Real Disk Write Success | Test Pass Rate | Overall Task Success | Clean Audit Rate | Median Latency |
|---|---|---|---|---|---|---|
| **Batch A** | 70/70 | 21/70 (30.0%) | 8 (20.0%) | **10/70 (14.3%)** | 80.0% | 11.1s |
| **Batch B** | 70/70 | 17/70 (24.3%) | 6 (15.0%) | **8/70 (11.4%)** | 81.4% | 11.8s |
| **Batch C** | 70/70 | 21/70 (30.0%) | 9 (22.5%) | **12/70 (17.1%)** | 85.7% | 11.8s |

### 2. Stability Analysis
- **Inter-Batch Overall Success Range**: `[11.4% - 17.1%]`
- **Mean Baseline Overall Success**: ```14.3%```
- **Zero Unexpected Mutations**: All three batches maintained strict sandbox isolation and 0 unexpected disk writes.
