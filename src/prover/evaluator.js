/**
 * Evaluator for Bend 2 expressions, inductive transitions, and invariant checks.
 */
export class Evaluator {
  /**
   * The sampled domain per parameter type. These values are a TRIPWIRE, not a
   * proof: a bug at any value outside this set is invisible to the evaluator.
   * Callers must report results as sampled, never as "100% of the domain".
   *
   * Override with GSD_BEND_SAMPLES (comma-separated integers) to widen the
   * search, e.g. GSD_BEND_SAMPLES=0,1,2,100,101,4294967295.
   */
  static numericSamples() {
    const raw = process.env.GSD_BEND_SAMPLES;
    if (raw) {
      const parsed = raw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter(n => Number.isFinite(n));
      if (parsed.length > 0) {
        return parsed;
      }
    }
    return [0, 1, 10, 50, 100];
  }

  /** Number of values sampled per parameter, for honest reporting. */
  static sampleSize() {
    return this.numericSamples().length;
  }

  /**
   * Normalizes Bend expressions into valid JavaScript expressions.
   * @param {string} expr
   * @returns {string}
   */
  static normalizeExpression(expr) {
    let clean = expr.trim();

    // Replace boolean literals
    clean = clean
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false');

    // Nat literals are written `0n`, `1n` in Bend; the JS bridge uses Numbers.
    // `1n+p` (Bend's successor sugar) becomes `1+p`, which is the same meaning.
    clean = clean.replace(/\b(\d+)n\b/g, '$1');

    // Replace Bend logical operators
    clean = clean
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\b/g, '!');

    // Replace equality/inequality without corrupting existing === or !==
    clean = clean
      .replace(/(?<![!=])==(?!=)/g, '===')
      .replace(/(?<![!=])!=(?!=)/g, '!==');

