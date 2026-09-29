# /gsd-bend:ship or /gsd-bend-ship

Evaluate the proof gate, seal the phase release, and allow deployment only if every law was discharged.

## Usage
```bash
/gsd-bend:ship
# or
/gsd-bend-ship
# or via CLI
gsd-bend ship
```

## What it does
1. **Evaluates Proof Attestation Gate**: Verifies `.planning/PROOF_ATTESTATION.json` for:
   - An untampered attestation (`signed` reports whether a key was configured).
   - Compiler-checked coverage (`ALL_INPUTS_CHECKED_BY_BEND`), or `SAMPLED_*` when no Bend compiler was available.
   - Clean anti-Goodhart security audit.
   - Untampered law & proof hashes.
2. **Hard Gate Enforcement**: If unverified, tampered, or missing, advancement to ship is strictly blocked (`GATE_BLOCKED`).
3. **Generates Release Summary**: Creates `.planning/SHIP_SUMMARY.md` documenting the verified laws and the attestation token.
4. **Lifecycle Completion**: Sets GSD state to `ship` (`completed`).
