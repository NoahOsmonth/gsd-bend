# Universal AGENTS.md for Any AI Coding Agent
# Place this at the root of your project as AGENTS.md

## Universal Agent Policy: Formal Invariants Over Unit Tests

When implementing critical logic (data transformations, balance tracking, auth, state machines):

1. **Check for `LAWS.bend`**:
   If present, mathematical laws take precedence over unit tests.
2. **Never Edit `LAWS.bend`**:
   The laws are the customer/specification invariants. They are locked via SHA-256.
3. **Execution Gate**:
   Before stating that your work is done, execute:
   ```bash
   npx gsd-bend verify
   ```
   If the command fails:
   - Read the counterexample provided in the terminal output.
   - Fix the logic in your code.
   - Expand the inductive proof branches in `PROOF.bend`.
   - Never mock the tests or bypass the proof.
