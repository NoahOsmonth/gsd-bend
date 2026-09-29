import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Verifier } from '../src/core/verifier.js';
import { LawLock } from '../src/core/law-lock.js';
import { Attestation } from '../src/core/attestation.js';
import crypto from 'node:crypto';

describe('Verifier Pipeline & Attestation', () => {
  test('built-in engine reports sampled coverage, never a proof', () => {
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

    // Run verification pipeline against the sampled evaluator explicitly.
    const result = Verifier.verifyPipeline({
      projectRoot: tmpDir,
      lawsFile,
      proofFile,
      lockFile,
      attestationFile,
      strictLock: true,
      engine: 'builtin'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.verifiedLaws.length, 1);
    assert.strictEqual(result.verifiedLaws[0], 'safe_op');

    // The certificate must state that the domain was sampled, not proved.
    assert.strictEqual(result.engine, 'builtin-sampled');
    assert.strictEqual(result.status, 'SAMPLED_NO_COUNTEREXAMPLE');
    assert.match(result.coverage, /^SAMPLED_\d+_VALUES_PER_PARAM$/);

    // Verify generated attestation file exists and passes its integrity check
    assert.strictEqual(fs.existsSync(attestationFile), true);
    const validation = Attestation.validate(attestationFile);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.attestation.status, 'SAMPLED_NO_COUNTEREXAMPLE');
    assert.strictEqual(validation.attestation.coverage, result.coverage);

    // With no key configured the certificate is an unkeyed checksum, and the
    // library must say so rather than presenting it as a signature.
    assert.strictEqual(validation.signed, false);
    assert.strictEqual(validation.signatureKind, 'unkeyed-checksum');
    assert.strictEqual(validation.attestation.signed, false);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('attestation is HMAC-signed when GSD_BEND_ATTESTATION_KEY is set', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-verifier-key-'));
    const lawsFile = path.join(tmpDir, 'LAWS.bend');
    const proofFile = path.join(tmpDir, 'PROOF.bend');
    const planningDir = path.join(tmpDir, '.planning');
    const lockFile = path.join(planningDir, 'laws.lock');
    const attestationFile = path.join(planningDir, 'PROOF_ATTESTATION.json');

    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(lawsFile, 'law safe_op:\n  for x: U32\n  { (x >= 0) == True : Bool }');
    fs.writeFileSync(proofFile, 'def Laws.safe_op(x):\n  {==}');
    LawLock.lock(lawsFile, lockFile);

    const prevKey = process.env.GSD_BEND_ATTESTATION_KEY;
    process.env.GSD_BEND_ATTESTATION_KEY = 'test-key-do-not-use-in-production';
    try {
      const result = Verifier.verifyPipeline({
        projectRoot: tmpDir,
        lawsFile,
        proofFile,
        lockFile,
        attestationFile,
        strictLock: true,
        engine: 'builtin'
      });
      assert.strictEqual(result.success, true);

      const validation = Attestation.validate(attestationFile);
      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.signed, true);
      assert.strictEqual(validation.signatureKind, 'hmac-env-key');

      // Tampering must still be caught under the real key.
      const cert = JSON.parse(fs.readFileSync(attestationFile, 'utf8'));
      cert.status = 'MATHEMATICALLY_PROVEN';
      fs.writeFileSync(attestationFile, JSON.stringify(cert, null, 2), 'utf8');
      assert.strictEqual(Attestation.validate(attestationFile).valid, false);
    } finally {
      if (prevKey === undefined) {
        delete process.env.GSD_BEND_ATTESTATION_KEY;
      } else {
        process.env.GSD_BEND_ATTESTATION_KEY = prevKey;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('a legacy hardcoded-key certificate is rejected as forgeable', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-verifier-legacy-'));
    const attestationFile = path.join(tmpDir, 'PROOF_ATTESTATION.json');

    // Reproduce the old scheme: HMAC under the public literal key, no signatureKind.
    const payload = { version: '1.0.0', status: 'MATHEMATICALLY_PROVEN', verifiedLaws: ['nope'] };
    const sig = crypto.createHmac('sha256', 'gsd-bend-proof-authority')
      .update(JSON.stringify(payload)).digest('hex');
    fs.writeFileSync(attestationFile, JSON.stringify({ ...payload, attestationSignature: sig }), 'utf8');

    const validation = Attestation.validate(attestationFile);
    assert.strictEqual(validation.valid, false);
    assert.match(validation.error, /hardcoded key/);

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
