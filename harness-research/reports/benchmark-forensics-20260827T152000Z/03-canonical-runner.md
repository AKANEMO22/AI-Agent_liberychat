# 03 — CANONICAL PRODUCTION AGENT RUNNER SPECIFICATION
## Phase F5: Single Unified Execution Interface

### 1. Unified Invocation Function
All actuation benchmarks MUST use the single canonical runner:
```javascript
runProductionAgentTrial({
  runId,
  task,
  tools = getCanonicalTools(),
  numCtx = 8192,
  maxTurns = 8,
  isManualTrace = false,
  traceDir = null
})
```

### 2. Execution Path Invariants
```
Benchmark Orchestrator
       ↓
Isolated Workspace Fixture (`tmp_workspaces/ws_*`)
       ↓
Production Message Assembly (System Prompt + Task)
       ↓
OpenAI Tool Adapter (`http://127.0.0.1:8090`)
       ↓
Ollama Inference Engine (`qwen2.5-coder-local`)
       ↓
Strict Tool Call Parsing
       ↓
Canonical File & Test Actuation on Disk
       ↓
Pytest Subprocess Verification
       ↓
Full Telemetry & Status Enforcement (`VALID_PASS` / `VALID_FAIL` / `INVALID_RUN`)
```
