/**
 * Scaffolding templates for LAWS.bend and PROOF.bend.
 *
 * These files must be valid Bend. The earlier templates were not: they used
 * `{ (final_balance >= 0) == True : Bool }` with a bare `final_balance =
 * Wallet.withdraw(...)` statement, which is neither a Bend law claim nor a
 * proof, so `bend PROOF.bend` rejected them the moment a real compiler was
 * reachable. The scaffold below is the canonical shape from Bend's own guide —
 * a law is an open claim (`{a == b : T}`), and the paired `def` of the same
 * name is its proof — and it compiles and proves with a stock Bend 2 install.
 *
 * Both `init` and `new-project` write these, so they live here rather than
 * being duplicated and drifting apart.
 */

export const LAWS_TEMPLATE = `# ==============================================================================
# LAWS.bend - THE SPECIFICATION
# ==============================================================================
# A human writes this file. The agent must not edit it: \`gsd-bend plan\` locks it
# with SHA-256 and \`gsd-bend verify\` fails if it changes afterwards.
#
# A law is an open claim: a fact that must hold for EVERY input. The agent fills
# each law with a proof in PROOF.bend. \`bend PROOF.bend\` is the gate: it prints
# SOME PROOFS FAIL while any law is open or false, and ALL PROOFS CHECK once
# every law holds.
#
# Replace the law below with the invariants YOUR code must satisfy.

import Base

# A withdrawal of nothing changes nothing.
#
# Note the shape: in Bend, \`U32\` subtraction wraps (\`0 - 1 : U32\` is
# 4294967295) and every U32 is >= 0 by its type, so a law written as
# \`balance >= 0\` is vacuously true and proves nothing. State the property you
# actually care about instead — that the withdrawal was refused, or (here) that
# \`Nat.sub\`, which saturates at zero, cannot invent balance.
law withdraw_zero_noop:
  for balance: Nat
  {Nat.sub(balance, 0n) == balance : Nat}
`;

export const PROOF_TEMPLATE = `# ==============================================================================
# PROOF.bend - THE PROOFS
# ==============================================================================
# The agent writes this file, alongside the code. Each def fills the law of the
# same name declared in LAWS.bend. Bend refuses a PROOF.bend that sits beside a
# LAWS.bend without importing it.
#
# \`{==}\` proves a goal whose two sides compute to the same term. A failed step
# prints the expected and observed terms; \`?goal\` prints the goal and \`?TODO\`
# leaves it open.

import ./LAWS.bend as Laws

# Case analysis on \`balance\`: the goal reduces to \`0n == 0n\` in the base case
# and to \`1n+p == 1n+p\` in the step case, so reflexivity closes both.
def Laws.withdraw_zero_noop(balance):
  match balance:
    case 0n:
      {==}
    case 1n+p:
      {==}
`;

/**
 * Names of the laws declared in the default template. Kept next to the template
 * so callers and tests do not hardcode a name that the template no longer uses.
 */
export const TEMPLATE_LAW_NAMES = ['withdraw_zero_noop'];
