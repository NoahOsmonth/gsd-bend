# Developer Guide: Building Reliable Autonomous Agents with GSD + Bend

## 1. Introduction

In standard agentic engineering workflows, autonomous agents (like Claude Code) are guided by testing loops. Agents are notorious for "faking tests":
- They write tests for the simplest happy path.
- When an edge case fails, they weaken or delete the assertion rather than fixing the code.
- They mock out critical subsystems to produce artificial green checkmarks.

`gsd-bend` changes what the agent is allowed to move:

1. **Mathematical laws** are written by the human in `LAWS.bend` during the Plan phase.
2. The laws are locked with a canonical SHA-256 hash in `.planning/laws.lock`. The agent can no
   longer edit the spec — not to weaken it, not to delete it.
3. The agent must supply a proof for each law in `PROOF.bend` during the Execute phase.
4. The verify gate runs `bend PROOF.bend`, which prints `ALL PROOFS CHECK` only when every law is
   discharged for **all** inputs, and `SOME PROOFS FAIL` otherwise.

The lock is what resists Goodharting. The compiler is what makes the pass meaningful. Neither one
replaces the other, and neither one is a substitute for the limits in §7.

---

## 2. Installation & Quick Start

Install the Bend compiler first — without it there is no proof checker, only a sampled tripwire:

```bash
bend version    # see https://bend-lang.com/ for install instructions
```

### Initializing a Project
```bash
gsd-bend init
```
This generates:
- `LAWS.bend`: your law specification file.
- `PROOF.bend`: your proof file.
- `.planning/laws.lock`: the SHA-256 integrity lock.

Both files are valid Bend and prove out of the box, so the loop works before you have written
anything of your own. Replace the placeholder law with your real invariants.

---

## 3. Writing Laws (`LAWS.bend`)

A law is an open claim: a fact that must hold for **every** input, not just the ones a test happens
to try. It is a *type*, not a boolean expression.

```bend
# LAWS.bend
import Base
import ./src/wallet.bend as Wallet

# Withdrawing the entire balance empties it exactly.
law withdraw_all_empties:
  for balance: Nat
  {Wallet.withdraw(balance, balance) == 0n : Nat}
```

Two things to notice, because they are where most Bend laws go wrong:

- **The claim is a type.** `{a == b : T}` is an equality proposition, and the proof will be a def of
  that type. It is not `{ some_bool_expr }`.
- **A vacuous law is worse than no law.** `balance >= 0` looks like the classic balance invariant,
  but over `Nat` it is true by construction and over `U32` it is true because subtraction wraps
  (`0 - 1 : U32` is `4294967295`). It proves nothing about whether a withdrawal was refused.
  State the behaviour you actually care about — that the withdrawal was refused, or that the
  balance changed by exactly the amount withdrawn.

Lock the laws once agreed upon:
```bash
gsd-bend law lock
```

---

## 4. Writing Proofs (`PROOF.bend`)

The agent writes the implementation and the proof. Bend has no tactics: a proposition is a type, and
a proof is a def of that type. A `def` with no return type fills the law of the same name, and
`bend` refuses a `PROOF.bend` that sits beside a `LAWS.bend` without importing it.

```bend
# PROOF.bend
import ./LAWS.bend as Laws

# Helper lemma (a proof detail, not part of the human spec).
law Nat.sub_self:
  for a: Nat
  {Nat.sub(a, a) == 0n : Nat}

def Nat.sub_self(a):
  match a:
    case 0n:
      {==}
    case 1n+p:
      Nat.sub_self(p)

# Case analysis on `balance` exposes `Nat.sub(bp, bp) == 0n` in the step case.
def Laws.withdraw_all_empties(balance):
  match balance:
    case 0n:
      {==}
    case 1n+bp:
      Nat.sub_self(bp)
```

Useful things to know when a proof does not go through:
- `{==}` proves a goal whose two sides compute to the same term.
- A failed step prints `expected` and `observed`; read them, they usually point straight at the bug.
- `%e : P` rewrites the goal with `e`, where `P` marks the rewritten position with `_`.
- `?goal` prints the goal; `?TODO` leaves it open (and `bend` then reports the file as incomplete).
- Only a `def` with **no return type** fills a law.
- A `match` can only scrutinise a parameter, never a computed value — restructure the
  implementation so the cases you need are visible in the arguments.

