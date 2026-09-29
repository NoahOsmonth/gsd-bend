import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ProofChecker } from '../src/prover/proof-checker.js';
import { LawParser } from '../src/prover/law-parser.js';

describe('ProofChecker & LawParser', () => {
  const sampleLaws = `
law balance_non_negative:
  for balance: U32
  for amount: U32
  final_balance = Wallet.withdraw(balance, amount)
  { (final_balance >= 0) == True : Bool }
`;

  // The law above calls `Wallet.withdraw`, so an implementation must actually be
  // bound for the law to be checkable. Without this the checker now refuses the
  // law as UNBOUND_IMPLEMENTATION rather than reporting it as verified.
  const walletEnv = {
    Wallet: {
      withdraw: (balance, amount) => (amount <= balance ? balance - amount : balance)
    }
  };

  test('LawParser correctly extracts law names, params, and invariants', () => {
    const parsed = LawParser.parse(sampleLaws);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].name, 'balance_non_negative');
    assert.strictEqual(parsed[0].params.length, 2);
    assert.strictEqual(parsed[0].params[0].name, 'balance');
    assert.strictEqual(parsed[0].params[1].name, 'amount');
    assert.strictEqual(parsed[0].invariant.expression, '(final_balance >= 0) == True');
  });

  test('ProofChecker detects missing proof', () => {
    const proof = `
def Laws.different_law(x):
  {==}
`;
    const res = ProofChecker.verify(sampleLaws, proof, walletEnv);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errors[0].includes('Missing proof for law'), true);
  });

  test('ProofChecker detects parameter mismatch', () => {
    const proof = `
def Laws.balance_non_negative(only_one_param):
  {==}
`;
    const res = ProofChecker.verify(sampleLaws, proof, walletEnv);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errors[0].includes('parameter mismatch'), true);
  });

  test('ProofChecker rejects unproven holes {?}', () => {
    const proof = `
def Laws.balance_non_negative(balance, amount):
  match (amount <= balance):
    case True:
      {==}
    case False:
      {?}
`;
    const res = ProofChecker.verify(sampleLaws, proof, walletEnv);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errors[0].includes('contains unsolved proof hole'), true);
  });

  test('ProofChecker rejects non-exhaustive branches', () => {
    const proof = `
def Laws.balance_non_negative(balance, amount):
  match (amount <= balance):
    case True:
      {==}
`;
    const res = ProofChecker.verify(sampleLaws, proof, walletEnv);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errors[0].includes('Non-exhaustive proof'), true);
    assert.strictEqual(res.errors[0].includes("omits 'case False'"), true);
  });

  test('ProofChecker accepts complete valid proof', () => {
    const proof = `
def Laws.balance_non_negative(balance, amount):
  match (amount <= balance):
    case True:
      {==}
    case False:
      {==}
`;
    const res = ProofChecker.verify(sampleLaws, proof, walletEnv);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verifiedLaws.length, 1);
    assert.strictEqual(res.verifiedLaws[0], 'balance_non_negative');
  });

  test('ProofChecker rejects bare reflexivity shortcut for conditional laws', () => {
    const fakeProof = `
def Laws.balance_non_negative(balance, amount):
  {==}
`;
    const res = ProofChecker.verify(sampleLaws, fakeProof, walletEnv);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errors[0].includes('conditional invariant requires case analysis'), true);
  });

  test('ProofChecker rejects incomplete sum type / enum proof', () => {
    const enumLaw = `
type Color = Red | Green | Blue
law color_check:
  for c: Color
  { valid(c) == True : Bool }
`;
    const incompleteEnumProof = `
def Laws.color_check(c):
  match c:
    case Red:
      {==}
`;
    const res = ProofChecker.verify(enumLaw, incompleteEnumProof);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errors[0].includes('Non-exhaustive proof'), true);
    assert.strictEqual(res.errors[0].includes('Green, Blue'), true);
  });

  test('ProofChecker accepts typed parameter declarations in proofs', () => {
    const proofWithTypes = `
def Laws.balance_non_negative(balance: U32, amount: U32):
  match (amount <= balance):
    case True:
      {==}
    case False:
      {==}
`;
    const res = ProofChecker.verify(sampleLaws, proofWithTypes, walletEnv);
    assert.strictEqual(res.success, true);
  });

  test('ProofChecker refuses a law whose implementation was never bound', () => {
    // Regression: an empty implementationEnv used to skip the semantic check
    // entirely while still reporting the law as verified, so a project the
    // loader could not import from (e.g. TypeScript) got a green gate without
    // its code ever running.
    const proof = `
def Laws.balance_non_negative(balance, amount):
  match (amount <= balance):
    case True:
      {==}
    case False:
      {==}
`;
    const res = ProofChecker.verify(sampleLaws, proof);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errors[0].includes('Unbound implementation'), true);
    assert.strictEqual(res.errors[0].includes('Wallet'), true);
    assert.deepStrictEqual(res.diagnostics[0].status, 'UNBOUND_IMPLEMENTATION');
    assert.deepStrictEqual(res.diagnostics[0].missing, ['Wallet']);
  });
});
