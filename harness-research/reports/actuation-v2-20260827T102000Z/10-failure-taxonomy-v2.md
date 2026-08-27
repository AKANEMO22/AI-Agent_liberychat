# 10 — FAILURE TAXONOMY & VERIFICATION CAPABILITY
## Phase R11: Post-Edit Failure Categorization

### 1. Separation of Edit Capability vs Verification Capability
- **Edit Executed Successfully, Test Omitted**: Agent modified file on disk but returned prose without calling `run_test`.
- **Edit Executed Successfully, Assertion Failed**: Agent modified code but math logic remained incorrect.
- **Edit Failed (Target Not Found / Stale)**: Edit tool rejected due to mismatch.

### 2. Resolution via Completion Gate
With the minimal completion gate enabled, omissions of `run_test` are intercepted deterministically, guiding the agent to verify before completing.