    return clean;
  }

  /**
   * Enhances a scope environment with builtins and method case bridges (camelCase <-> snake_case).
   * @param {object} baseScope
   * @returns {object}
   */
  static bridgeEnvironment(baseScope = {}) {
    const scope = { ...baseScope };

    // Standard Bend built-in objects
    if (!scope.List) {
      scope.List = {
        sum: (arr) => (Array.isArray(arr) ? arr.reduce((a, b) => a + b, 0) : 0),
        len: (arr) => (Array.isArray(arr) ? arr.length : 0),
        head: (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : 0),
        tail: (arr) => (Array.isArray(arr) ? arr.slice(1) : [])
      };
    }

    // Bend's numeric builtins, so a law written against Base can still be
    // sampled on a machine with no Bend compiler installed.
    if (!scope.Nat) {
      scope.Nat = {
        // Nat.sub saturates at zero: `case 0n _: 0n`.
        sub: (a, b) => Math.max(0, Number(a) - Number(b)),
        add: (a, b) => Number(a) + Number(b),
        mul: (a, b) => Number(a) * Number(b),
        is_le: (a, b) => Number(a) <= Number(b),
        is_ge: (a, b) => Number(a) >= Number(b),
        is_lt: (a, b) => Number(a) < Number(b),
        is_gt: (a, b) => Number(a) > Number(b)
      };
    }

    if (!scope.U32) {
      scope.U32 = {
        // U32 arithmetic WRAPS. `0 - 1 : U32` is 4294967295, which is why a
        // `balance >= 0` law over U32 is vacuously true and proves nothing.
        sub: (a, b) => (Number(a) - Number(b)) >>> 0,
        add: (a, b) => (Number(a) + Number(b)) >>> 0,
        mul: (a, b) => Math.imul(Number(a), Number(b)) >>> 0,
        is_le: (a, b) => Number(a) <= Number(b),
        is_ge: (a, b) => Number(a) >= Number(b),
        is_lt: (a, b) => Number(a) < Number(b),
        is_gt: (a, b) => Number(a) > Number(b)
      };
    }

    // Bridge snake_case to camelCase and vice-versa on objects/classes
    for (const [k, v] of Object.entries(scope)) {
      if (v && (typeof v === 'object' || typeof v === 'function')) {
        const proto = typeof v === 'object' ? Object.getPrototypeOf(v) : null;
        const keys = [
          ...Object.getOwnPropertyNames(v),
          ...(proto ? Object.getOwnPropertyNames(proto) : [])
        ];
        for (const key of keys) {
          if (typeof v[key] === 'function') {
            const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (snake !== key && !v[snake]) {
              v[snake] = v[key].bind ? v[key].bind(v) : v[key];
            }
            const camel = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
            if (camel !== key && !v[camel]) {
              v[camel] = v[key].bind ? v[key].bind(v) : v[key];
            }
          }
        }
      }
    }

    return scope;
  }

  /**
   * Safely evaluates a boolean invariant expression given a context of variables and function definitions.
   * @param {string} expr - e.g. "(final_balance >= 0) == True" or "valid == True -> vault_balance == (d - w)"
   * @param {object} scope - variable bindings { initial_balance, withdraw_amount, final_balance, ... }
   * @returns {boolean}
   */
  static evaluateInvariant(expr, scope = {}) {
    const cleanExpr = expr.trim();
    const bridgedScope = this.bridgeEnvironment(scope);

    // Handle implication: A -> B (equiv to !A || B)
    if (cleanExpr.includes('->')) {
      const parts = cleanExpr.split('->').map(p => p.trim());
      const antecedent = this.evaluateInvariant(parts[0], bridgedScope);
      if (!antecedent) {
        return true; // Ex falso quodlibet (vacuously true when antecedent is false)
      }
      return this.evaluateInvariant(parts.slice(1).join('->'), bridgedScope);
    }

    const norm = this.normalizeExpression(cleanExpr);
    const keys = Object.keys(bridgedScope);
    const values = Object.values(bridgedScope);

    try {
      const fn = new Function(...keys, `return Boolean(${norm});`);
      return Boolean(fn(...values));
    } catch (err) {
      throw new Error(`Failed to evaluate expression: "${norm}" with scope ${JSON.stringify(scope)}: ${err.message}`);
    }
  }

  /**
   * Executes an intermediate statement in a law (e.g. final_balance = Wallet.withdraw(a, b)).
   * @param {string} stmt
   * @param {object} scope
   */
  static executeStatement(stmt, scope) {
    const eqIdx = stmt.indexOf('=');
    if (eqIdx === -1) return;

    const varName = stmt.slice(0, eqIdx).trim();
    const rawRhs = stmt.slice(eqIdx + 1).trim();
    const normRhs = this.normalizeExpression(rawRhs);

    const keys = Object.keys(scope);
    const values = Object.values(scope);
    try {
      const fn = new Function(...keys, `return (${normRhs});`);
      scope[varName] = fn(...values);
    } catch (err) {
      throw new Error(`Failed executing statement '${stmt}': ${err.message}`);
    }
  }

  /**
   * Tests an implementation against an invariant across boundary and domain points.
   * @param {object} law - The parsed law from LAWS.bend
   * @param {Function} [implementationFn] - Optional direct simulation function
   * @param {object} [env] - Environment containing objects like Wallet, Vault, Escrow
   * @param {Map<string, string[]>} [customTypes] - Declared sum types / enums
   * @returns {{ passed: boolean, counterexample?: object }}
   */
  static testDomain(law, implementationFn = null, env = {}, customTypes = new Map()) {
    if (!law.invariant) {
      return { passed: true };
    }

    // Generate test domain values based on parameter types
    const paramSamples = law.params.map(p => {
      const type = p.type ? p.type.trim() : '';

      // Check List FIRST before primitive integers (since List<U32> contains U32)
      if (type.startsWith('List') || type.includes('List<')) {
        return [
          [],
          [10],
          [10, 20],
          [50, 75]
        ];
      }

      if (type.includes('Bool')) {
        return [true, false];
      }

      // Check custom parsed sum types
      if (customTypes && customTypes.has(type)) {
        return customTypes.get(type);
      }

      // Standard known domain enums
      if (type.includes('EscrowState')) {
        return ['Created', 'Locked', 'Released', 'Disputed', 'Refunded'];
      }
      if (type.includes('EscrowAction')) {
        return ['Lock', 'Release', 'Dispute', 'Refund', 'Cancel'];
      }

      // Numbers (U32, Nat, Int)
      if (type.includes('U32') || type.includes('Nat') || type.includes('Int')) {
        return this.numericSamples();
      }

      return this.numericSamples();
    });

    // Cartesian product of parameter samples
    const cartesian = (arrays) => {
      return arrays.reduce((acc, curr) => {
        const res = [];
        for (const a of acc) {
          for (const b of curr) {
            res.push([...a, b]);
          }
        }
        return res;
      }, [[]]);
    };

    const combinations = cartesian(paramSamples);

    for (const combo of combinations) {
      const scope = this.bridgeEnvironment(env);
      law.params.forEach((param, idx) => {
        scope[param.name] = combo[idx];
      });

      try {
        // Execute intermediate statements defined in the law
        if (law.statements && law.statements.length > 0) {
          for (const stmt of law.statements) {
            this.executeStatement(stmt, scope);
          }
        }

        // If direct implementation function provided, merge its output
        if (typeof implementationFn === 'function') {
          const result = implementationFn(scope);
          if (result && typeof result === 'object') {
            Object.assign(scope, result);
          }
        }

        const satisfied = this.evaluateInvariant(law.invariant.expression, scope);
        if (!satisfied) {
          // Extract plain counterexample without functions or environment modules
          const cleanCounterexample = {};
          for (const [k, v] of Object.entries(scope)) {
            if (k !== 'List' && !(env && k in env) && (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || Array.isArray(v))) {
              cleanCounterexample[k] = v;
            }
          }
          return {
            passed: false,
            counterexample: cleanCounterexample
          };
        }
      } catch (err) {
        const cleanCounterexample = {};
        for (const [k, v] of Object.entries(scope)) {
          if (k !== 'List' && !(env && k in env) && (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || Array.isArray(v))) {
            cleanCounterexample[k] = v;
          }
        }
        return {
          passed: false,
          counterexample: { ...cleanCounterexample, error: err.message }
        };
      }
    }

    return { passed: true };
  }
}
