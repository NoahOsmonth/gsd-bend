# /gsd-bend:new-project or /gsd-bend-new-project

Scaffold a greenfield project powered by GSD Core and Bend 2 formal mathematical verification.

## Usage
```bash
/gsd-bend:new-project [project-name]
# or
/gsd-bend-new-project [project-name]
# or via CLI
gsd-bend new-project my-verified-app
```

## What it does
1. **Workspace Scaffolding**: Initializes `.planning/` directory, project configuration, and `STATE.md`.
2. **Invariant Specification Boilerplate**: Creates `LAWS.bend` with invariant templates.
3. **Proof Harness Boilerplate**: Creates `PROOF.bend` with inductive match templates.
4. **Cryptographic Locking**: Immediately computes and records `.planning/laws.lock` (SHA-256).
5. **State Initialization**: Sets GSD phase to `new-project` (`initialized`), ready for discussion or planning.
