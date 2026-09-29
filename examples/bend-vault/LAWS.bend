# ==============================================================================
# LAWS.bend - THE SPECIFICATION (BendVault example)
# ==============================================================================
# A human writes this file. The agent must not edit it: `gsd-bend plan` locks it
# with SHA-256 and `gsd-bend verify` fails if it changed afterwards.
#
# Each law is an open claim: a fact that must hold for EVERY input, not just the
# ones a unit test happens to try. The agent fills each law with a proof in
# PROOF.bend, and `bend PROOF.bend` is the gate.
#
# Verify this example end to end with:
#   bend PROOF.bend              # prints ALL PROOFS CHECK, or SOME PROOFS FAIL
#   gsd-bend verify              # runs the gate and writes the attestation

import Base
import ./src/wallet.bend as Wallet

# Withdrawing nothing changes nothing.
law withdraw_zero_noop:
  for balance: Nat
  {Wallet.withdraw(balance, 0n) == balance : Nat}

# Withdrawing the entire balance empties it exactly - no dust, no underflow.
#
# This is the law that a `balance >= 0` invariant only pretends to state. Over
# `Nat` that weaker claim is true by type; over `U32` it is true because
# subtraction wraps (`0 - 1 : U32` is 4294967295). Either way it says nothing
# about whether the withdrawal was refused. This law is falsifiable: change the
# implementation to return `1n+Nat.sub(bp, ap)` and `bend PROOF.bend` reports
# SOME PROOFS FAIL with the expected and observed terms.
law withdraw_all_empties:
  for balance: Nat
  {Wallet.withdraw(balance, balance) == 0n : Nat}
