import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LawLock } from '../src/core/law-lock.js';

describe('LawLock Module', () => {
  test('canonicalize strips comments and trailing whitespace', () => {
    const raw = `
# Comment line
law foo:   
  for x: U32  
  # inner comment
  { x >= 0 }
`;
    const canonical = LawLock.canonicalize(raw);
    assert.strictEqual(canonical.includes('#'), false);
    assert.strictEqual(canonical, 'law foo:\n  for x: U32\n  { x >= 0 }');
  });

  test('hash is deterministic and invariant to comment changes', () => {
    const law1 = `law test:\n  for x: U32\n  { x > 0 }`;
    const law2 = `# Extra comment\nlaw test:  \n  # another comment\n  for x: U32\n  { x > 0 }\n`;
    assert.strictEqual(LawLock.hash(law1), LawLock.hash(law2));
  });

  test('lock and verify pipeline detects tampering', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-test-'));
    const lawsFile = path.join(tmpDir, 'LAWS.bend');
    const lockFile = path.join(tmpDir, 'laws.lock');

    fs.writeFileSync(lawsFile, 'law test:\n  for x: U32\n  { x == 0 }');

    // 1. Lock
    const lock = LawLock.lock(lawsFile, lockFile);
    assert.strictEqual(lock.lawCount, 1);
    assert.strictEqual(lock.laws[0], 'test');

    // 2. Verify untampered
    const verifyClean = LawLock.verify(lawsFile, lockFile);
    assert.strictEqual(verifyClean.valid, true);

    // 3. Tamper with laws
    fs.writeFileSync(lawsFile, 'law test:\n  for x: U32\n  { x == 999 }');
    const verifyTampered = LawLock.verify(lawsFile, lockFile);
    assert.strictEqual(verifyTampered.valid, false);
    assert.strictEqual(verifyTampered.error.includes('LAW_LOCK_VIOLATION'), true);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
