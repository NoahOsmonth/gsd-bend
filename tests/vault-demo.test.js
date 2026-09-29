import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Verifier } from '../src/core/verifier.js';
import { LawLock } from '../src/core/law-lock.js';
import { ProofChecker } from '../src/prover/proof-checker.js';
import { AntiCheat } from '../src/core/anti-cheat.js';
import { Wallet, Vault, Escrow, EscrowState, EscrowAction } from '../examples/bend-vault/src/vault.js';
import { ScenarioCode } from '../examples/bend-vault/scenarios/scenarios.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vaultDir = path.join(__dirname, '..', 'examples', 'bend-vault');

describe('BendVault Application & Agent Cheat Scenarios', () => {
  const lawsPath = path.join(vaultDir, 'LAWS.bend');
  const proofPath = path.join(vaultDir, 'PROOF.bend');
  const lawsContent = fs.readFileSync(lawsPath, 'utf8');

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
    const proofContent = fs.readFileSync(proofPath, 'utf8');
    const buggyEnv = {
      wallet_never_negative: () => {
        const res = ScenarioCode.buggyImplementation.withdraw(10, 50);
        if (res < 0) return { passed: false, counterexample: { balance: 10, withdraw: 50, res } };
        return { passed: true };
      }
    };

    const res = ProofChecker.verify(lawsContent, proofContent, buggyEnv);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errors[0].includes('Proof soundness failure'), true);
  });

  test('GSD-Bend blocks agent tampering with LAWS.bend', () => {
    const tamperedHash = LawLock.hash(ScenarioCode.tamperedLawsContent);
    const originalHash = LawLock.hash(lawsContent);
    assert.notStrictEqual(tamperedHash, originalHash);
  });

  test('GSD-Bend blocks non-exhaustive proof and axiomatic cheat', () => {
    const incompleteRes = ProofChecker.verify(lawsContent, ScenarioCode.incompleteProofContent);
    assert.strictEqual(incompleteRes.success, false);
    assert.strictEqual(incompleteRes.errors[0].includes('Non-exhaustive proof'), true);

    const auditRes = AntiCheat.audit(lawsContent, ScenarioCode.axiomaticCheatProofContent);
    assert.strictEqual(auditRes.clean, false);
    assert.strictEqual(auditRes.infractions[0].type, 'AXIOMATIC_BYPASS');
  });

  test('Full BendVault passes Verifier pipeline with 100% formal proofs', () => {
    const result = Verifier.verifyPipeline({
      projectRoot: vaultDir,
      strictLock: true
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.verifiedLaws.length, 3);
    assert.deepStrictEqual(result.verifiedLaws, [
      'wallet_never_negative',
      'vault_solvency',
      'escrow_state_transition'
    ]);
  });
});
