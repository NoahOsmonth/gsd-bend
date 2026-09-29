# ==============================================================================
# PROOF.bend - THE PROOFS (BendVault example)
# ==============================================================================
# The agent writes this file, alongside the code. Each def fills the law of the
# same name declared in LAWS.bend; Bend refuses a PROOF.bend that sits beside a
# LAWS.bend without importing it.
#
# `{==}` proves a goal whose two sides compute to the same term. A failed step
# prints the expected and observed terms, which is what makes the gate useful:
# there is no way to assert a proof, only to give one.

import ./LAWS.bend as Laws

# ------------------------------------------------------------------------------
# Helper lemma. This is a proof detail rather than part of the human spec, so it
# lives here instead of in LAWS.bend.
# ------------------------------------------------------------------------------

# a - a = 0, by induction: the goal reduces to `0n == 0n` at the base and to
# `Nat.sub(p, p) == 0n` in the step, which is the induction hypothesis.
law Nat.sub_self:
  for a: Nat
  {Nat.sub(a, a) == 0n : Nat}

def Nat.sub_self(a):
  match a:
    case 0n:
      {==}
    case 1n+p:
      Nat.sub_self(p)

# ------------------------------------------------------------------------------
# Proofs for the laws in LAWS.bend
# ------------------------------------------------------------------------------

# Case analysis on `balance`: the goal reduces to `0n == 0n` in the base case and
# to `1n+bp == 1n+bp` in the step case, so reflexivity closes both.
def Laws.withdraw_zero_noop(balance):
  match balance:
    case 0n:
      {==}
    case 1n+bp:
      {==}

# Case analysis on `balance` exposes `Nat.sub(bp, bp) == 0n` in the step case,
# which is exactly the helper lemma above.
def Laws.withdraw_all_empties(balance):
  match balance:
    case 0n:
      {==}
    case 1n+bp:
      Nat.sub_self(bp)
