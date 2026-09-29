# /gsd-bend:init or /gsd-bend-init

Initialize Bend 2 formal mathematical verification in the current GSD project.

## Usage
```bash
/gsd-bend:init
# or
/gsd-bend-init
# or via CLI
gsd-bend init
```

## What it does
1. Scaffolds `.planning/` directory if missing.
2. Generates initial `LAWS.bend` with invariant template.
3. Generates initial `PROOF.bend` with inductive proof template.
4. Locks the invariants with a canonical SHA-256 hash in `.planning/laws.lock`.
5. Sets GSD state in `.planning/STATE.md` to `initialized`.
