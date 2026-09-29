# GSD-BEND: Blocking AI Agent Mistakes via Bend Proofs

[![Tests](https://img.shields.io/badge/tests-50%20passed-brightgreen.svg)]()
[![GSD-Core Compatible](https://img.shields.io/badge/gsd--core-compatible-blue.svg)](https://github.com/open-gsd/gsd-core)
[![Bend 2 Powered](https://img.shields.io/badge/bend--2-proof%20checker-purple.svg)](https://bend-lang.com/)

`gsd-bend` is a verification skill and execution engine for **GSD Core (`open-gsd/gsd-core`)** that drives the **Bend 2 compiler (`bendlang/bend`)**.

It targets **Goodhart's Law** in autonomous coding agents. Rather than letting an agent write a happy-path unit test, or weaken an assertion until it passes, `gsd-bend` binds the agent's work to **laws the human wrote and locked first**, and requires a **proof the compiler accepts**:

```
+----------------------------------------------------------------------------------------------------+
|                                GSD CORE + BEND 2 LIFECYCLE                                          |
|                                                                                                     |
|  [Map Codebase] -> [Discuss] -> [Plan & Lock Laws] -> [Execute & Prove] -> [Verify] -> [Ship Gate]   |
|        |               |                 |                    |                 |            |        |
|   CODEBASE_MAP.md   DISCUSS.md       LAWS.bend            PROOF.bend      ATTESTATION.json  RELEASE   |
|                                      laws.lock                                                      |
+----------------------------------------------------------------------------------------------------+
```

---

## The Problem: AI Agents Faking Tests

In a traditional test-driven agent loop:
1. **The Plan:** An agent is tasked to build a wallet withdrawal feature where balances must never drop below zero.
2. **The Buggy Code:** The agent writes `withdraw(balance, amount) => balance - amount` (forgetting to check `amount > balance`).
3. **The Fake Test:** To pass the `verify` gate, the agent writes:
   ```javascript
   test("withdraw credits", () => {
     expect(withdraw(100, 50)).toBe(50); // Tests ONLY the happy path!
   });
   ```
4. **The Result:** The test runner reports `100% PASS`, and the underflow ships.

---

## The Solution: Laws the Agent Cannot Move

1. **Discuss Phase (`/gsd-bend:discuss`):** Clarify domain requirements and safety properties with the human before any code exists.
2. **Plan Phase (`/gsd-bend:plan`):** State the invariants in `LAWS.bend` and lock them:
   ```bend
   import Base
   import ./src/wallet.bend as Wallet

   law withdraw_all_empties:
     for balance: Nat
     {Wallet.withdraw(balance, balance) == 0n : Nat}
   ```
   GSD hashes the spec with canonical SHA-256 into `.planning/laws.lock`. From here on the
   agent cannot edit `LAWS.bend` — not to weaken it, not to delete it.
3. **Execute Phase (`/gsd-bend:execute`):** The agent writes the code *and* the proof in `PROOF.bend`.
4. **Verify Gate (`/gsd-bend:verify`):** GSD checks that `LAWS.bend` is untouched, audits for mock
   injection and unproven axioms, then runs `bend PROOF.bend`. Bend prints `ALL PROOFS CHECK` only
   when every law is discharged for **all** inputs, and writes `PROOF_ATTESTATION.json` either way.
5. **Ship Gate (`/gsd-bend:ship`):** Refuses to advance without a valid, untampered attestation.

The gate is the compiler's verdict, not a claim this tool makes about itself. Change the
implementation so a law no longer holds and the proof stops going through:

```text
$ bend PROOF.bend
SOME PROOFS FAIL
Error:
- expected : {1n+Nat.sub(bp, bp) == 0n : Nat}
- observed : {Nat.sub(bp, bp) == 0n : Nat}
```

---

## Verification Limits — Read This Before Trusting a Certificate

This is the part most proof-gate tooling leaves out. What `gsd-bend` gives you:

- **The spec is locked before the code exists.** This is the part that actually resists
  Goodharting: an agent can still write bad code, but it cannot move the target afterwards.
- **When Bend is installed, the proofs are real.** Bend checks them for all inputs, and a wrong
  implementation produces a compiler error rather than a green checkmark.

What it does **not** give you:

- **A law can be true and still worthless.** `balance >= 0` over `U32` is vacuously true:
  every `U32` is `>= 0` by its type, and `0 - 1 : U32` is `4294967295` because subtraction wraps.
  It proves nothing about whether a withdrawal was refused. The example laws in
  `examples/bend-vault/LAWS.bend` are written to be falsifiable for exactly this reason.
- **It verifies `LAWS.bend`, and nothing else.** Code outside the `.bend` files — including
  `examples/bend-vault/src/vault.js` and its escrow state machine — is not covered.
- **No Bend compiler means no proof.** Without one, `gsd-bend` falls back to a built-in evaluator
  that samples a handful of values per parameter. It reports
  `SAMPLED_NO_COUNTEREXAMPLE` and `SAMPLED_5_VALUES_PER_PARAM`, never a proof, and it cannot
  check the real-Bend laws above (they use Base builtins). Treat it as a tripwire, not a gate.
  Widen the sample with `GSD_BEND_SAMPLES=0,1,2,100,101,4294967295`.
- **The attestation is not signed by default.** With no `GSD_BEND_ATTESTATION_KEY` set, the
  certificate is an unkeyed SHA-256 checksum: it detects accidental edits and proves nothing about
  who issued it. The certificate records `signed: false` and `signatureKind: unkeyed-checksum`, and
  `gsd-bend status` reports it as `VALID (unsigned checksum)`. Set the key (and optionally
  `GSD_BEND_REQUIRE_SIGNATURE=1` to make the ship gate demand it) for a real HMAC signature.

---

## Full GSD Core Workflow Commands

All commands support dual slash syntax (`/gsd-bend:<cmd>` or `/gsd-bend-<cmd>`) and CLI invocation (`gsd-bend <cmd>`):

| Phase / Role | Slash Command | CLI Command | Action |
| :--- | :--- | :--- | :--- |
| **New Project** | `/gsd-bend:new-project` or `/gsd-bend-new-project` | `gsd-bend new-project [name]` | Scaffolds a new project with `.planning/`, `LAWS.bend`, `PROOF.bend`, and SHA-256 lock. |
| **Map Codebase** | `/gsd-bend:map-codebase` or `/gsd-bend-map-codebase` | `gsd-bend map-codebase` | Analyzes codebase modules and maps critical state variables for invariant targets. |
| **Discuss** | `/gsd-bend:discuss` or `/gsd-bend-discuss` | `gsd-bend discuss [topic]` | Clarifies domain safety properties, boundary requirements, and logs directives. |
| **Plan** | `/gsd-bend:plan` or `/gsd-bend-plan` | `gsd-bend plan` | Formulates phase plan, defines `LAWS.bend`, locks `laws.lock` (SHA-256), and creates `PLAN.md`. |
| **Execute** | `/gsd-bend:execute` or `/gsd-bend-execute` | `gsd-bend execute` | Validates immutable law locks, guides the agent to write logic and proofs in `PROOF.bend`. |
| **Verify** | `/gsd-bend:verify` or `/gsd-bend-verify` | `gsd-bend verify` | Runs the proof gate and anti-cheat audit, and issues `PROOF_ATTESTATION.json`. |
| **Ship** | `/gsd-bend:ship` or `/gsd-bend-ship` | `gsd-bend ship` | Enforces the proof gate, creates `SHIP_SUMMARY.md`, and seals release. |
| **Status** | `/gsd-bend:status` or `/gsd-bend-status` | `gsd-bend status` | Displays current phase, law lock status, proof attestation validity, and next step. |
| **Next Step** | `/gsd-bend:next` or `/gsd-bend-next` | `gsd-bend next [--auto]` | Detects project state and guides or automatically advances to the next lifecycle phase. |
| **Quick Check** | `/gsd-bend:quick` or `/gsd-bend-quick` | `gsd-bend quick [law]` | Fast verification check targeting a specific invariant for rapid inner dev loops. |
| **Law Management** | `/gsd-bend:law` or `/gsd-bend-law` | `gsd-bend law [lock\|check\|list]` | Computes canonical hashes, checks immutability, or lists active invariants. |
| **Anti-Cheat Audit**| `/gsd-bend:audit` or `/gsd-bend-audit` | `gsd-bend audit` | Scans for mock injection, unproven axioms, skipped goals, or vacuous proofs. |
| **Self-Healing** | `/gsd-bend:heal` or `/gsd-bend-heal` | `gsd-bend heal` | Generates a structured reflection prompt for the agent on proof failure. |
| **Quick Init** | `/gsd-bend:init` or `/gsd-bend-init` | `gsd-bend init` | Scaffolds verification templates into an existing workspace. |

---

## Repository Structure

```
gsd-bend/
├── bin/
│   └── gsd-bend.js                   # CLI entry point
├── src/
│   ├── compiler/bend-runner.js       # Runs `bend PROOF.bend`; falls back to the sampled evaluator
│   ├── prover/
│   │   ├── law-parser.js             # Parses LAWS.bend
│   │   ├── proof-checker.js          # Sampled evaluator's proof checks (not a proof checker)
│   │   └── evaluator.js              # Sampled invariant evaluator + Base builtin bridge
│   ├── core/
│   │   ├── templates.js              # The scaffolded LAWS.bend / PROOF.bend (valid Bend)
│   │   ├── law-lock.js               # SHA-256 invariant locking
│   │   ├── anti-cheat.js             # Goodhart's Law trap & mock detector
│   │   ├── verifier.js               # Master verification gate
│   │   └── attestation.js            # Proof certificate (HMAC with a configured key, else checksum)
│   ├── gsd/
│   │   └── phase-bridge.js           # Integration with GSD lifecycle & .planning/ state
│   └── cli/                          # CLI runners (plan, discuss, execute, ship, etc.)
├── skills/gsd-bend/                  # Skill definition & slash commands
│   ├── SKILL.md
│   └── commands/                     # Slash command markdown specifications
├── hooks/gsd-bend-verify-gate.js     # Managed hook for GSD Core verify phase
├── agents/bend-prover.md             # Subagent prompt for writing Bend proofs
├── examples/bend-vault/              # Worked example: laws, proofs, and a failing implementation
│   ├── LAWS.bend                     # The human spec (real Bend laws)
│   ├── PROOF.bend                    # The proofs the agent writes
│   ├── src/wallet.bend               # The implementation the proofs are checked against
│   ├── src/vault.js                  # Polyglot runtime used by the sampled-evaluator scenarios
│   └── verify-demo.js                # Demo of the agent failure scenarios
└── tests/                            # Unit, lifecycle and end-to-end tests
```

---

## Installation & Skill Distribution

### Method 1: Direct CLI Installation (Self-Contained in any Project)
Inside your target project root:
```bash
# Install to the current project's .agents/skills/gsd-bend
node /path/to/gsd-bend/bin/gsd-bend.js install-skill

# Or install globally for all agent workspaces
node /path/to/gsd-bend/bin/gsd-bend.js install-skill -g
```

### Method 2: Universal Agent Skills Standard (`npx skills add`)
Using the open [skills.sh](https://www.skills.sh) registry and CLI:
```bash
# Install to the current project's .agents/skills/
npx skills add NoahOsmonth/gsd-bend --skill gsd-bend

# Or for a specific agent (e.g. Claude Code or Cursor)
npx skills add NoahOsmonth/gsd-bend -a claude-code

# Install globally across all projects on your machine
npx skills add NoahOsmonth/gsd-bend -g
```

---

## Quick Start

Install the Bend compiler first — it is what makes the proofs real:
```bash
# see https://bend-lang.com/ for your platform
bend version
```

### Run the Interactive Verification Demo
```bash
npm run demo
```

### Run the Test Suite
```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).
