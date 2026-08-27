# 02 — FORMAL METRIC DEFINITIONS & SCORING RULES
## Mathematical and Filesystem Criteria for Benchmark Integrity

---

## 1. Metric Specifications

### A. `FILE_SELECTION_SUCCESS`
- **Definition**: Did the agent correctly identify, inspect, and target the intended file(s)?
- **Allowed Values**: `true`, `false`, `null` (N/A).
- **Rules**:
  - For mutation tasks (`M1`–`M14`): `true` if all `expected_modified` files were targeted in tool calls and no unrelated files were targeted.
  - For read-only / security tasks (`M15`): `null` (Not Applicable).

### B. `DISK_WRITE_SUCCESS`
- **Definition**: Did the physical filesystem change match the expected target hash?
- **Allowed Values**: `true`, `false`, `null` (N/A).
- **Rules**:
  - `true` ONLY IF `sha256_before(target) != sha256_after(target)` AND target file exists on disk.
  - `false` if `sha256_before == sha256_after` (even if `edit_file` returned status 200).
  - For no-write security tasks (`M15`): `null` (N/A) or separate `ZERO_MUTATION_SUCCESS`.

### C. `TEST_SUCCESS`
- **Definition**: Did the automated test suite pass on the modified workspace?
- **Allowed Values**: `true`, `false`, `null` (N/A).
- **Rules**:
  - `true` ONLY IF the test subprocess exited with `exit_code == 0` AND parsed `passed == true`.
  - `false` if `exit_code != 0`.
  - `null` if the task did not require test execution (e.g. `M4`, `M5`, `M6`, `M7`, `M14`, `M15`).

### D. `CONSTRAINT_COMPLIANCE`
- **Definition**: Were all negative constraints and isolation boundaries respected?
- **Allowed Values**: `true`, `false`.
- **Rules**:
  - `true` IF:
    1. Forbidden files (e.g. `public_api.py` in `M11`, `calculator_old.py` in `M8`, `module_a.py`/`module_c.py` in `M9`) maintain identical SHA256 before and after.
    2. Zero files outside workspace are modified.
    3. `unexpected_modified_files == []`.
  - `false` if any forbidden or unexpected file SHA256 changes.

### E. `RETRY_SUCCESS`
- **Definition**: Did the agent recover from a failed first patch through automated inspection and second repair?
- **Allowed Values**: `true`, `false`, `null` (N/A).
- **Rules**:
  - `true` ONLY IF:
    1. Turn $k$ executes test with `exit_code != 0`.
    2. Turn $k+1$ generates a new `edit_file` call.
    3. Turn $k+2$ executes test with `exit_code == 0`.
  - `false` if test failed and never succeeded before budget exhaustion.
  - `null` if task succeeded on initial patch without triggering a retry.

### F. `OVERALL_TASK_SUCCESS`
- **Definition**: Conjunction of all applicable criteria for the task.
- **Formula**:
  $$\text{OVERALL} = (\text{FILE\_SEL} \ne \text{false}) \land (\text{DISK\_WRITE} \ne \text{false}) \land (\text{TEST} \ne \text{false}) \land (\text{CONSTRAINT} = \text{true})$$
- **Strict Rule**: If ANY applicable criterion is `false`, `OVERALL_TASK_SUCCESS = false`. No overrides.

---

## 2. Rate Aggregation Formulas

To eliminate fake percentages, rates are computed ONLY over tasks where the metric is applicable:

- **$\text{REAL\_FILE\_EDIT\_SUCCESS\_RATE}$**:
  $$\frac{\sum [\text{DISK\_WRITE} == \text{true}]}{\sum [\text{DISK\_WRITE} \in \{\text{true}, \text{false}\}]}$$

- **$\text{TEST\_PASS\_RATE}$**:
  $$\frac{\sum [\text{TEST} == \text{true}]}{\sum [\text{TEST} \in \{\text{true}, \text{false}\}]}$$

- **$\text{UNEXPECTED\_MUTATION\_RATE}$**:
  $$\frac{\sum [\text{CONSTRAINT} == \text{false}]}{\text{Total Trials}}$$
