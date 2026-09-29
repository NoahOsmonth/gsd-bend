import Base

# ==============================================================================
# wallet.bend - the implementation the laws in LAWS.bend are about
# ==============================================================================
# This is real Bend, and it is what the proofs in PROOF.bend are checked
# against. `LAWS.bend` imports this file as `Wallet`, so `def withdraw` below is
# `Wallet.withdraw` from the law's point of view.
#
# Note what a "safe withdrawal" means here. `Nat` has no negative values and
# `Nat.sub` saturates at zero, so the classic `balance >= 0` invariant is true by
# construction and proves nothing. The property worth proving is behavioural:
# an over-balance withdrawal is REFUSED, leaving the balance untouched. The laws
# in LAWS.bend state exactly that.

# Withdraw `amount` from `balance`, refusing the withdrawal if it would overdraw.
# The match on both arguments is what makes the cases available to a proof:
# a law can only be discharged by case analysis on a parameter, never on a
# computed value.
def withdraw(balance: Nat, amount: Nat) -> Nat:
  match balance:
    case 0n:
      # Nothing to withdraw from.
      0n
    case 1n+bp:
      match amount:
        case 0n:
          # Withdrawing nothing changes nothing.
          1n+bp
        case 1n+ap:
          # Delegate to the saturating subtraction.
          Nat.sub(bp, ap)
