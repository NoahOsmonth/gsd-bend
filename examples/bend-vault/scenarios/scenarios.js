/**
 * Scenarios demonstrating how AI agents attempt to cheat or bypass tests,
 * and how GSD-Bend mechanically prevents every single one.
 */

export const ScenarioCode = {
  // Scenario 1: Buggy agent with happy-path fake test
  buggyImplementation: {
    // Bug: forgets to check if amount > balance, allows underflow!
    withdraw: (balance, amount) => balance - amount
  },

  fakeHappyPathTest: (withdrawFn) => {
    // Standard unit test written by AI agent
    const balance = 100;
    const result = withdrawFn(balance, 50);
    // Happy path passes!
    return {
      testName: 'test("withdraw credits")',
      passed: result === 50,
      detail: `Initial: 100, Withdrew: 50, Result: ${result}. Unit test PASSED! (Bug overlooked: negative balance)`
    };
  },

  // Scenario 2: Tampered LAWS.bend content
  tamperedLawsContent: `# Modified by AI agent to cheat verification
law wallet_never_negative:
  for initial_balance: U32
  for withdraw_amount: U32
  final_balance = Wallet.withdraw(initial_balance, withdraw_amount)
  { (final_balance >= -999999) == True : Bool }
`,

  // Scenario 3: Non-exhaustive / fake proof
  incompleteProofContent: `
def Laws.wallet_never_negative(initial_balance, withdraw_amount):
  match (withdraw_amount <= initial_balance):
    case True:
      {==}
    # Cheating: agent omitted 'case False:' to hide the underflow bug!
`,

  // Scenario 4: Axiomatic bypass attempt
  axiomaticCheatProofContent: `
axiom bypass_underflow: forall x. x >= 0

def Laws.wallet_never_negative(initial_balance, withdraw_amount):
  apply bypass_underflow
  {==}
`
};
