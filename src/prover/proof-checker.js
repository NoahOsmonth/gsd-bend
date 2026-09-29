import { LawParser } from './law-parser.js';
import { Evaluator } from './evaluator.js';

export class ProofChecker {
  /**
   * Parses PROOF.bend file content into structured proof definitions.
   * @param {string} content
   * @returns {Map<string, object>} Map of lawName -> proof AST
   */
  static parseProofs(content) {
    const lines = content.split(/\r?\n/);
    const proofs = new Map();
    let currentProof = null;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
        continue;
      }

      // Check for def Laws.law_name(args): or def law_name(args):
      const defMatch = line.match(/^def\s+(?:Laws\.)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*:/);
      if (defMatch) {
        if (currentProof) {
          proofs.set(currentProof.name, currentProof);
        }
        currentProof = {
          name: defMatch[1],
          params: defMatch[2]
            .split(',')
            .map(s => s.trim().replace(/:.*$/, '').trim())
            .filter(Boolean),
          bodyLines: [],
          cases: [],
          hasReflexivity: false,
          hasHole: false,
          hasWildcard: false,
          branches: []
        };
        continue;
      }

      if (currentProof) {
        currentProof.bodyLines.push(line);

        if (line.includes('{?}')) {
          currentProof.hasHole = true;
        }

        if (line.includes('{==}')) {
          currentProof.hasReflexivity = true;
        }

        // Detect wildcard case
        if (line.match(/^case\s+_+\s*:/)) {
          currentProof.hasWildcard = true;
          currentProof.cases.push('_');
        }

        // Detect match statements
        const matchCase = line.match(/^case\s+([a-zA-Z0-9_.]+)\s*:/);
        if (matchCase && matchCase[1] !== '_') {
          currentProof.cases.push(matchCase[1]);
        }
      }
    }

    if (currentProof) {
      proofs.set(currentProof.name, currentProof);
    }

    return proofs;
  }

  /**
   * Statically and logically verifies that the proofs in PROOF.bend satisfy LAWS.bend.
   * @param {string} lawsContent - Content of LAWS.bend
   * @param {string} proofContent - Content of PROOF.bend
   * @param {object} [implementationEnv] - Optional implementation object or evaluator function map
   * @returns {{ success: boolean, verifiedLaws: string[], errors: string[], diagnostics: object[] }}
   */
  static verify(lawsContent, proofContent, implementationEnv = {}) {
    const laws = LawParser.parse(lawsContent);
    const proofs = this.parseProofs(proofContent);
    const knownTypes = LawParser.parseTypes(lawsContent);

    // Seed standard domain sum types if not explicitly declared
    if (!knownTypes.has('EscrowState')) {
      knownTypes.set('EscrowState', ['Created', 'Locked', 'Released', 'Disputed', 'Refunded']);
    }
    if (!knownTypes.has('EscrowAction')) {
      knownTypes.set('EscrowAction', ['Lock', 'Release', 'Dispute', 'Refund', 'Cancel']);
    }

    const verifiedLaws = [];
    const errors = [];
    const diagnostics = [];

    if (laws.length === 0) {
      return {
        success: false,
        verifiedLaws: [],
        errors: ['LAWS.bend contains no declared laws to verify.'],
        diagnostics: []
      };
    }

    for (const law of laws) {
      const proof = proofs.get(law.name);

      if (!proof) {
        errors.push(`Missing proof for law: '${law.name}'. Every declared law must have a corresponding proof in PROOF.bend.`);
        diagnostics.push({
          law: law.name,
          status: 'MISSING_PROOF',
          message: `Expected 'def Laws.${law.name}(${law.params.map(p => p.name).join(', ')}):' in PROOF.bend`
        });
        continue;
      }

      // Check parameter alignment
      const expectedParamCount = law.params.length;
      if (proof.params.length !== expectedParamCount) {
        errors.push(`Proof parameter mismatch for '${law.name}': law expects (${law.params.map(p => p.name).join(', ')}), but proof declared (${proof.params.join(', ')}).`);
        diagnostics.push({
          law: law.name,
          status: 'PARAM_MISMATCH',
          expected: law.params.map(p => p.name),
          actual: proof.params
        });
        continue;
      }

      // Check for uncompleted proof holes {?}
      if (proof.hasHole) {
        errors.push(`Incomplete proof for '${law.name}': contains unsolved proof hole '{?}'.`);
        diagnostics.push({
          law: law.name,
          status: 'UNSOLVED_HOLE',
          message: 'Proof contains unresolved goals {?}'
        });
        continue;
      }

      // Check for reflexivity / rewrite completion
      if (!proof.hasReflexivity && !proof.bodyLines.some(l => l.includes('%Laws.'))) {
        errors.push(`Invalid proof for '${law.name}': does not conclude with equivalence reflexivity '{==}' or induction.`);
        diagnostics.push({
          law: law.name,
          status: 'NO_REFLEXIVITY',
          message: 'Proof must establish equality via {==} across all branches.'
        });
        continue;
      }

      // Check if law involves a conditional operation or implication requiring branch cases
      const isConditionalLaw =
        (law.invariant && law.invariant.expression.includes('->')) ||
        law.statements.some(s => s.includes('Wallet.withdraw') || s.includes('Vault.process') || s.includes('transition') || s.includes('if') || s.includes('match'));

      if (isConditionalLaw && proof.cases.length === 0) {
        errors.push(`Invalid proof for '${law.name}': conditional invariant requires case analysis (match), bare reflexivity '{==}' is insufficient.`);
        diagnostics.push({
          law: law.name,
          status: 'MISSING_CASE_ANALYSIS',
          message: 'Proof must analyze condition branches using match statements.'
        });
        continue;
      }

      // Branch exhaustiveness check: Boolean
      const hasTrueCase = proof.cases.some(c => c === 'True' || c.endsWith('.True'));
      const hasFalseCase = proof.cases.some(c => c === 'False' || c.endsWith('.False'));
      if (hasTrueCase && !hasFalseCase && !proof.hasWildcard) {
        errors.push(`Non-exhaustive proof for '${law.name}': covers 'case True' but omits 'case False'. Agents cannot ignore counter-branches!`);
        diagnostics.push({
          law: law.name,
          status: 'NON_EXHAUSTIVE_BRANCH',
          missing: 'case False'
        });
        continue;
      }
      if (hasFalseCase && !hasTrueCase && !proof.hasWildcard) {
        errors.push(`Non-exhaustive proof for '${law.name}': covers 'case False' but omits 'case True'.`);
        diagnostics.push({
          law: law.name,
          status: 'NON_EXHAUSTIVE_BRANCH',
          missing: 'case True'
        });
        continue;
      }

      // Branch exhaustiveness check: Inductive List
      const hasNil = proof.cases.some(c => c.toLowerCase().includes('nil'));
      const hasCons = proof.cases.some(c => c.toLowerCase().includes('cons'));
      if (((hasNil && !hasCons) || (!hasNil && hasCons)) && !proof.hasWildcard) {
        errors.push(`Non-exhaustive inductive proof for '${law.name}': must cover both base case (nil) and inductive step (cons).`);
        diagnostics.push({
          law: law.name,
          status: 'INCOMPLETE_INDUCTION',
          missing: hasNil ? 'cons' : 'nil'
        });
        continue;
      }

      // Branch exhaustiveness check: Custom Sum / Enum Types
      let enumBranchError = null;
      for (const [typeName, variants] of knownTypes.entries()) {
        const matchesType = proof.cases.some(c => c.startsWith(`${typeName}.`) || variants.includes(c));
        if (matchesType && !proof.hasWildcard) {
          const covered = proof.cases
            .map(c => (c.startsWith(`${typeName}.`) ? c.slice(typeName.length + 1) : c))
            .filter(c => variants.includes(c));
          const missing = variants.filter(v => !covered.includes(v));
          if (missing.length > 0) {
            enumBranchError = `Non-exhaustive proof for '${law.name}': covers '${covered.join(', ')}' for ${typeName} but omits '${missing.join(', ')}'.`;
            diagnostics.push({
              law: law.name,
              status: 'NON_EXHAUSTIVE_BRANCH',
              type: typeName,
              missing
            });
            break;
          }
        }
      }
      if (enumBranchError) {
        errors.push(enumBranchError);
        continue;
      }

      // Implementation semantic check if available in environment
      if (implementationEnv) {
        if (typeof implementationEnv[law.name] === 'function') {
          // Direct test callback provided
          const testResult = implementationEnv[law.name]();
          if (!testResult.passed) {
            errors.push(`Proof soundness failure for '${law.name}': Implementation violates invariant at counterexample: ${JSON.stringify(testResult.counterexample)}`);
            diagnostics.push({
              law: law.name,
              status: 'SOUNDNESS_FAILURE',
              counterexample: testResult.counterexample
            });
            continue;
          }
        } else if (Object.keys(implementationEnv).length > 0) {
          // Domain evaluation against module objects (e.g. Wallet, Vault, Escrow)
          const domainResult = Evaluator.testDomain(law, null, implementationEnv, knownTypes);
          if (!domainResult.passed) {
            errors.push(`Proof soundness failure for '${law.name}': Implementation violates invariant at counterexample: ${JSON.stringify(domainResult.counterexample)}`);
            diagnostics.push({
              law: law.name,
              status: 'SOUNDNESS_FAILURE',
              counterexample: domainResult.counterexample
            });
            continue;
          }
        }
      }

      // All proof checks passed for this law
      verifiedLaws.push(law.name);
      diagnostics.push({
        law: law.name,
        status: 'VERIFIED',
        branches: proof.cases.length > 0 ? proof.cases : ['direct-reflexive']
      });
    }

    return {
      success: errors.length === 0 && verifiedLaws.length === laws.length,
      verifiedLaws,
      errors,
      diagnostics
    };
  }
}
