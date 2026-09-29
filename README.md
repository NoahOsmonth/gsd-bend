# GSD-BEND: Blocking AI Agent Mistakes via Formal Mathematical Proofs

[![Tests](https://img.shields.io/badge/tests-26%20passed-brightgreen.svg)]()
[![GSD-Core Compatible](https://img.shields.io/badge/gsd--core-compatible-blue.svg)](https://github.com/open-gsd/gsd-core)
[![Bend 2 Powered](https://img.shields.io/badge/bend--2-formal--proofs-purple.svg)](https://github.com/bendlang/bend)

`gsd-bend` is a formal verification skill and execution engine for **GSD Core (`open-gsd/gsd-core`)** powered by **Bend 2 (`bendlang/bend`)**.

It solves **Goodhart's Law** in autonomous coding agents: rather than allowing AI agents to generate fragile, happy-path unit tests or weaken assertions to get a green checkmark, `gsd-bend` binds the agent's work to **compiler-verified mathematical laws**.

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

1. **Plan Phase:** The human or architect defines mathematical laws in `LAWS.bend`:
   ```bend
   law wallet_never_negative:
     for initial_balance: U32
     for withdraw_amount: U32
     final_balance = Wallet.withdraw(initial_balance, withdraw_amount)
     { (final_balance >= 0) == True : Bool }
   ```
   GSD locks the invariant with a canonical SHA-256 hash into `.planning/laws.lock`.
2. **Execute Phase:** The agent writes the code and must supply the mathematical proof in `PROOF.bend`.
3. **Verify Gate:** GSD runs `gsd-bend verify`:
   - Checks that `LAWS.bend` has not been tampered with.
   - Detects any mock injection or unproven axioms.
   - Proves mathematically that the invariant holds across **100% of all possible inputs**.
   - Generates a signed `PROOF_ATTESTATION.json` unlocking the `Ship` transition.

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
│   └── gsd/
│       └── phase-bridge.js           # Integration with GSD .planning/ state
├── skills/gsd-bend/                  # GSD Core Skill definition & slash commands
├── hooks/gsd-bend-verify-gate.js     # Managed hook for GSD Core verify phase
├── agents/bend-prover.md             # Subagent prompt for writing Bend proofs
├── examples/bend-vault/              # Autonomous Escrow & Vault demonstration
│   ├── LAWS.bend                     # Solvency, non-negative, and transition laws
│   ├── PROOF.bend                    # Inductive proofs
│   ├── src/vault.bend                # Verified Bend implementation
│   ├── src/vault.js                  # Polyglot verified JavaScript runtime
│   └── verify-demo.js                # Interactive demo of all 5 agent failure scenarios
└── tests/                            # Comprehensive test suite (26 unit/e2e tests)
```

---

## Installation & Skill Distribution

You can install `gsd-bend` into any repository's `.agents/skills/` directory using standard agent package tools:

### Method 1: Direct CLI Installation (Self-Contained in any Project)
Inside your target project root:
```bash
# Using npx or node
node /path/to/BEND-GSD/bin/gsd-bend.js install-skill
```
*Creates `.agents/skills/gsd-bend/` and makes formal verification available immediately to any agent in that project.*

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

### CLI Commands
```bash
gsd-bend install-skill # Install skill into .agents/skills/ (-g for global)
gsd-bend init          # Scaffold workspace with LAWS.bend & PROOF.bend
gsd-bend law lock      # Cryptographically lock invariants
gsd-bend law check     # Verify laws immutability
gsd-bend verify        # Run mathematical verification gate
gsd-bend audit         # Scan for Goodhart test falsification
gsd-bend heal          # Generate reflection guidance on failure
```
