# 02 — FORENSIC ROOT CAUSE OF 0–2 MS BENCHMARK RUNS
## Phase F2: Architectural Bug Localization

### 1. Root Cause Identification
- **FILE**: `harness-research/v2-recovery-suite.js`
- **FUNCTION**: `callAdapter` & `runV2Trial`
- **LINES**: 61–108, 414–416, 514–548

### 2. Forensic Mechanism
During the execution of Phase R10 at Candidate C2 Rep 8, the upstream Ollama daemon process exited unexpectedly due to an IDE server reload.
When `callAdapter` attempted to connect to `http://127.0.0.1:8090`, the Node.js HTTP request emitted `ECONNREFUSED`.

```javascript
// Flawed Error Handling in v2-recovery-suite.js:
req.on('error', (err) => {
  resolve({ error: err.message }); // Returned error object instead of throwing / marking invalid
});

// Flawed Loop Termination:
const resp = await callAdapter(messages, tools, numCtx);
const msg = resp.choices?.[0]?.message;
if (!msg) break; // Immediately broke out of while-loop in 1ms!
```

### 3. False Failure Conversion
Because `if (!msg) break;` immediately terminated the turn without throwing an exception or aborting the trial:
1. `overallSuccess` evaluated to `false` (`diskWriteSuccess: false && testSuccess: false`).
2. `totalLatencyMs` was computed as `Date.now() - startTime` = **0–2 ms**.
3. The benchmark script treated an **infrastructure connection drop** as an **agent task failure**, polluting datasets 04, 06, 07, 08, and C2/E with spurious 0 ms false negatives!

### 4. Remediation in Phase R14
- Strict validity check: `valid_trial = model_inference_executed && elapsed_ms > 100 && !infraError`.
- Any infrastructure error immediately marks the trial as `INVALID_RUN` and excludes it from agent ablation scoring.
