---
description: Detect current GSD lifecycle state and automatically route or advance to the next phase
---

# /gsd-bend:next or /gsd-bend-next

Inspect the project state and automatically route the agent or developer to the next logical phase in the GSD Core + Bend 2 formal proof lifecycle.

## Usage
```bash
/gsd-bend:next
# or
/gsd-bend-next
# or via CLI
gsd-bend next
# or automatic advancement
gsd-bend next --auto
```

## Lifecycle Routing Logic
- **Uninitialized** -> Runs or suggests `/gsd-bend:new-project`
- **new-project** -> Advances to `/gsd-bend:map-codebase` to identify sensitive state
- **map-codebase** -> Advances to `/gsd-bend:discuss` to clarify invariants
- **discuss** -> Advances to `/gsd-bend:plan` to lock invariants in `LAWS.bend`
- **plan** -> Advances to `/gsd-bend:execute` to write code & `PROOF.bend`
- **execute** -> Advances to `/gsd-bend:verify` to run the formal proof gate
- **verify** (passed) -> Advances to `/gsd-bend:ship` to seal release
- **verify** (failed) -> Triggers `/gsd-bend:heal` to inspect counterexamples
- **ship** -> Reports the project complete and every law discharged.
