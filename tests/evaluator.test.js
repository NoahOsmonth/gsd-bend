import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Evaluator } from '../src/prover/evaluator.js';
import { LawParser } from '../src/prover/law-parser.js';

describe('Evaluator & Expression Normalizer', () => {
  test('evaluates boolean equality without ==== syntax error', () => {
    const expr = '(final_balance >= 0) == True';
    const scope = { final_balance: 50 };
    const res = Evaluator.evaluateInvariant(expr, scope);
    assert.strictEqual(res, true);

    const failScope = { final_balance: -10 };
    const failRes = Evaluator.evaluateInvariant(expr, failScope);
    assert.strictEqual(failRes, false);
  });

  test('evaluates logical implications and ex falso quodlibet', () => {
    const expr = '(valid == True) -> (vault_balance == (total_deposited - total_withdrawn))';

    // When valid is true and balance matches -> true
    const validMatch = { valid: true, vault_balance: 100, total_deposited: 150, total_withdrawn: 50 };
    assert.strictEqual(Evaluator.evaluateInvariant(expr, validMatch), true);

    // When valid is true but balance violates equation -> false
    const validMismatch = { valid: true, vault_balance: 99, total_deposited: 150, total_withdrawn: 50 };
    assert.strictEqual(Evaluator.evaluateInvariant(expr, validMismatch), false);

    // When valid is false (antecedent false) -> vacuously true (ex falso quodlibet)
    const antecedentFalse = { valid: false, vault_balance: -999, total_deposited: 10, total_withdrawn: 100 };
    assert.strictEqual(Evaluator.evaluateInvariant(expr, antecedentFalse), true);
  });

  test('evaluates and, or, not operators in Bend syntax', () => {
    const expr = '(x >= 0) and not (x == 10) or (x == 100)';
    assert.strictEqual(Evaluator.evaluateInvariant(expr, { x: 5 }), true);
    assert.strictEqual(Evaluator.evaluateInvariant(expr, { x: 10 }), false);
    assert.strictEqual(Evaluator.evaluateInvariant(expr, { x: 100 }), true);
  });

  test('executes law intermediate statements', () => {
    const scope = {
      deposits: [100, 200],
      withdrawals: [50, 75]
    };
    const bridged = Evaluator.bridgeEnvironment(scope);

    Evaluator.executeStatement('total_deposited = List.sum(deposits)', bridged);
    Evaluator.executeStatement('total_withdrawn = List.sum(withdrawals)', bridged);
    Evaluator.executeStatement('valid = (total_withdrawn <= total_deposited)', bridged);

    assert.strictEqual(bridged.total_deposited, 300);
    assert.strictEqual(bridged.total_withdrawn, 125);
    assert.strictEqual(bridged.valid, true);
  });

  test('testDomain samples List<U32> as arrays, not scalar integers', () => {
    const law = {
      name: 'list_test',
      params: [{ name: 'items', type: 'List<U32>' }],
      statements: ['s = List.sum(items)'],
      invariant: { expression: '(s >= 0) == True', type: 'Bool' }
    };

    let sawArray = false;
    const res = Evaluator.testDomain(law, (scope) => {
      if (Array.isArray(scope.items)) sawArray = true;
      return {};
    });

    assert.strictEqual(res.passed, true);
    assert.strictEqual(sawArray, true);
  });

  test('testDomain catches counterexample on buggy logic', () => {
    const law = {
      name: 'underflow_check',
      params: [
        { name: 'b', type: 'U32' },
        { name: 'w', type: 'U32' }
      ],
      statements: ['res = Wallet.withdraw(b, w)'],
      invariant: { expression: '(res >= 0) == True', type: 'Bool' }
    };

    const buggyEnv = {
      Wallet: {
        withdraw: (b, w) => b - w // Buggy! Allows underflow
      }
    };

    const res = Evaluator.testDomain(law, null, buggyEnv);
    assert.strictEqual(res.passed, false);
    assert.strictEqual(typeof res.counterexample, 'object');
    assert.strictEqual(res.counterexample.res < 0, true);
  });
});
