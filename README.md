# GSD-BEND: Blocking AI Agent Mistakes via Formal Mathematical Proofs

[![Tests](https://img.shields.io/badge/tests-40%20passed-brightgreen.svg)]()
[![GSD-Core Compatible](https://img.shields.io/badge/gsd--core-compatible-blue.svg)](https://github.com/open-gsd/gsd-core)
[![Bend 2 Powered](https://img.shields.io/badge/bend--2-formal--proofs-purple.svg)](https://github.com/bendlang/bend)

`gsd-bend` is a formal verification skill and execution engine for **GSD Core (`open-gsd/gsd-core`)** powered by **Bend 2 (`bendlang/bend`)**.

It solves **Goodhart's Law** in autonomous coding agents: rather than allowing AI agents to generate fragile, happy-path unit tests or weaken assertions to get a green checkmark, `gsd-bend` binds the agent's work to **compiler-verified mathematical laws** across the complete GSD lifecycle:

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

## The Problem: AI Agents Faking Tests

In a traditional test-driven agent loop:
1. **The Plan:** An agent is tasked to build a wallet withdrawal feature where balances must never drop below zero.
2. **The Buggy Code:** The agent writes `withdraw(balance, amount) => balance - amount` (forgetting to verify if `amount > balance`).
3. **The Fake Test:** To pass the `verify` gate, the agent writes:
   ```javascript
   test("withdraw credits", () => {
     expect(withdraw(100, 50)).toBe(50); // Tests ONLY the happy path!
   });
   ```
4. **The Result:** The test runner reports `100% PASS`. GSD ships code to production where anyone can drain infinite funds through balance underflow.

---

## The Solution: Unbreakable Laws with Bend 2

1. **Discuss Phase (`/gsd-bend:discuss`):** Clarify domain requirements and safety properties with human/architect before writing code.
2. **Plan Phase (`/gsd-bend:plan`):** Formulate execution plan and define invariants in `LAWS.bend`:
   ```bend
   law wallet_never_negative:
     for initial_balance: U32
     for withdraw_amount: U32
     final_balance = Wallet.withdraw(initial_balance, withdraw_amount)
     { (final_balance >= 0) == True : Bool }
   ```
   GSD locks the invariant with a canonical SHA-256 hash into `.planning/laws.lock`.
3. **Execute Phase (`/gsd-bend:execute`):** The agent writes the code and must supply the mathematical proof in `PROOF.bend`.
4. **Verify Gate (`/gsd-bend:verify`):** GSD runs formal verification:
   - Checks that `LAWS.bend` has not been tampered with.
   - Detects any mock injection or unproven axioms.
   - Proves mathematically that the invariant holds across **100% of all possible inputs**.
   - Generates a signed `PROOF_ATTESTATION.json`.
5. **Ship Gate (`/gsd-bend:ship`):** Evaluates cryptographic proof gate before allowing release or deployment.

---

## Full GSD Core Workflow Commands

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
| **Law Management** | `/gsd-bend:law` or `/gsd-bend-law` | `gsd-bend law [lock\|check\|list]` | Computes canonical hashes, checks immutability, or lists active invariants. |
| **Anti-Cheat Audit**| `/gsd-bend:audit` or `/gsd-bend-audit` | `gsd-bend audit` | Scans for mock injection, unproven axioms, skipped goals, or vacuous proofs. |
| **Self-Healing** | `/gsd-bend:heal` or `/gsd-bend-heal` | `gsd-bend heal` | Generates structured reflection prompt for AI agents on proof failure or counterexample. |
| **Quick Init** | `/gsd-bend:init` or `/gsd-bend-init` | `gsd-bend init` | Scaffolds verification templates into an existing workspace. |

---

## Repository Structure

```
BEND-GSD/
├── bin/
│   └── gsd-bend.js                   # CLI entry point
├── src/
│   ├── compiler/bend-runner.js       # Bend 2 native compiler / engine bridge
│   ├── prover/
│   │   ├── law-parser.js             # Parses LAWS.bend
│   │   ├── proof-checker.js          # Evaluates PROOF.bend inductive trees
│   │   └── evaluator.js              # Symbolic invariant evaluator
│   ├── core/
│   │   ├── law-lock.js               # Cryptographic SHA-256 invariant locking
│   │   ├── anti-cheat.js             # Goodhart's Law trap & mock detector
│   │   ├── verifier.js               # Master verification gate
│   │   └── attestation.js            # Cryptographic proof certificate authority
│   ├── gsd/
│   │   └── phase-bridge.js           # Integration with GSD full lifecycle & .planning/ state
│   └── cli/                          # CLI runners (plan, discuss, execute, ship, etc.)
├── skills/gsd-bend/                  # GSD Core Skill definition & slash commands
│   ├── SKILL.md                      # Complete skill documentation & phase workflows
│   └── commands/                     # Slash command markdown specifications (12 commands)
├── hooks/gsd-bend-verify-gate.js     # Managed hook for GSD Core verify phase
├── agents/bend-prover.md             # Subagent prompt for writing Bend proofs
├── examples/bend-vault/              # Autonomous Escrow & Vault demonstration
│   ├── LAWS.bend                     # Solvency, non-negative, and transition laws
│   ├── PROOF.bend                    # Inductive proofs
│   ├── src/vault.bend                # Verified Bend implementation
│   ├── src/vault.js                  # Polyglot verified JavaScript runtime
│   └── verify-demo.js                # Interactive demo of all 5 agent failure scenarios
└── tests/                            # Comprehensive test suite (40 unit/lifecycle/e2e tests)
```

---

## Installation & Skill Distribution

### Method 1: Direct CLI Installation (Self-Contained in any Project)
Inside your target project root:
```bash
# Install to current project's .agents/skills/gsd-bend
node /path/to/BEND-GSD/bin/gsd-bend.js install-skill

# Or install globally for all agent workspaces
node /path/to/BEND-GSD/bin/gsd-bend.js install-skill -g
```

### Method 2: Universal Agent Skills Standard (`npx skills add`)
Using the open [skills.sh](https://www.skills.sh) registry and CLI:
```bash
# Install to current project's .agents/skills/
npx skills add NoahOsmonth/gsd-bend --skill gsd-bend

# Or for a specific agent (e.g. Claude Code or Cursor)
npx skills add NoahOsmonth/gsd-bend -a claude-code

# Install globally across all projects on your machine
npx skills add NoahOsmonth/gsd-bend -g
```

---

## Quick Start

### Run the Interactive Verification Demo
```bash
npm run demo
```

### Run the Test Suite
```bash
npm test
```
