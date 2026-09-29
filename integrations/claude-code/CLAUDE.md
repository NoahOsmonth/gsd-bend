# Claude Code / General LLM System Prompt Integration: gsd-bend
# Add this file to your CLAUDE.md or copy into your system prompt / agent configuration.

## Formal Verification with Bend 2 (`gsd-bend`) & Full GSD Core Lifecycle

This project integrates **GSD Core (`open-gsd/gsd-core`)** with **Bend 2 formal proofs** to prevent hallucinated bugs, security exploits, and Goodhart's Law test tampering.

### Available Slash Commands (Claude Code & Cursor):
- `/gsd-bend:new-project` (or `gsd-bend new-project [name]`): Scaffold new project with `.planning/`, `LAWS.bend`, `PROOF.bend`.
- `/gsd-bend:map-codebase` (or `gsd-bend map-codebase`): Map architecture and identify critical state variables.
- `/gsd-bend:discuss` (or `gsd-bend discuss [topic]`): Elicit boundary conditions and capture invariants.
- `/gsd-bend:plan` (or `gsd-bend plan`): Formulate phase plan, define `LAWS.bend`, and lock SHA-256 in `.planning/laws.lock`.
- `/gsd-bend:execute` (or `gsd-bend execute`): Implement logic and construct exhaustive inductive proofs in `PROOF.bend`.
- `/gsd-bend:verify` (or `gsd-bend verify`): Mechanically prove all laws, run anti-cheat audit, sign `PROOF_ATTESTATION.json`.
- `/gsd-bend:ship` (or `gsd-bend ship`): Check proof gate, seal release, and emit `SHIP_SUMMARY.md`.
- `/gsd-bend:status` (or `gsd-bend status`): Check current phase lifecycle and verification status.
- `/gsd-bend:next` (or `gsd-bend next [--auto]`): Smart router to detect state and advance to the next GSD phase.
- `/gsd-bend:quick` (or `gsd-bend quick [law]`): Rapid single-law proof verification for inner loops.
- `/gsd-bend:audit` (or `gsd-bend audit`): Audit for mock injection (`jest.mock`, `vi.mock`), dummy shims, and axiom bypasses.
- `/gsd-bend:heal` (or `gsd-bend heal`): AI reflection prompt to diagnose proof failures or counterexamples.

### Rules for the Agent:
1. `LAWS.bend` is immutable once locked in `.planning/laws.lock`. Modifying it triggers `LAW_LOCK_VIOLATION`.
2. Do not insert dummy mocks (`jest.mock`, `vi.mock`, fake returns).
3. Do not bypass proof goals with unproven axioms (`axiom bypass:`).
4. Always pass `gsd-bend verify` and clear the `gsd-bend ship` gate before concluding a task.
