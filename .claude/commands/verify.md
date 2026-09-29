# /gsd-bend:verify or /gsd-bend-verify

Run the formal verification gate to mechanically check all laws against `PROOF.bend`.

## Usage
```bash
/gsd-bend:verify
# or
/gsd-bend-verify
# or via CLI
gsd-bend verify
```

## Behavior
1. Checks law integrity against `.planning/laws.lock`.
2. Audits for anti-Goodhart cheating (mock injection, axiomatic bypasses).
3. Executes the Bend 2 proof checker (native compiler or built-in engine).
4. Issues a signed `.planning/PROOF_ATTESTATION.json` upon 100% domain proof.
5. Unblocks the GSD phase advancement gate to allow transition to `Ship`.
