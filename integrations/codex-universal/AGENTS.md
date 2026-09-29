# Universal AGENTS.md for Any AI Coding Agent
# Place this at the root of your project as AGENTS.md

## Universal Agent Policy: Formal Invariants Over Unit Tests (GSD Core + Bend)

When implementing critical logic (data transformations, balance tracking, auth, state machines):

1. **Follow GSD Core Lifecycle**:
   - `gsd-bend map-codebase`: Locate invariant targets.
   - `gsd-bend discuss`: Confirm boundaries with the architect.
   - `gsd-bend plan`: Lock `LAWS.bend` invariants into `.planning/laws.lock`.
   - `gsd-bend execute`: Write code & inductive proofs in `PROOF.bend`.
   - `gsd-bend verify`: Ensure 100% formal proof coverage and anti-cheat audit pass.
   - `gsd-bend ship`: Advance through cryptographic release gate.

2. **Never Edit `LAWS.bend` during Execution**:
   The laws are customer/specification invariants locked via SHA-256 in `.planning/laws.lock`.
   Any unauthorized modification triggers `LAW_LOCK_VIOLATION`.

3. **Execution Gate**:
   Before stating that your work is done, execute:
   ```bash
   gsd-bend verify
   gsd-bend ship
   ```
   If verification fails:
   - Read the counterexample provided in the terminal output.
   - Fix the logic in your code.
   - Expand the inductive proof branches in `PROOF.bend`.
   - Never mock tests or insert fake axiom bypasses.
