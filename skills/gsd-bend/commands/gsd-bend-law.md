# /gsd-bend:law

Manage and lock mathematical laws in `LAWS.bend`.

## Usage
```bash
/gsd-bend:law lock
/gsd-bend:law check
/gsd-bend:law list
```

## Subcommands
- `lock`: Generates a canonical SHA-256 hash of all declared invariants and stores it in `.planning/laws.lock`.
- `check`: Validates that `LAWS.bend` has not been tampered with or modified by an AI agent.
- `list`: Displays all active mathematical laws, their parameters, and invariant expressions.
