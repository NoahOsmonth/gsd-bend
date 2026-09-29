#!/usr/bin/env node
/**
 * GSD Managed Hook: gsd-bend-verify-gate.js
 * 
 * Intercepts GSD verification phase and prevents advancing to "Ship"
 * unless formal mathematical proofs have been verified and attested.
 */

import { Verifier } from '../src/core/verifier.js';
import { GSDPhaseBridge } from '../src/gsd/phase-bridge.js';

console.log('🔒 GSD Managed Hook: Evaluating Bend Mathematical Proof Gate...');

const root = process.cwd();
const result = Verifier.verifyPipeline({ projectRoot: root, strictLock: true });

if (!result.success) {
  console.error(`\n❌ [GSD-BEND GATE REJECTED]`);
  console.error(`Step: ${result.step}`);
  console.error(`Reason: ${result.message}`);
  console.error(`Action: Phase advancement aborted. Agent must fix code or proofs.\n`);
  process.exit(1);
}

const check = GSDPhaseBridge.canAdvanceToShip(root);
if (!check.canAdvance) {
  console.error(`\n❌ [GSD-BEND GATE REJECTED]`);
  console.error(`Reason: ${check.reason}\n`);
  process.exit(1);
}

console.log(`\n✅ [GSD-BEND GATE PASSED]`);
console.log(`Attestation verified: ${result.attestation.status}`);
console.log(`Verified Laws: ${result.verifiedLaws.join(', ')}`);
console.log(`GSD Core is authorized to advance to Ship phase.\n`);
process.exit(0);
