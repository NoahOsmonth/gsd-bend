import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AntiCheat } from '../src/core/anti-cheat.js';

describe('AntiCheat Analyzer', () => {
  const laws = 'law foo:\n  for x: U32\n  { x == 0 }';

  test('passes clean code and proofs', () => {
    const proof = 'def Laws.foo(x):\n  {==}';
    const code = 'function withdraw(b, a) { if (a <= b) return b - a; return b; }';
    const res = AntiCheat.audit(laws, proof, code);
    assert.strictEqual(res.clean, true);
    assert.strictEqual(res.infractions.length, 0);
  });

  test('catches unproven axiom bypasses', () => {
    const proof = 'axiom bypass: all x > 0\ndef Laws.foo(x):\n  {==}';
    const res = AntiCheat.audit(laws, proof);
    assert.strictEqual(res.clean, false);
    assert.strictEqual(res.infractions[0].type, 'AXIOMATIC_BYPASS');
  });

  test('catches skip/ignore annotations', () => {
    const proof = '@skip\ndef Laws.foo(x):\n  {==}';
    const res = AntiCheat.audit(laws, proof);
    assert.strictEqual(res.clean, false);
    assert.strictEqual(res.infractions[0].type, 'PROOF_SKIPPED');
  });

  test('catches mocking library injection in verified code', () => {
    const proof = 'def Laws.foo(x):\n  {==}';
    const code = 'const mock = jest.mock("./wallet");';
    const res = AntiCheat.audit(laws, proof, code);
    assert.strictEqual(res.clean, false);
    assert.strictEqual(res.infractions[0].type, 'MOCK_DETECTED');
  });

  test('catches imperative return statements inside proof body', () => {
    const proof = 'def Laws.foo(x):\n  return True';
    const res = AntiCheat.audit(laws, proof);
    assert.strictEqual(res.clean, false);
    assert.strictEqual(res.infractions[0].type, 'VACUOUS_RETURN');
  });

  test('catches vi.mock and mockReturnValue in code', () => {
    const proof = 'def Laws.foo(x):\n  {==}';
    const code = 'vi.mock("./vault"); fn.mockReturnValue(50);';
    const res = AntiCheat.audit(laws, proof, code);
    assert.strictEqual(res.clean, false);
    assert.strictEqual(res.infractions[0].type, 'MOCK_DETECTED');
  });

  test('catches Bend non-semicolon hardcoded returns', () => {
    const proof = 'def Laws.foo(x):\n  {==}';
    const bendCode = 'def withdraw(balance, amount):\n  return 50\n';
    const res = AntiCheat.audit(laws, proof, bendCode);
    assert.strictEqual(res.clean, false);
    assert.strictEqual(res.infractions[0].type, 'HARDCODED_HAPPY_PATH');
  });

  test('catches todo!() and unimplemented!() stubs in proof', () => {
    const proof = 'def Laws.foo(x):\n  todo!()';
    const res = AntiCheat.audit(laws, proof);
    assert.strictEqual(res.clean, false);
    assert.strictEqual(res.infractions[0].type, 'UNIMPLEMENTED_PROOF_STUB');
  });
});
