# /gsd-bend:execute or /gsd-bend-execute

Execute planned implementation tasks while constructing formal mathematical proofs in `PROOF.bend`.

## Usage
```bash
/gsd-bend:execute
# or
/gsd-bend-execute
# or via CLI
gsd-bend execute
```

## What it does
1. **Law Lock Verification**: Validates that `LAWS.bend` has NOT been tampered with or altered since `gsd-bend plan`. If tampered, execution halts immediately with `LAW_LOCK_TAMPERED`.
2. **Scaffolds / Validates `PROOF.bend`**: Ensures proof stubs exist for all declared laws.
3. **Enforces AI Agent Directives**:
   - Write real business logic in source code files.
   - Supply exhaustive inductive proof branches covering 100% of inputs in `PROOF.bend`.
   - Never inject mocking frameworks (`jest.mock`, `vi.mock`, fake return shortcuts).
   - Never bypass induction with unproven axioms (`axiom bypass:`).
4. **Prepares Verify Gate**: Sets GSD phase to `execute` (`in_progress`).
