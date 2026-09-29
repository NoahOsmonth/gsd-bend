import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runInit } from '../src/cli/init.js';
import { runLaw } from '../src/cli/law.js';
import { runVerify } from '../src/cli/verify.js';
import { runAudit } from '../src/cli/audit.js';

describe('CLI Commands', () => {
  test('init creates LAWS.bend, PROOF.bend, and laws.lock', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cli-init-'));

    const res = runInit({ projectRoot: tmpDir });
    assert.strictEqual(res.success, true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, 'LAWS.bend')), true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, 'PROOF.bend')), true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, '.planning', 'laws.lock')), true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('law check and list commands work on initialized workspace', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cli-law-'));
    runInit({ projectRoot: tmpDir });

    const checkRes = runLaw('check', { projectRoot: tmpDir });
    assert.strictEqual(checkRes.success, true);

    const listRes = runLaw('list', { projectRoot: tmpDir });
    assert.strictEqual(listRes.success, true);
    assert.strictEqual(listRes.laws.length >= 1, true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('audit and verify work on cleanly initialized workspace', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cli-verify-'));
    runInit({ projectRoot: tmpDir });

    const auditRes = runAudit({ projectRoot: tmpDir });
    assert.strictEqual(auditRes.success, true);

    const verifyRes = runVerify({ projectRoot: tmpDir });
    assert.strictEqual(verifyRes.success, true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('CLI main normalizes slash and prefix syntax (/gsd-bend:plan, gsd-bend-plan, :plan)', async () => {
    const { main } = await import('../src/cli/index.js');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cli-main-'));
    const prevCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      // Test new-project via prefix
      const newRes = main(['gsd-bend-new-project', 'test-app']);
      assert.strictEqual(newRes.success, true);

      // Test plan via slash syntax
      const planRes = main(['/gsd-bend:plan']);
      assert.strictEqual(planRes.success, true);

      // Test execute via hyphen prefix
      const execRes = main(['gsd-bend-execute']);
      assert.strictEqual(execRes.success, true);

      // Test next via slash syntax
      const nextRes = main(['/next']);
      assert.strictEqual(nextRes.success, true);
      assert.strictEqual(nextRes.nextStep, 'verify');

      // Test quick check
      const quickRes = main(['quick']);
      assert.strictEqual(quickRes.success, true);

      // Test status via colon syntax
      const statusRes = main([':status']);
      assert.strictEqual(statusRes.success, true);
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('LawLock.lockLaws and Verifier.verifyPipeline(stringPath) work', async () => {
    const { LawLock } = await import('../src/core/law-lock.js');
    const { Verifier } = await import('../src/core/verifier.js');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-helpers-'));

    runInit({ projectRoot: tmpDir });

    // Test LawLock.lockLaws convenience method
    const lock = LawLock.lockLaws(tmpDir);
    assert.ok(lock.sha256);
    assert.strictEqual(lock.sha256, lock.canonicalSha256);

    // Test Verifier.verifyPipeline with string argument
    const verifyRes = Verifier.verifyPipeline(tmpDir);
    assert.strictEqual(verifyRes.success, true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
