# 09 — HISTORICAL BASELINE RECONCILIATION & LINEAGE
## Phase F7: Empirical Explanation of Prior Divergent Baseline Scores

| Historical Report | Reported Overall Success | Exact Cause of Divergence | Runner Implementation | Prompt & Schema State | Model Status |
|---|---|---|---|---|---|
| **Phase 8.5 Baseline Stress** | **~20.0% (3/15)** | Real multi-turn agent runs on 15 difficult mutation tasks | `file-mutation-stress.js` | Raw prompt without line hints | Real Ollama Inference |
| **Phase 9 Initial Claim** | **~67.1% (47/70)** | Evaluated single-turn exact replacement fixtures with pre-seeded edit prompts | `v1-recovery-suite.js` | Exact match prompts with strict formatting | Real Ollama Inference |
| **Phase 10 Integrity Audit** | **~18.6% (13/70)** | Corrected scoring requiring strict test pass + clean git diff across all 14 M-tasks | `integrity-rerun` | Full 14 M-tasks with test pass enforcement | Real Ollama Inference |
| **Phase R14 Canonical Baseline** | **14.3% (Batch Average)** | Canonical unified production runner with full telemetry verification and strict status logging | `runProductionAgentTrial` | Canonical production tools + strict validity guard | Real Ollama Telemetry Verified |

### Key Conclusion
The divergence between past reported baselines stems from differences in **test enforcement strictness** (whether `run_test` pass was required) and **task difficulty distribution** (e.g., whether M9–M14 were included).
Under the canonical unified runner, the baseline is now rigorously pinned and verifiable.
