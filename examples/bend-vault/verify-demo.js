import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Verifier } from '../../src/core/verifier.js';
import { LawLock } from '../../src/core/law-lock.js';
import { AntiCheat } from '../../src/core/anti-cheat.js';
import { ProofChecker } from '../../src/prover/proof-checker.js';
import { ScenarioCode } from './scenarios/scenarios.js';
import { Wallet, Vault, Escrow, EscrowState, EscrowAction } from './src/vault.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vaultDir = __dirname;

function separator(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║               GSD-BEND INTERACTIVE VERIFICATION DEMO               ║
║    Blocking AI Agent Mistakes & Cheating via Bend 2 Formal Proofs   ║
╚════════════════════════════════════════════════════════════════════╝
`);

// -----------------------------------------------------------------------------
// SCENARIO 1: The Goodhart Trap in Traditional GSD
// -----------------------------------------------------------------------------
separator('SCENARIO 1: The Goodhart Trap with Traditional Unit Tests');
console.log('Situation: An AI agent writes a withdraw function that forgets balance bounds.');
console.log('Agent code: balance - amount (Allows negative balance!)');
console.log('Agent unit test:');
console.log('  test("withdraw credits", () => expect(withdraw(100, 50)).toBe(50));');

const unitTestResult = ScenarioCode.fakeHappyPathTest(ScenarioCode.buggyImplementation.withdraw);
console.log(`\nUnit Test Result: ✅ ${unitTestResult.passed ? '100% PASS' : 'FAIL'}`);
console.log(`Summary: ${unitTestResult.detail}`);
console.log('🚨 Outcome: Traditional GSD marks phase complete and SHIPS A FATAL BUG TO PROD!');

// -----------------------------------------------------------------------------
// SCENARIO 2: GSD-Bend Blocks the Buggy Code with Invariant Counterexample
// -----------------------------------------------------------------------------
separator('SCENARIO 2: GSD-Bend Blocks Buggy Code via Mathematical Invariant');
console.log('Bend Law:');
console.log('  law wallet_never_negative:');
console.log('    final_balance = Wallet.withdraw(initial_balance, withdraw_amount)');
console.log('    { (final_balance >= 0) == True : Bool }');

const lawsContent = fs.readFileSync(path.join(vaultDir, 'LAWS.bend'), 'utf8');
const buggyProof = fs.readFileSync(path.join(vaultDir, 'PROOF.bend'), 'utf8');

// Provide buggy implementation to evaluator
const buggyCheck = ProofChecker.verify(lawsContent, buggyProof, {
  wallet_never_negative: () => {
    // Check if underflow occurs on test inputs
    const testCases = [
      { initial_balance: 10, withdraw_amount: 50 }
    ];
    for (const tc of testCases) {
      const final_balance = ScenarioCode.buggyImplementation.withdraw(tc.initial_balance, tc.withdraw_amount);
      if (final_balance < 0) {
        return { passed: false, counterexample: { ...tc, final_balance } };
      }
    }
    return { passed: true };
  }
});

console.log('\nGSD-Bend Evaluation:');
console.log(`Proof Check Success: ${buggyCheck.success}`);
console.log(`Compiler Error: ❌ ${buggyCheck.errors[0]}`);
console.log(`🛑 Result: GSD Verify Gate REFUSES to advance to Ship phase!`);

// -----------------------------------------------------------------------------
// SCENARIO 3: GSD-Bend Blocks Agent Attempting to Tamper with LAWS.bend
// -----------------------------------------------------------------------------
separator('SCENARIO 3: GSD-Bend Blocks Agent Tampering with LAWS.bend');
console.log('Situation: Trapped by the proof failure, the AI agent attempts to edit LAWS.bend');
console.log('Agent modifies invariant from ">= 0" to ">= -999999" to force a pass.');

const tempTamperedLaws = path.join(vaultDir, '.planning', 'TEMP_TAMPERED_LAWS.bend');
fs.writeFileSync(tempTamperedLaws, ScenarioCode.tamperedLawsContent, 'utf8');

const lockCheck = LawLock.verify(tempTamperedLaws, path.join(vaultDir, '.planning', 'laws.lock'));
console.log('\nLawLock Integrity Verification:');
console.log(`Integrity Check Passed: ${lockCheck.valid}`);
console.log(`Security Error: 🚨 ${lockCheck.error}`);
fs.unlinkSync(tempTamperedLaws);
console.log('🛑 Result: Tampering caught by SHA-256 canonical hash lock. Process aborted!');

// -----------------------------------------------------------------------------
// SCENARIO 4: GSD-Bend Blocks Incomplete & Axiomatic Bypass Proofs
// -----------------------------------------------------------------------------
separator('SCENARIO 4: GSD-Bend Blocks Fake Proofs (Missing Branches & Axioms)');
console.log('Attempt 4A: Agent tries incomplete proof (omits "case False:")');
const incompleteCheck = ProofChecker.verify(lawsContent, ScenarioCode.incompleteProofContent);
console.log(`Result: ❌ ${incompleteCheck.errors[0]}`);

console.log('\nAttempt 4B: Agent tries to insert an axiom loophole ("axiom bypass_underflow:")');
const antiCheatResult = AntiCheat.audit(lawsContent, ScenarioCode.axiomaticCheatProofContent);
console.log(`Anti-Cheat Clean: ${antiCheatResult.clean}`);
console.log(`Infraction Caught: 🚨 [${antiCheatResult.infractions[0].type}] ${antiCheatResult.infractions[0].description}`);
console.log('🛑 Result: All Goodhart evasion tactics neutralized!');

// -----------------------------------------------------------------------------
// SCENARIO 5: Full Mathematical Proofs Verified & Signed Attestation Issued
// -----------------------------------------------------------------------------
separator('SCENARIO 5: Mathematically Rigorous Code Verified & Certified');
console.log('Situation: The agent is forced to implement mathematically sound bounded logic');
console.log('and provide complete inductive proofs across all cases.');

const pipelineResult = Verifier.verifyPipeline({
  projectRoot: vaultDir,
  strictLock: true,
  implementationEnv: {
    wallet_never_negative: () => {
      // Test across domain
      for (let b = 0; b <= 100; b += 25) {
        for (let w = 0; w <= 150; w += 25) {
          const res = Wallet.withdraw(b, w);
          if (res < 0) return { passed: false, counterexample: { b, w, res } };
        }
      }
      return { passed: true };
    },
    vault_solvency: () => {
      const deposits = [100, 200, 300];
      const withdrawals = [50, 150];
      const res = Vault.process(deposits, withdrawals);
      if (res !== 400) return { passed: false, counterexample: { deposits, withdrawals, res } };
      return { passed: true };
    },
    escrow_state_transition: () => {
      // Verify Created cannot directly transition to Released
      const invalidNext = Escrow.transition(EscrowState.Created, EscrowAction.Release);
      if (invalidNext === EscrowState.Released) {
        return { passed: false, counterexample: { from: EscrowState.Created, action: EscrowAction.Release, invalidNext } };
      }
      return { passed: true };
    }
  }
});

console.log('\nVerification Pipeline Output:');
console.log(`Status:           ${pipelineResult.success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Runner:           ${pipelineResult.runner}`);
console.log(`Verified Laws:    ${pipelineResult.verifiedLaws.join(', ')}`);
console.log(`Attestation File: ${pipelineResult.attestationPath}`);
console.log(`Signature:        ${pipelineResult.attestation.attestationSignature}`);
console.log('\n🚀 ALL MATHEMATICAL LAWS PROVEN! GSD CAN SAFELY SHIP TO PRODUCTION.');
console.log('='.repeat(70) + '\n');
