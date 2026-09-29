---
name: gsd-bend
description: Formal verification skill using Bendlang proofs integrated with GSD Core to block AI coding mistakes, bypass Goodhart's law, and verify locked invariants across the complete GSD lifecycle before shipping.
---

# GSD-BEND Skill: Full GSD Core Lifecycle with Bend Proofs

## Overview
`gsd-bend` bridges **GSD Core (`open-gsd/gsd-core`)** with **Bend 2 (`bendlang/bend`)**. It provides the complete suite of GSD workflow slash commands and CLI tools, augmented with compiler-verified mathematical proofs so AI agents cannot fake tests, mock out state, or ship vulnerable code.

```
+----------------------------------------------------------------------------------------------------+
|                                GSD CORE + BEND 2 LIFECYCLE                                         |
|                                                                                                    |
|  [Map Codebase] -> [Discuss] -> [Plan & Lock Laws] -> [Execute & Prove] -> [Verify] -> [Ship Gate] |
|        |               |                 |                    |                 |            |     |
|   CODEBASE_MAP.md   DISCUSS.md       LAWS.bend            PROOF.bend       ATTESTATION.json  RELEASE   |
|                                      laws.lock                                                     |
+----------------------------------------------------------------------------------------------------+
```

---

## Why this Skill Exists
Under **Goodhart's Law** (*"When a measure becomes a target, it ceases to be a good measure"*), autonomous coding agents optimize to make unit test runners green rather than writing correct software:
- They test only happy paths (e.g. testing `withdraw(100, 50)` and skipping `withdraw(100, 200)`).
- They edit test assertions or mock databases (`jest.mock`, `vi.mock`) to fake success.
- They merge silent vulnerabilities: balance underflows, illegal state transitions, and solvency collapse.

`gsd-bend` upgrades GSD Core phases with **laws the agent cannot edit**: it locks the spec before the code exists.
1. Human / Spec architect locks invariants in `LAWS.bend` during the **Plan** phase.
2. The agent is forced to supply exhaustive inductive proofs in `PROOF.bend` during the **Execute** phase.
3. The Bend compiler checks the proofs for **all inputs** (not a sample) whenever it is installed.
4. The GSD **Ship** gate refuses to advance without a valid, untampered `PROOF_ATTESTATION.json`.

---

## Full GSD Core Command Suite

All commands support dual slash syntax (`/gsd-bend:<cmd>` or `/gsd-bend-<cmd>`) and CLI invocation (`gsd-bend <cmd>`):

| Phase / Role | Slash Command | CLI Command | Action |
| :--- | :--- | :--- | :--- |
| **New Project** | `/gsd-bend:new-project` or `/gsd-bend-new-project` | `gsd-bend new-project [name]` | Scaffolds a new project with `.planning/`, `LAWS.bend`, `PROOF.bend`, and SHA-256 lock. |
| **Map Codebase** | `/gsd-bend:map-codebase` or `/gsd-bend-map-codebase` | `gsd-bend map-codebase` | Analyzes codebase modules and maps critical state variables for invariant targets. |
| **Discuss** | `/gsd-bend:discuss` or `/gsd-bend-discuss` | `gsd-bend discuss [topic]` | Clarifies domain safety properties, boundary requirements, and logs directives. |
| **Plan** | `/gsd-bend:plan` or `/gsd-bend-plan` | `gsd-bend plan` | Formulates phase plan, defines `LAWS.bend`, locks `laws.lock` (SHA-256), and creates `PLAN.md`. |
| **Execute** | `/gsd-bend:execute` or `/gsd-bend-execute` | `gsd-bend execute` | Validates immutable law locks, guides AI agent to write logic and exhaustive `PROOF.bend`. |
| **Verify** | `/gsd-bend:verify` or `/gsd-bend-verify` | `gsd-bend verify` | Executes formal proof engine, runs anti-cheat audit, and signs `PROOF_ATTESTATION.json`. |
| **Ship** | `/gsd-bend:ship` or `/gsd-bend-ship` | `gsd-bend ship` | Enforces the cryptographic proof gate, creates `SHIP_SUMMARY.md`, and seals release. |
| **Status** | `/gsd-bend:status` or `/gsd-bend-status` | `gsd-bend status` | Displays current phase, law lock status, proof attestation validity, and next step. |
| **Next Step** | `/gsd-bend:next` or `/gsd-bend-next` | `gsd-bend next [--auto]` | Detects project state and guides or automatically advances to the next lifecycle phase. |
| **Quick Check** | `/gsd-bend:quick` or `/gsd-bend-quick` | `gsd-bend quick [law]` | Fast verification check targeting a specific invariant for rapid inner dev loops. |
| **Law Management** | `/gsd-bend:law` or `/gsd-bend-law` | `gsd-bend law [lock\|check\|list]` | Computes canonical hashes, checks immutability, or lists active invariants. |
| **Anti-Cheat Audit**| `/gsd-bend:audit` or `/gsd-bend-audit` | `gsd-bend audit` | Scans for mock injection, unproven axioms, skipped goals, or vacuous proofs. |
| **Self-Healing** | `/gsd-bend:heal` or `/gsd-bend-heal` | `gsd-bend heal` | Generates structured reflection prompt for AI agents on proof failure or counterexample. |
| **Quick Init** | `/gsd-bend:init` or `/gsd-bend-init` | `gsd-bend init` | Scaffolds verification templates into an existing workspace. |