---

## 5. Verification Gate (`gsd-bend verify`)

Before advancing to `Ship`, run:
```bash
gsd-bend verify
```

If the implementation breaks a law, the compiler says so and prints the terms it could not match:

```text
❌ GSD-BEND VERIFICATION GATE: FAILED
Failed Step: COMPILER_PROOF_VERIFICATION
Error: SOME PROOFS FAIL
- expected : {1n+Nat.sub(bp, bp) == 0n : Nat}
- observed : {Nat.sub(bp, bp) == 0n : Nat}
```

When every law is discharged, the gate reports what actually ran:

```text
✅ GSD-BEND VERIFICATION GATE: PASSED
Runner:           Native Bend Compiler (bend 2.0.34)
Verified Laws:    withdraw_zero_noop, withdraw_all_empties
Attestation File: .planning/PROOF_ATTESTATION.json
Status:           PROOFS_CHECKED
Coverage:         ALL_INPUTS_CHECKED_BY_BEND
Attestation:      UNSIGNED checksum 5d94ef5c11efc0e5... - integrity only
                  Set GSD_BEND_ATTESTATION_KEY to sign this certificate.
```

Two fields matter:

- `Coverage` is `ALL_INPUTS_CHECKED_BY_BEND` when the compiler checked the proofs, or
  `SAMPLED_<n>_VALUES_PER_PARAM` when the built-in evaluator fell back to sampling. A sampled run
  is a tripwire, not a proof.
- `Attestation` is either `HMAC-SHA256 signed` (when `GSD_BEND_ATTESTATION_KEY` is set) or an
  `UNSIGNED checksum` that detects edits but proves nothing about who issued it. Set
  `GSD_BEND_REQUIRE_SIGNATURE=1` to make the ship gate refuse an unsigned certificate.

### Environment variables

| Variable | Effect |
| :--- | :--- |
| `GSD_BEND_ENGINE` | `auto` (default), `bend`, or `builtin`. `bend` turns a missing compiler into an error instead of a silent downgrade. |
| `GSD_BEND_SAMPLES` | Comma-separated integers to widen the sampled domain, e.g. `0,1,2,100,101,4294967295`. |
| `GSD_BEND_ATTESTATION_KEY` | Key for the HMAC-signed attestation. Unset means an unkeyed checksum. |
| `GSD_BEND_REQUIRE_SIGNATURE` | `1` makes the ship gate require a signed attestation. |
| `GSD_BEND_VERDICT` | `1` adds `--verdict` to the Bend run, re-checking proofs with the Lean-verified kernel (needs a Lean toolchain). |

---

## 6. Running the Demo Application

An example application (`BendVault`) is included in `examples/bend-vault`. To run the interactive
demo:
```bash
npm run demo
```
It walks through the agent failure scenarios — a fake unit test passing, the real compiler rejecting
the same buggy implementation, spec tampering caught by the law lock, and an incomplete proof
rejected — and finishes by stating exactly what the passing certificate does and does not cover.

---

## 7. Verification Limits

Read this before treating a green gate as a guarantee.

- **A law can hold and still be worthless.** See §3: `balance >= 0` over `U32` is vacuously true.
  The gate checks that your laws are *proved*, not that they are *meaningful*. That judgement is
  yours, which is why the human writes `LAWS.bend` and the agent does not.
- **Coverage stops at the `.bend` files.** Nothing in this tool verifies JavaScript, TypeScript or
  Python. `examples/bend-vault/src/vault.js` and its escrow state machine are outside the proof and
  need their own tests.
- **Without a Bend compiler there is no proof.** The built-in evaluator samples a handful of values
  per parameter. It reports `SAMPLED_NO_COUNTEREXAMPLE` and cannot evaluate real-Bend laws that use
  Base builtins, so a project verified with it is not verified.
- **An unsigned certificate proves integrity, not provenance.** Anyone who can write the file can
  recompute an unkeyed checksum. Configure a key if you need to know who issued it.
