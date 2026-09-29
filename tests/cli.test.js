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
});