---

## Complete Phase-by-Phase Workflow

### 0. Map Codebase Phase (`/gsd-bend:map-codebase` or `/gsd-bend-map-codebase`)
- Explores existing code to detect modules handling critical state: balances, transfers, permissions, tokens, escrows.
- Emits `.planning/CODEBASE_MAP.md` highlighting invariant targets.

### 1. Discuss Phase (`/gsd-bend:discuss` or `/gsd-bend-discuss`)
- User/architect and agent converse to identify failure modes and boundary conditions.
- Records formalized requirements in `.planning/DISCUSS.md`.

### 2. Plan Phase (`/gsd-bend:plan` or `/gsd-bend-plan`)
- Formulates tasks in `.planning/PLAN.md`.
- Specifies formal invariants in `LAWS.bend`:
  ```bend
  import Base
  import ./src/wallet.bend as Wallet

  # Withdrawing the entire balance empties it exactly.
  # Note: `balance >= 0` would be vacuously true (U32 subtraction wraps), so it
  # proves nothing. State the behaviour you actually care about.
  law withdraw_all_empties:
    for balance: Nat
    {Wallet.withdraw(balance, balance) == 0n : Nat}
  ```
- Automatically computes canonical SHA-256 hash and locks `.planning/laws.lock`.
- Locks laws as immutable for AI agents during the execution phase.

### 3. Execute Phase (`/gsd-bend:execute` or `/gsd-bend-execute`)
- Checks `LAWS.bend` against `laws.lock`. If tampered with, execution immediately halts.
- AI subagent implements program logic and writes `PROOF.bend`:
  ```bend
  # A def with no return type fills the law of the same name.
  def Laws.withdraw_all_empties(balance):
    match balance:
      case 0n:
        {==}
      case 1n+bp:
        Nat.sub_self(bp)
  ```
- Every law must be discharged; the compiler rejects an open claim or a wrong proof.

### 4. Verify Phase (`/gsd-bend:verify` or `/gsd-bend-verify`)
- Invokes the Anti-Goodhart analyzer: flags mocking frameworks (`vi.mock`, `jest.mock`, `sinon`), unproven axioms (`axiom bypass:`), and skipped checks.
- Runs `bend PROOF.bend`. Without a compiler it falls back to the sampled evaluator, which reports `SAMPLED_NO_COUNTEREXAMPLE` rather than a proof.
- If every law is discharged, writes `PROOF_ATTESTATION.json` recording the engine that ran and whether it was signed.

### 5. Ship Phase (`/gsd-bend:ship` or `/gsd-bend-ship`)
- Evaluates `GSDPhaseBridge.canAdvanceToShip()`.
- If proof attestation is missing or invalid, advancement is blocked with actionable error message.
- If valid, writes `.planning/SHIP_SUMMARY.md`, updates GSD state to `completed`, and prepares commit/release.

---

## Anti-Goodhart Cheating Protections

| Cheating Technique | How standard tests fail | How GSD-Bend blocks it |
| :--- | :--- | :--- |
| **Assertion Weakening** | Agent changes `expect(x).toBe(10)` to `toBe(0)` | Invariants in `LAWS.bend` are locked with SHA-256 in `.planning/laws.lock`. Any edit triggers `LAW_LOCK_VIOLATION`. |
| **Happy-Path Sampling** | Agent only tests `withdraw(100, 50)` | Formal laws quantify over every value of every parameter, and a proof must hold for all of them. |
| **Mock Injection** | Agent mocks database or state return | Static AST audit rejects `jest.mock`, `vi.mock`, and dummy shims. |
| **Axiom Cheats** | Agent writes `axiom always_true:` | Unproven axioms are rejected; a law is discharged by a proof term, not an assertion. |

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
