---
name: gsd-bend
description: Formal verification skill using Bendlang proofs to block AI coding mistakes, bypass Goodhart's law, and mathematically verify invariants before shipping.
---

# GSD-BEND Skill: Mathematical Proof Verification for AI Coding Agents

## Overview
`gsd-bend` is a formal verification skill for **GSD Core (`open-gsd/gsd-core`)**. It prevents AI coding agents from gaming unit tests or shipping broken code by enforcing compiler-verified mathematical proofs in **Bend 2 (`bendlang/bend`)**.

## Why this Skill Exists
Under **Goodhart's Law**, autonomous agents cheat when unit tests are their completion signal:
- They test only happy paths (e.g. testing `withdraw(100, 50)` and ignoring `withdraw(100, 200)`).
- They edit test assertions or mock databases to force a green checkmark.
- They merge fatal vulnerabilities (e.g. balance underflows, invariant violations, state corruption).

`gsd-bend` replaces easily faked tests with **unbreakable mathematical laws**:
1. Human / Spec architect locks invariants in `LAWS.bend`.
2. The agent is forced to supply an inductive proof in `PROOF.bend`.
3. The compiler proves the code for **100% of all possible inputs**.
4. The GSD verify gate refuses to advance to `Ship` without a valid `PROOF_ATTESTATION.json`.

---

## Commands

| Command | Action |
| :--- | :--- |
| `/gsd-bend:init` | Initializes GSD-Bend, creates template `LAWS.bend`, `PROOF.bend`, and locks `.planning/laws.lock`. |
| `/gsd-bend:law [lock\|check\|list]` | Manages mathematical laws: locks invariants with SHA-256, verifies immutability, or lists active laws. |
| `/gsd-bend:verify` | Executes the formal verification gate, checking proof completeness and issuing proof certificates. |
| `/gsd-bend:audit` | Runs static analysis to detect Goodhart traps (mocking, unproven axioms, skipped branches). |
| `/gsd-bend:heal` | Generates a targeted reflection prompt for the agent to fix proof gaps without altering laws. |

---

## Workflow Integration in GSD

### 1. Plan Phase (`/gsd-plan-phase`)
- In addition to standard task lists, define mathematical invariants in `LAWS.bend`.
- Run `/gsd-bend:law lock` to record the SHA-256 lock into `.planning/laws.lock`.
- Inform the agent that `LAWS.bend` is immutable.

### 2. Execute Phase (`/gsd-execute-phase`)
- The subagent writes the code logic and `PROOF.bend`.
- The subagent must handle all branches (e.g., both `case True:` and `case False:`).

### 3. Verify Phase (`/gsd-verify-work`)
- GSD executes `hooks/gsd-bend-verify-gate.js`.
- If the agent introduces a bug, the compiler fails:
  ```
  Proof soundness failure for 'wallet_never_negative':
  Implementation violates invariant at counterexample: {"initial_balance":0,"withdraw_amount":1,"final_balance":-1}
  ```
- The GSD gate blocks transition to `Ship` until `PROOF_ATTESTATION.json` is signed.

---

## Configuration (`.planning/gsd-bend.json`)
```json
{
  "version": "1.0.0",
  "engine": "bend-2",
  "strictLock": true,
  "lawsFile": "LAWS.bend",
  "proofFile": "PROOF.bend",
  "attestationOutput": ".planning/PROOF_ATTESTATION.json"
}
```
