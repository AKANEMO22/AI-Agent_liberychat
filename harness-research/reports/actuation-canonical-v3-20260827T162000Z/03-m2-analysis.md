# 03 — M2 DISCOVERY TASK MUTATION FORENSICS
## Phase R15.5: Investigation into Multi-File Edits on M2

### 1. Observed Behavior
In task M2 (`userPrompt: "Tìm file gây lỗi tính discount... sửa nó và chạy test"`), the agent first runs `run_test`, sees failing tests in `tests/test_discount_engine.py`, and attempts to fix the bug.
- **Unexpected File 1**: `tests/test_discount_engine.py` (Agent often edits the test file instead of or in addition to `discount_engine.py`).
- **Unexpected File 2**: `calculator.py` (Agent occasionally edits the default math module before realizing discount calculation is in `discount_engine.py`).

### 2. Provenance Verdict
All unexpected modifications in M2 originate from **`MODEL_EDIT_TOOL`** calls emitted by Qwen, NOT from pytest side effects or benchmark artifacts.
