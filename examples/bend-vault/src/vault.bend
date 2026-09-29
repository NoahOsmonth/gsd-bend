# ==============================================================================
# BendVault: Formally Verified Financial Engine in Bend 2
# ==============================================================================

# Data types
type EscrowState = Created | Locked | Released | Disputed | Refunded
type EscrowAction = Lock | Release | Dispute | Refund | Cancel

object Wallet:
  # Mathematically safe withdrawal enforcing non-negative balance
  def withdraw(balance: U32, amount: U32) -> U32:
    if amount <= balance:
      return balance - amount
    else:
      return balance

object Vault:
  # Process deposits and withdrawals with solvency invariant
  def process(deposits: List<U32>, withdrawals: List<U32>) -> U32:
    total_d = List.sum(deposits)
    total_w = List.sum(withdrawals)
    if total_w <= total_d:
      return total_d - total_w
    else:
      return total_d

object Escrow:
  # Valid transition check
  def is_valid_transition(from_state: EscrowState, to_state: EscrowState) -> Bool:
    match from_state:
      case EscrowState.Created:
        return (to_state == EscrowState.Locked) || (to_state == EscrowState.Refunded) || (to_state == EscrowState.Created)
      case EscrowState.Locked:
        return (to_state == EscrowState.Released) || (to_state == EscrowState.Disputed) || (to_state == EscrowState.Refunded) || (to_state == EscrowState.Locked)
      case EscrowState.Released:
        return to_state == EscrowState.Released
      case EscrowState.Disputed:
        return (to_state == EscrowState.Released) || (to_state == EscrowState.Refunded) || (to_state == EscrowState.Disputed)
      case EscrowState.Refunded:
        return to_state == EscrowState.Refunded

  # State transition function
  def transition(current_state: EscrowState, action: EscrowAction) -> EscrowState:
    match current_state:
      case EscrowState.Created:
        match action:
          case EscrowAction.Lock:
            return EscrowState.Locked
          case EscrowAction.Cancel:
            return EscrowState.Refunded
          case _:
            # Direct release without locking is ILLEGAL -> remain Created
            return EscrowState.Created

      case EscrowState.Locked:
        match action:
          case EscrowAction.Release:
            return EscrowState.Released
          case EscrowAction.Dispute:
            return EscrowState.Disputed
          case EscrowAction.Refund:
            return EscrowState.Refunded
          case _:
            return EscrowState.Locked

      case _:
        return current_state
