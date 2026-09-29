import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Verifier } from '../../src/core/verifier.js';
import { LawLock } from '../../src/core/law-lock.js';
import { AntiCheat } from '../../src/core/anti-cheat.js';
import { ProofChecker } from '../../src/prover/proof-checker.js';
import { BendRunner } from '../../src/compiler/bend-runner.js';
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
║     Catching AI agent mistakes with Bend laws and real proofs      ║
╚════════════════════════════════════════════════════════════════════╝
`);

const detection = BendRunner.detect();
console.log(`Bend compiler: ${detection.available ? detection.version : 'NOT FOUND'}`);
if (!detection.available) {
  console.log('Scenarios 2, 4A and 5 need a real compiler; install Bend from https://bend-lang.com/');
  console.log('Without it GSD-Bend falls back to a sampled evaluator that checks a handful of');
  console.log('values per parameter and reports SAMPLED_NO_COUNTEREXAMPLE, never a proof.');
}

// -----------------------------------------------------------------------------
// SCENARIO 1: The Goodhart Trap in Traditional GSD
// -----------------------------------------------------------------------------
separator('SCENARIO 1: The Goodhart Trap with Traditional Unit Tests');
console.log('Situation: An AI agent writes a withdraw function that forgets balance bounds.');
console.log('Agent code: balance - amount (Allows negative balance!)');
console.log('Agent unit test:');
console.log('  test("withdraw credits", () => expect(withdraw(100, 50)).toBe(50));');

const unitTestResult = ScenarioCode.fakeHappyPathTest(ScenarioCode.buggyImplementation.withdraw);
console.log(`\nUnit Test Result: ${unitTestResult.passed ? '✅ 100% PASS' : 'FAIL'}`);
console.log(`Summary: ${unitTestResult.detail}`);
console.log('🚨 Outcome: traditional GSD marks the phase complete and ships the bug.');

// -----------------------------------------------------------------------------
// SCENARIO 2: The real compiler rejects the same buggy implementation
// -----------------------------------------------------------------------------
separator('SCENARIO 2: Bend Rejects the Buggy Implementation');
console.log('The laws in LAWS.bend are checked against src/wallet.bend by the compiler,');
console.log('so the same bug cannot reach the gate. Patching wallet.bend to return one');
console.log('more than it should and re-running `bend PROOF.bend`:');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-demo-buggy-'));
let buggyCheck = null;
try {
  fs.mkdirSync(path.join(sandbox, 'src'), { recursive: true });
  fs.copyFileSync(path.join(vaultDir, 'LAWS.bend'), path.join(sandbox, 'LAWS.bend'));
  fs.copyFileSync(path.join(vaultDir, 'PROOF.bend'), path.join(sandbox, 'PROOF.bend'));

  const good = fs.readFileSync(path.join(vaultDir, 'src', 'wallet.bend'), 'utf8');
  const buggy = good.replace('          Nat.sub(bp, ap)', '          1n+Nat.sub(bp, ap)');
  fs.writeFileSync(path.join(sandbox, 'src', 'wallet.bend'), buggy, 'utf8');

  buggyCheck = BendRunner.runProof(
    path.join(sandbox, 'PROOF.bend'),
    path.join(sandbox, 'LAWS.bend'),
    {},
    { engine: 'bend' }
  );

  console.log('\nCompiler verdict:');
  console.log(buggyCheck.output.split('\n').slice(0, 6).map(l => '  ' + l).join('\n'));
  console.log(`\nSuccess: ${buggyCheck.success}   Status: ${buggyCheck.status}`);
  console.log('🛑 Result: the proof does not go through, so the gate cannot be cleared.');
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}

// -----------------------------------------------------------------------------
// SCENARIO 3: Tampering with LAWS.bend is detected
// -----------------------------------------------------------------------------
separator('SCENARIO 3: GSD-Bend Blocks Agent Tampering with LAWS.bend');
console.log('Situation: blocked by the proof, the agent tries to weaken the spec instead.');
console.log('Agent edits the invariant to force a pass.');

const tempTamperedLaws = path.join(vaultDir, '.planning', 'TEMP_TAMPERED_LAWS.bend');
fs.writeFileSync(tempTamperedLaws, ScenarioCode.tamperedLawsContent, 'utf8');

const lockCheck = LawLock.verify(tempTamperedLaws, path.join(vaultDir, '.planning', 'laws.lock'));
console.log('\nLawLock Integrity Verification:');
console.log(`Integrity Check Passed: ${lockCheck.valid}`);
console.log(`Security Error: 🚨 ${lockCheck.error}`);
fs.unlinkSync(tempTamperedLaws);
console.log('🛑 Result: tampering caught by the SHA-256 canonical hash lock.');
console.log('   This is the part that actually resists Goodharting: the agent cannot move');
console.log('   the target after the fact, because the human locked the spec first.');

// -----------------------------------------------------------------------------
// SCENARIO 4: Incomplete proofs and axiomatic bypasses
// -----------------------------------------------------------------------------
separator('SCENARIO 4: GSD-Bend Blocks Incomplete and Cheating Proofs');

if (detection.available) {
  console.log('Attempt 4A: agent leaves a law unproven (the proof def is missing).');
  const sandbox2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-demo-open-'));
  try {
    fs.mkdirSync(path.join(sandbox2, 'src'), { recursive: true });
    fs.copyFileSync(path.join(vaultDir, 'LAWS.bend'), path.join(sandbox2, 'LAWS.bend'));
    fs.copyFileSync(path.join(vaultDir, 'src', 'wallet.bend'), path.join(sandbox2, 'src', 'wallet.bend'));

    const proof = fs.readFileSync(path.join(vaultDir, 'PROOF.bend'), 'utf8');
    fs.writeFileSync(
      path.join(sandbox2, 'PROOF.bend'),
      proof.split('def Laws.withdraw_all_empties')[0],
      'utf8'
    );

    const openRes = BendRunner.runProof(
      path.join(sandbox2, 'PROOF.bend'),
      path.join(sandbox2, 'LAWS.bend'),
      {},
      { engine: 'bend' }
    );
    console.log(`Result: ❌ ${openRes.output.split('\n')[0]} - ${openRes.output.split('\n')[1] || ''}`.trim());
  } finally {
    fs.rmSync(sandbox2, { recursive: true, force: true });
  }
} else {
  console.log('Attempt 4A: skipped (needs the Bend compiler).');
}

console.log('\nAttempt 4B: agent tries to insert an axiom loophole ("axiom bypass_underflow:")');
const lawsContent = fs.readFileSync(path.join(vaultDir, 'LAWS.bend'), 'utf8');
const antiCheatResult = AntiCheat.audit(lawsContent, ScenarioCode.axiomaticCheatProofContent);
console.log(`Anti-Cheat Clean: ${antiCheatResult.clean}`);
console.log(`Infraction Caught: 🚨 [${antiCheatResult.infractions[0].type}] ${antiCheatResult.infractions[0].description}`);

console.log('\nAttempt 4C: agent omits a case branch in the sampled evaluator dialect');
// NOTE: this is the legacy sampled dialect used by the built-in evaluator, NOT real
// Bend — `{ (final_balance >= 0) == True : Bool }` is not a valid Bend law claim (a
// law claim is a *type*). It is kept here to show the branch-completeness check that
// the sampled evaluator does perform. The project's real laws live in LAWS.bend.
const sampledLaws = `
law wallet_never_negative:
  for initial_balance: U32
  for withdraw_amount: U32
  final_balance = Wallet.withdraw(initial_balance, withdraw_amount)
  { (final_balance >= 0) == True : Bool }
