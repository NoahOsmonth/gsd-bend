# Claude Code / General LLM System Prompt Integration: gsd-bend
# Add this file to your CLAUDE.md or copy into your system prompt / agent configuration.

## Formal Verification with Bend 2 (`gsd-bend`)

This project uses **formal mathematical proofs** to prevent hallucinated bugs and Goodhart's Law shortcuts.

### Available CLI Commands:
- `gsd-bend init`: Creates `LAWS.bend`, `PROOF.bend`, and `.planning/laws.lock`.
- `gsd-bend law lock`: Computes and records the SHA-256 hash of `LAWS.bend`.
- `gsd-bend audit`: Detects mocking, unproven axioms, skipped branches, and hardcoded cheats.
- `gsd-bend verify`: Evaluates formal proofs and generates `.planning/PROOF_ATTESTATION.json`.
- `gsd-bend heal`: Suggests proof fixes when encountering inductive holes or counterexamples.

### Rules for the Agent:
1. `LAWS.bend` is immutable. Modifying it triggers `LAW_LOCK_VIOLATION`.
2. Do not insert dummy mocks (`jest.mock`, `vi.mock`, fake returns).
3. Always run `gsd-bend verify` before finishing a task. A task is ONLY complete when `PROOF_ATTESTATION.json` is signed.
4. If a counterexample is generated, use it to patch the logic in your code.
