/**
 * BendVault JavaScript Runtime (Polyglot Layer)
 * 
 * Implements the exact logic formally verified in vault.bend / LAWS.bend.
 */

export const EscrowState = {
  Created: 'Created',
  Locked: 'Locked',
  Released: 'Released',
  Disputed: 'Disputed',
  Refunded: 'Refunded'
};

export const EscrowAction = {
  Lock: 'Lock',
  Release: 'Release',
  Dispute: 'Dispute',
  Refund: 'Refund',
  Cancel: 'Cancel'
};

export class Wallet {
  /**
   * Withdraws amount from balance. Formally proven: final balance >= 0.
   * @param {number} balance
   * @param {number} amount
   * @returns {number}
   */
  static withdraw(balance, amount) {
    if (amount <= balance) {
      return balance - amount;
    }
    // Invariant protection: reject overdraft
    return balance;
  }
}

export class Vault {
  /**
   * Processes deposits and withdrawals with solvency invariant.
   * @param {number[]} deposits
   * @param {number[]} withdrawals
   * @returns {number}
   */
  static process(deposits, withdrawals) {
    const totalDeposited = deposits.reduce((a, b) => a + b, 0);
    const totalWithdrawn = withdrawals.reduce((a, b) => a + b, 0);

    if (totalWithdrawn <= totalDeposited) {
      return totalDeposited - totalWithdrawn;
    }
    // Invariant protection: cannot process more than reserves
    return totalDeposited;
  }
}

export class Escrow {
  static isValidTransition(fromState, toState) {
    switch (fromState) {
      case EscrowState.Created:
        return toState === EscrowState.Locked || toState === EscrowState.Refunded || toState === EscrowState.Created;
      case EscrowState.Locked:
        return (
          toState === EscrowState.Released ||
          toState === EscrowState.Disputed ||
          toState === EscrowState.Refunded ||
          toState === EscrowState.Locked
        );
      case EscrowState.Released:
        return toState === EscrowState.Released;
      case EscrowState.Disputed:
        return (
          toState === EscrowState.Released ||
          toState === EscrowState.Refunded ||
          toState === EscrowState.Disputed
        );
      case EscrowState.Refunded:
        return toState === EscrowState.Refunded;
      default:
        return false;
    }
  }

  static transition(currentState, action) {
    switch (currentState) {
      case EscrowState.Created:
        if (action === EscrowAction.Lock) return EscrowState.Locked;
        if (action === EscrowAction.Cancel) return EscrowState.Refunded;
        // Direct release without locking is ILLEGAL -> remain in Created
        return EscrowState.Created;

      case EscrowState.Locked:
        if (action === EscrowAction.Release) return EscrowState.Released;
        if (action === EscrowAction.Dispute) return EscrowState.Disputed;
        if (action === EscrowAction.Refund) return EscrowState.Refunded;
        return EscrowState.Locked;

      default:
        return currentState;
    }
  }
}

// Polyglot alias for Bend snake_case function calls
Escrow.is_valid_transition = Escrow.isValidTransition;

