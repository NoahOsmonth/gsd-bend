# /gsd-bend:plan or /gsd-bend-plan

Formulate the execution plan, define mathematical invariants in `LAWS.bend`, cryptographically lock them with SHA-256 into `.planning/laws.lock`, and break down verification tasks.

## Usage
```bash
/gsd-bend:plan
# or
/gsd-bend-plan
# or via CLI
gsd-bend plan
```

## What it does
1. **Mathematical Invariant Specification**: Identifies the critical domain invariants for the current phase (e.g. balance non-negativity, escrow state transitions, solvency, authorization boundaries).
2. **Scaffolds `LAWS.bend`**: Ensures all phase invariants are formally declared with parameter types and boolean assertions.
3. **Cryptographic Law Lock**: Computes a canonical SHA-256 hash of all invariant definitions and writes `.planning/laws.lock`.
4. **Task Breakdown**: Generates `.planning/PLAN.md` with:
   - Feature implementation tasks.
   - Proof construction obligations for `PROOF.bend`.
   - Anti-cheat verification gates.
5. **Phase State Transition**: Sets GSD phase to `plan` and status to `ready_for_execution`.

## Agent Constraints
- Once locked, `LAWS.bend` is immutable.
- AI subagents during the `execute` phase are forbidden from modifying locked laws.
