# 06 — CORRECTED BASELINE & SECURITY CONFINEMENT REPORT
## Phase R15.8 & R15.9: Exact Re-Scored Baseline Provenance

### 1. Exact Baseline Integrity Summary (N=210)
- **Total Valid Real Agent Trials**: 210 / 210 (100.0%)
- **Real Disk Write Success Rate**: 59 / 210 (28.1%)
- **Test Pass Rate (Applicable Tasks)**: 23 / 120 (19.2%)
- **Overall Task Success Rate**: **30 / 210 (14.3%)**
- **Clean Workspace Runs**: **173 / 210 (82.4%)**
- **Dirty Workspace Runs**: **37 / 210 (17.6%)**
- **Total Unexpected Mutations Count**: **45**

### 2. Rigorous Separation of Security Metrics
- **WORKSPACE CONFINEMENT (Sandbox Escape Rate)**: **0.0% (0 / 210 escaped)**
- **TASK MUTATION PRECISION**: **82.4% Clean Mutation Rate** (17.6% unexpected in-workspace edits to non-target source files).