`;
const incompleteCheck = ProofChecker.verify(sampledLaws, ScenarioCode.incompleteProofContent);
console.log(`Result: ❌ ${incompleteCheck.errors[0]}`);

// -----------------------------------------------------------------------------
// SCENARIO 5: The example verified - and what that does and does not mean
// -----------------------------------------------------------------------------
separator('SCENARIO 5: The Example Verified, and What It Actually Proves');
console.log('The same implementation, written correctly, with proofs for both laws.');

const pipelineResult = Verifier.verifyPipeline({
  projectRoot: vaultDir,
  strictLock: true
});

console.log('\nVerification Pipeline Output:');
console.log(`Status:           ${pipelineResult.success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Engine:           ${pipelineResult.engine}`);
console.log(`Runner:           ${pipelineResult.runner}`);
console.log(`Proof Status:     ${pipelineResult.status}`);
console.log(`Coverage:         ${pipelineResult.coverage}`);
console.log(`Verified Laws:    ${pipelineResult.verifiedLaws.join(', ')}`);
console.log(`Attestation File: ${pipelineResult.attestationPath}`);
console.log(
  `Attestation:      ${pipelineResult.attestation.signed
    ? 'HMAC-SHA256 signed'
    : 'UNSIGNED checksum (set GSD_BEND_ATTESTATION_KEY to sign)'}`
);

console.log('\nWhat this means:');
if (pipelineResult.engine === 'bend') {
  console.log('  ✅ Bend checked these laws for ALL inputs, not a sample. The proofs are real.');
  console.log('  ⚠️  It proves the laws in LAWS.bend, and nothing else. A law that is true but');
  console.log('      vacuous (e.g. `balance >= 0` over U32, which wraps) buys you nothing.');
  console.log('  ⚠️  It says nothing about code outside the .bend files: src/vault.js, the');
  console.log('      escrow state machine, and everything else still need their own tests.');
} else {
  console.log('  ⚠️  The built-in evaluator sampled a small domain and found no counterexample.');
  console.log('      That is a tripwire, not a proof. Install Bend for real verification.');
}
console.log('='.repeat(70) + '\n');
