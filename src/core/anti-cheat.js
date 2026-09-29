/**
 * AntiCheat scans code, proofs, and laws for Goodhart's Law cheating patterns:
 * 1. Trivial tautologies (e.g. proving True == True instead of the spec invariant).
 * 2. Axiomatic loopholes (declaring axioms to bypass proving lemmas).
 * 3. Mock overrides (intercepting system calls or types with fake constants).
 * 4. Empty assertions or skipped proof goals.
 */
export class AntiCheat {
  /**
   * Performs an anti-cheat audit on the provided law and proof content.
   * @param {string} lawsContent
   * @param {string} proofContent
   * @param {string} [codeContent]
   * @returns {{ clean: boolean, infractions: Array<{ type: string, description: string, line?: number }> }}
   */
  static audit(lawsContent, proofContent, codeContent = '') {
    const infractions = [];

    // 1. Check for suspicious axioms in proof
    const axiomMatches = proofContent.match(/(?:axiom|postulate|assume)\s+([a-zA-Z0-9_]+)/gi);
    if (axiomMatches) {
      infractions.push({
        type: 'AXIOMATIC_BYPASS',
        description: `Agent attempted to bypass mathematical induction using unproven axioms: ${axiomMatches.join(', ')}`
      });
    }

    // 2. Check for @skip, @ignore, or @test-only decorators
    const skipMatches = proofContent.match(/@(skip|ignore|bypass|allow_failure)/gi);
    if (skipMatches) {
      infractions.push({
        type: 'PROOF_SKIPPED',
        description: `Agent attempted to skip verification gates using bypass annotations: ${skipMatches.join(', ')}`
      });
    }

    // 3. Check for fake / mocked implementations in codeContent
    if (codeContent) {
      if (
        codeContent.includes('jest.mock') ||
        codeContent.includes('unittest.mock') ||
        codeContent.includes('sinon.stub') ||
        codeContent.includes('vi.mock') ||
        codeContent.includes('mockImplementation') ||
        codeContent.includes('mockReturnValue')
      ) {
        infractions.push({
          type: 'MOCK_DETECTED',
          description: 'Agent introduced mocking libraries or mock return overrides into the verified core logic.'
        });
      }

      // Check if withdraw/core method hardcodes a happy-path return (JS or Bend without semicolon)
      const hardcodedReturn = codeContent.match(/return\s+(?:50|100|true|True|0)\s*(?:;|\r?\n|$)/i);
      if (hardcodedReturn && !codeContent.includes('if') && !codeContent.includes('match') && !codeContent.includes('?')) {
        infractions.push({
          type: 'HARDCODED_HAPPY_PATH',
          description: 'Implementation hardcodes a fixed return value without dynamic branching or invariant guards.'
        });
      }
    }

    // 4. Check for vacuous proof tricks in PROOF.bend
    // e.g. def Laws.something(a, b): return True (not using Bend proof structure)
    const proofLines = proofContent.split(/\r?\n/);
    proofLines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed === 'return True' || trimmed === 'return true;' || trimmed === 'return true') {
        infractions.push({
          line: idx + 1,
          type: 'VACUOUS_RETURN',
          description: 'Proof function uses imperative return instead of formal proof reflexivity.'
        });
      }
      if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
        // Comment
        return;
      }
      if (trimmed === 'pass' || trimmed === 'todo!()' || trimmed === 'unimplemented!()' || trimmed === '{...}') {
        infractions.push({
          line: idx + 1,
          type: 'UNIMPLEMENTED_PROOF_STUB',
          description: 'Proof contains stubbed or bypassed statements.'
        });
      }
    });

    return {
      clean: infractions.length === 0,
      infractions
    };
  }
}
