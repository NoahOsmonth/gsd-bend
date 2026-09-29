# /gsd-bend:status or /gsd-bend-status

Display the full lifecycle state, law lock integrity, proof attestation validity, and next recommended GSD action.

## Usage
```bash
/gsd-bend:status
# or
/gsd-bend-status
# or via CLI
gsd-bend status
```

## What it does
1. **Queries Lifecycle State**: Reads `.planning/STATE.md` and `.planning/state.json`.
2. **Checks Law Lock Integrity**: Computes live SHA-256 hash of `LAWS.bend` against `.planning/laws.lock`.
3. **Audits Attestation**: Validates cryptographic signature in `.planning/PROOF_ATTESTATION.json`.
4. **Guides Next Phase**: Recommends the exact next step in the GSD cycle (`plan`, `execute`, `verify`, or `ship`).
