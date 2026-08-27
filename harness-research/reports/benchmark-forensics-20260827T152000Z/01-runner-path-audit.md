# 01 — RUNNER PATH AUDIT & ARCHITECTURAL VERIFICATION
## Phase F0: Exhaustive Runner Execution Chain Document

| Runner / Experiment | Target Endpoint | Invokes Ollama? | Invokes Adapter? | Invokes MCP/Workspace? | Real Workspace Fixture? | Waits Model Completion? | Parses Tool Calls? | Mutates Disk? | Runs Pytest Subprocess? | Latency Measurement | Valid Inference Path? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **01: Baseline Re-verification** | `http://127.0.0.1:8090/v1/chat/completions` | YES | YES | YES | YES | YES | YES | YES | YES | Wall-clock (`Date.now()`) | **YES** |
| **03: Edit V2 Ablation (A, C1)** | `http://127.0.0.1:8090/v1/chat/completions` | YES | YES | YES | YES | YES | YES | YES | YES | Wall-clock (`Date.now()`) | **YES** |
| **03: Edit V2 Ablation (C2 rep 8+, E)** | `http://127.0.0.1:8090/v1/chat/completions` | NO (Ollama died) | NO (ECONNREFUSED) | NO | YES | NO (Early break) | NO | NO | NO | Loop start-to-break | **NO (INVALID)** |
| **04: Read Representations** | `http://127.0.0.1:8090/v1/chat/completions` | NO (Ollama died) | NO (ECONNREFUSED) | NO | YES | NO (Early break) | NO | NO | NO | Loop start-to-break | **NO (INVALID)** |
| **06: run_test Compiler** | `http://127.0.0.1:8090/v1/chat/completions` | NO (Ollama died) | NO (ECONNREFUSED) | NO | YES | NO (Early break) | NO | NO | NO | Loop start-to-break | **NO (INVALID)** |
| **07: Completion Gate** | `http://127.0.0.1:8090/v1/chat/completions` | NO (Ollama died) | NO (ECONNREFUSED) | NO | YES | NO (Early break) | NO | NO | NO | Loop start-to-break | **NO (INVALID)** |
| **08: Full Progression** | `http://127.0.0.1:8090/v1/chat/completions` | NO (Ollama died) | NO (ECONNREFUSED) | NO | YES | NO (Early break) | NO | NO | NO | Loop start-to-break | **NO (INVALID)** |

### Comprehensive Runner Analysis
1. **Model Invoked**: `qwen2.5-coder-local:latest` via Ollama on `http://127.0.0.1:11434`.
2. **Adapter Protocol**: Protocol translation layer on `http://127.0.0.1:8090`.
3. **Workspace Isolation**: Clean clone of `workspace-agent-test-template` per trial in disposable `tmp_workspaces/ws_*`.
