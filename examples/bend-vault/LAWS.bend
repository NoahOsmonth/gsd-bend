# ==============================================================================
# LAWS.bend - BendVault Mathematical Invariants
# ==============================================================================
# Invariants formally defined during GSD Plan Phase. Locked by SHA-256.

law wallet_never_negative:
  for initial_balance: U32
  for withdraw_amount: U32
  final_balance = Wallet.withdraw(initial_balance, withdraw_amount)
  { (final_balance >= 0) == True : Bool }

law vault_solvency:
  for deposits: List<U32>
  for withdrawals: List<U32>
  total_deposited = List.sum(deposits)
  total_withdrawn = List.sum(withdrawals)
  valid = (total_withdrawn <= total_deposited)
  vault_balance = Vault.process(deposits, withdrawals)
  { (valid == True) -> (vault_balance == (total_deposited - total_withdrawn)) : Bool }

law escrow_state_transition:
  for action: EscrowAction
  for state: EscrowState
  next_state = Escrow.transition(state, action)
  { Escrow.is_valid_transition(state, next_state) == True : Bool }
