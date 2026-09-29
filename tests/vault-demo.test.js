import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Verifier } from '../src/core/verifier.js';
import { LawLock } from '../src/core/law-lock.js';
import { ProofChecker } from '../src/prover/proof-checker.js';
import { AntiCheat } from '../src/core/anti-cheat.js';
import { BendRunner } from '../src/compiler/bend-runner.js';
import { Wallet, Vault, Escrow, EscrowState, EscrowAction } from '../examples/bend-vault/src/vault.js';
import { ScenarioCode } from '../examples/bend-vault/scenarios/scenarios.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vaultDir = path.join(__dirname, '..', 'examples', 'bend-vault');

describe('BendVault Application & Agent Cheat Scenarios', () => {
  const lawsPath = path.join(vaultDir, 'LAWS.bend');
  const proofPath = path.join(vaultDir, 'PROOF.bend');
  const lawsContent = fs.readFileSync(lawsPath, 'utf8');

  // A law in the sampled evaluator's own dialect. The example's LAWS.bend is
  // real Bend (the compiler checks it); the scenarios below exercise the
  // built-in evaluator, which parses this simpler `{expr : T}` form.
  const sampledLaws = `
law wallet_never_negative:
  for initial_balance: U32
  for withdraw_amount: U32
  final_balance = Wallet.withdraw(initial_balance, withdraw_amount)
  { (final_balance >= 0) == True : Bool }
`;

  const sampledProof = `
def Laws.wallet_never_negative(initial_balance, withdraw_amount):
  match (withdraw_amount <= initial_balance):
    case True:
      {==}
    case False:
      {==}
`;

  const sampledProofMissingBranch = `
def Laws.wallet_never_negative(initial_balance, withdraw_amount):
  match (withdraw_amount <= initial_balance):
    case True:
      {==}
`;

  test('Wallet.withdraw enforces non-negative balance invariant across edge cases', () => {
    // Standard withdrawal
    assert.strictEqual(Wallet.withdraw(100, 40), 60);
    // Boundary withdrawal (empty balance)
    assert.strictEqual(Wallet.withdraw(100, 100), 0);
    // Overdraft attempt (rejected, balance unchanged)
    assert.strictEqual(Wallet.withdraw(100, 101), 100);
    assert.strictEqual(Wallet.withdraw(0, 50), 0);
  });

  test('Vault.process preserves solvency invariant', () => {
    // Solvency condition: total withdrawals <= deposits
    assert.strictEqual(Vault.process([100, 200], [50, 75]), 175);
    // Insolvency attempt: withdrawals > deposits rejected, reserves preserved
    assert.strictEqual(Vault.process([100], [200]), 100);
  });

  test('Escrow state machine forbids illegal direct releases', () => {
    // Created -> Locked valid
    assert.strictEqual(Escrow.transition(EscrowState.Created, EscrowAction.Lock), EscrowState.Locked);
    // Created -> Released ILLEGAL (must stay Created)
    assert.strictEqual(Escrow.transition(EscrowState.Created, EscrowAction.Release), EscrowState.Created);
    // Locked -> Released valid
    assert.strictEqual(Escrow.transition(EscrowState.Locked, EscrowAction.Release), EscrowState.Released);
  });

  test('GSD-Bend blocks buggy implementation with counterexample', () => {
    const buggyEnv = {
      // The law calls Wallet.withdraw, so the binding must be present or the
      // law is refused as UNBOUND_IMPLEMENTATION before any soundness check.
      Wallet: {
        withdraw: (balance, amount) => ScenarioCode.buggyImplementation.withdraw(balance, amount)
      },
      wallet_never_negative: () => {
        const res = ScenarioCode.buggyImplementation.withdraw(10, 50);
        if (res < 0) return { passed: false, counterexample: { balance: 10, withdraw: 50, res } };
        return { passed: true };
      }
    };

    const res = ProofChecker.verify(sampledLaws, sampledProof, buggyEnv);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errors[0].includes('Proof soundness failure'), true);
  });

  test('GSD-Bend blocks agent tampering with LAWS.bend', () => {
    const tamperedHash = LawLock.hash(ScenarioCode.tamperedLawsContent);
    const originalHash = LawLock.hash(lawsContent);
    assert.notStrictEqual(tamperedHash, originalHash);
  });

  test('GSD-Bend blocks non-exhaustive proof and axiomatic cheat', () => {
    const incompleteRes = ProofChecker.verify(sampledLaws, sampledProofMissingBranch);
    assert.strictEqual(incompleteRes.success, false);
    assert.strictEqual(incompleteRes.errors[0].includes('Non-exhaustive proof'), true);

    const auditRes = AntiCheat.audit(sampledLaws, ScenarioCode.axiomaticCheatProofContent);
    assert.strictEqual(auditRes.clean, false);
    assert.strictEqual(auditRes.infractions[0].type, 'AXIOMATIC_BYPASS');
  });

  test('the BendVault example verifies through the pipeline', () => {
    const result = Verifier.verifyPipeline({
      projectRoot: vaultDir,
      strictLock: true
    });
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.verifiedLaws, [
      'withdraw_zero_noop',
      'withdraw_all_empties'
    ]);

    // When a real Bend compiler is present the gate must use it and report
    // compiler-checked coverage; otherwise it must say the domain was sampled.
    if (result.engine === 'bend') {
      assert.strictEqual(result.status, 'PROOFS_CHECKED');
      assert.strictEqual(result.coverage, 'ALL_INPUTS_CHECKED_BY_BEND');
    } else {
      assert.strictEqual(result.engine, 'builtin-sampled');
      assert.match(result.coverage, /^SAMPLED_\d+_VALUES_PER_PARAM$/);
    }
  });

  test('the real Bend compiler rejects a broken implementation of the example', () => {
    // The negative control for the example: the laws in LAWS.bend are
    // falsifiable. A `withdraw` that returns one more than it should makes
    // `bend PROOF.bend` report SOME PROOFS FAIL.
    const detection = BendRunner.detect();
    if (!detection.available) {
      return; // No compiler on this machine: nothing to assert.
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-vault-buggy-'));
    try {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.copyFileSync(lawsPath, path.join(tmpDir, 'LAWS.bend'));
      fs.copyFileSync(proofPath, path.join(tmpDir, 'PROOF.bend'));

      const good = fs.readFileSync(path.join(vaultDir, 'src', 'wallet.bend'), 'utf8');
      const buggy = good.replace('          Nat.sub(bp, ap)', '          1n+Nat.sub(bp, ap)');
      assert.notStrictEqual(buggy, good, 'the off-by-one patch must apply');
      fs.writeFileSync(path.join(tmpDir, 'src', 'wallet.bend'), buggy, 'utf8');

      const res = BendRunner.runProof(
        path.join(tmpDir, 'PROOF.bend'),
        path.join(tmpDir, 'LAWS.bend'),
        {},
        { engine: 'bend' }
      );
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.status, 'PROOFS_FAILED');
      assert.match(res.output, /SOME PROOFS FAIL/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
