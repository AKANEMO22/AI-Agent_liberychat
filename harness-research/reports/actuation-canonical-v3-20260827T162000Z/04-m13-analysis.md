# 04 — M13 FOCUSED-FILE OVERRIDE MUTATION FORENSICS
## Phase R15.6: Investigation into Focused vs Explicit File Overrides

### 1. Scenario Invariants
- Focused file in IDE context: `calculator.py`
- User explicit task prompt: *"Sửa discount_engine.py để tính discount đúng (tier_discount + coupon_discount)."*
- Allowed file: `["discount_engine.py"]`

### 2. Root Cause of Dirty Runs in M13
In M13, Qwen successfully reads and edits `discount_engine.py` (`disk_write_success = true`).
However, because `calculator.py` was pre-listed in the system prompt workspace files as the primary active context, Qwen also emitted a secondary tool call to `calculator.py`.
- **Unexpected Modified File**: `calculator.py`
- **Provenance Verdict**: **`MODEL_EDIT_TOOL`** (Real agent behavior — failure to strictly isolate explicit target from ambient focused context).
