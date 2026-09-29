import fs from 'node:fs';
import path from 'node:path';
import { Verifier } from '../core/verifier.js';

export function runHeal(options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log('🩺 Analyzing Proof Failures & Generating AI Agent Reflection Prompt...\n');

  const result = Verifier.verifyPipeline({ ...options, strictLock: false });

  if (result.success) {
    console.log('✨ All proofs are currently passing! No healing needed.');
    return { success: true };
  }

  const prompt = `# ==============================================================================
# GSD-BEND AGENT REFLECTION & HEALING PROMPT
# ==============================================================================
CRITICAL INSTRUCTION: You are an AI coding worker in a GSD loop. 
Your code FAILED mathematical verification. You CANNOT edit LAWS.bend.

FAILURE DIAGNOSTIC:
- Phase/Step: ${result.step}
- Error Details: ${result.message}

RULES FOR FIXING:
1. DO NOT touch LAWS.bend (it is hash-locked with SHA-256).
2. DO NOT weaken assertions or delete proof cases.
3. If an inductive branch is missing (e.g. 'case False'), you MUST implement:
   - Boundary checks in your code logic (e.g., if withdraw_amount > initial_balance).
   - The corresponding proof case in PROOF.bend ensuring reflexivity {==}.
4. Once revised, run \`gsd-bend verify\` to re-test the gate.
==============================================================================
`;

  console.log(prompt);
  return { success: false, reflectionPrompt: prompt };
}
