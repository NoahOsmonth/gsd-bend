import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Verifier } from '../src/core/verifier.js';
import { LawLock } from '../src/core/law-lock.js';
import { Attestation } from '../src/core/attestation.js';

describe('Verifier Pipeline & Attestation', () => {
  test('end-to-end pipeline locks, verifies, and generates valid attestation', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-verifier-'));
    const lawsFile = path.join(tmpDir, 'LAWS.bend');
    const proofFile = path.join(tmpDir, 'PROOF.bend');
    const planningDir = path.join(tmpDir, '.planning');
    const lockFile = path.join(planningDir, 'laws.lock');
    const attestationFile = path.join(planningDir, 'PROOF_ATTESTATION.json');

    fs.mkdirSync(planningDir, { recursive: true });

    fs.writeFileSync(lawsFile, `law safe_op:
  for x: U32
  { (x >= 0) == True : Bool }`);

    fs.writeFileSync(proofFile, `def Laws.safe_op(x):
  {==}`);

    // Lock
    LawLock.lock(lawsFile, lockFile);

    // Run verification pipeline
    const result = Verifier.verifyPipeline({
      projectRoot: tmpDir,
      lawsFile,
      proofFile,
      lockFile,
      attestationFile,
      strictLock: true
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.verifiedLaws.length, 1);
    assert.strictEqual(result.verifiedLaws[0], 'safe_op');

    // Verify generated attestation file exists and passes HMAC check
    assert.strictEqual(fs.existsSync(attestationFile), true);
    const validation = Attestation.validate(attestationFile);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.attestation.status, 'MATHEMATICALLY_PROVEN');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('pipeline halts on missing lock when strictLock is enabled', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-verifier-strict-'));
    const lawsFile = path.join(tmpDir, 'LAWS.bend');
    const proofFile = path.join(tmpDir, 'PROOF.bend');

    fs.writeFileSync(lawsFile, 'law safe_op:\n  for x: U32\n  { x >= 0 }');
    fs.writeFileSync(proofFile, 'def Laws.safe_op(x):\n  {==}');

    const result = Verifier.verifyPipeline({
      projectRoot: tmpDir,
      lawsFile,
      proofFile,
      strictLock: true
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.step, 'LAW_LOCK_INTEGRITY');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
