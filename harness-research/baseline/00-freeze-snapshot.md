# PHASE 0: FROZEN CORE BASELINE SNAPSHOT

**Timestamp:** 2026-08-27T01:13:00+07:00  
**Host Machine:** Windows 11 Laptop  
**Primary GPU:** NVIDIA GeForce RTX 4050 Laptop GPU (6141 MiB / 6 GB VRAM, Driver 610.47)  
**CPU:** 13th Gen Intel(R) Core(TM) i5-13500HX (14 cores, 20 logical processors)  
**System RAM:** 16 GB Total (16,490 MB, ~2.7 GB free physical memory at baseline)  

---

## 1. Runtime & Model Identification

| Property | Value |
|---|---|
| **Ollama Version** | 0.32.14 |
| **Model Name** | `qwen2.5-coder-local:latest` |
| **Base Model** | `qwen2.5-coder:7b` (Qwen2.5-Coder-7B-Instruct) |
| **GGUF Blob SHA256** | `784863612b8e37c065cf2efd894f0374823c12d28befede62c25b4a6a1411c57` |
| **Model Disk Size** | 4.7 GB (Q4_K_M quantization) |
| **Current Baseline `num_ctx`** | 4096 tokens |
| **Current Baseline `temperature`** | 0.2 |

---

## 2. Production Frozen Core Components & Budgets

### Tool Adapter Configuration (`openai-tool-adapter/index.js`)
- **Port:** 8090
- **Auth:** Local Bearer (`local-agent-secret-key-prod-8090`)
- **Upstream Ollama:** `http://127.0.0.1:11434`
- **Request Timeout:** 120,000 ms (2 minutes)
- **Max Body Size:** 10 MB

### Production Mode Budgets
- **Light Mode:** 1 turn budget, direct QA, zero tool overhead.
- **Medium Mode:** 3 turn budget, targeted bug fixing (`read_file`, `edit_file`, `run_test`).
- **High Mode:** 5 turn budget, complex multi-file engineering and verification.

### Active Production Tool Set
1. `read_file`: Complete file content retrieval within active workspace.
2. `edit_file`: Exact `target_content` substring replacement within active workspace.
3. `run_test`: Subprocess pytest execution with parsed `exit_code` and `passed` status.
4. `git_diff`: Working directory diff inspection.

---

## 3. Baseline GPU / VRAM Profile (Idle)

- **GPU Memory In Use:** ~432 MiB (Display & desktop apps)
- **Free VRAM for Ollama KV Cache + Weights:** ~5.7 GB
- **Baseline VRAM with 4K Context:** ~5.1 GB (fully fits in VRAM on Q4_K_M)

---

## 4. Frozen Core Commitment

The production systems (LibreChat UI, Tree+Chat, Start/Bootstrap, Adapter Protocol, MCP, Workspaces) are strictly **FROZEN**. All diagnostic harness benchmarks and research files reside solely in `harness-research/`.
