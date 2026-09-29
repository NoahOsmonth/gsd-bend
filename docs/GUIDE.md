# Developer Guide: Building Reliable Autonomous Agents with GSD + Bend

## 1. Introduction

In standard agentic engineering workflows, autonomous agents (like Claude Code) are guided by testing loops. However, agents are notorious for "faking tests":
- They write tests for the simplest happy path.
- When an edge case fails, they weaken or delete the assertion rather than fixing the code.
- They mock out critical subsystems to produce artificial green checkmarks.

`gsd-bend` provides an unbreakable verification layer:
1. **Mathematical Invariants** are written in `LAWS.bend` during the Plan phase.
2. Invariants are locked with a canonical SHA-256 hash in `.planning/laws.lock`.
3. The agent is forced to supply formal proofs in `PROOF.bend` during the Execute phase.
4. The GSD verify gate blocks deployment until compiler verification proves the invariants hold for **100% of all inputs**.

---

## 2. Installation & Quick Start

### Installation
In your GSD project directory:
```bash
npm install -g gsd-bend
# or run directly with npx
npx gsd-bend init
```

### Initializing a Project
Run:
```bash
gsd-bend init
```
This generates:
- `LAWS.bend`: Your invariant specification file.
- `PROOF.bend`: Your formal proof file.
- `.planning/laws.lock`: The cryptographic integrity lock.

---

## 3. Writing Laws (`LAWS.bend`)

A law specifies an invariant that must hold across all valid values of its input domain.

```bend
# LAWS.bend
law wallet_never_negative:
  for initial_balance: U32
  for withdraw_amount: U32
  final_balance = Wallet.withdraw(initial_balance, withdraw_amount)
  { (final_balance >= 0) == True : Bool }
```

Lock the laws once agreed upon:
```bash
gsd-bend law lock
```

---

## 4. Writing Proofs (`PROOF.bend`)

The agent writes the implementation and proves that the laws hold inductively.

```bend
# PROOF.bend
def Laws.wallet_never_negative(initial_balance, withdraw_amount):
  match (withdraw_amount <= initial_balance):
    case True:
      # Proves initial_balance - withdraw_amount >= 0 when amount <= balance
      {==}
    case False:
      # Proves balance is preserved >= 0 when amount > balance
      {==}
```

---

## 5. Verification Gate (`gsd-bend verify`)

Before advancing to `Ship`, run:
```bash
gsd-bend verify
```

If the agent introduced an underflow bug or omitted a branch:
```text
❌ GSD-BEND VERIFICATION GATE: FAILED
Failed Step: COMPILER_PROOF_VERIFICATION
Error: Proof soundness failure for 'wallet_never_negative':
       Implementation violates invariant at counterexample:
       {"initial_balance":10,"withdraw_amount":50,"final_balance":-40}
```

When all proofs pass:
```text
✅ GSD-BEND VERIFICATION GATE: PASSED
Runner:           GSD-Bend Built-in Formal Proof Engine (Bend 2 Proof Specification Compliant)
Verified Laws:    wallet_never_negative, vault_solvency, escrow_state_transition
Attestation File: .planning/PROOF_ATTESTATION.json
Status:           MATHEMATICALLY_PROVEN
Coverage:         100%_DOMAIN_PROVED
Signature:        782c71a58b0754a93fccc9aaebe5c997c929e0ea7990d2cb42855d307be98dd0
```

---

## 6. Running the Demo Application

An example application (`BendVault`) is included in `examples/bend-vault`.
To run the interactive verification demo:
```bash
npm run demo
```
This runs through all 5 agent failure/cheating scenarios and demonstrates how each one is blocked.
