---
description: Run fast, lightweight verification audit on target invariant without full ceremony
---

# /gsd-bend:quick or /gsd-bend-quick

Run immediate formal verification or anti-cheat check on a targeted invariant or module.

## Usage
```bash
/gsd-bend:quick [law_name]
# or
/gsd-bend-quick [law_name]
# or via CLI
gsd-bend quick [law_name]
```

## Behavior
1. Rapidly evaluates proof case branches for the specified law in `PROOF.bend`.
2. Validates against inductive holes `{?}` and anti-Goodhart mocks.
3. Produces instant pass/fail terminal feedback for inner development loops.
