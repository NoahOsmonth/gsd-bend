import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function runShip(options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log('🚢 Evaluating GSD-Bend Formal Proof Ship Gate...\n');

  const res = GSDPhaseBridge.ship(root, options);
  if (!res.success) {
    console.error('================================================================');
    console.error('  🛑 GSD SHIP GATE BLOCKED');
    console.error('================================================================');
    console.error(`Reason: ${res.reason}`);
    console.error('\nAction Required:');
    console.error('  Run `gsd-bend verify` to compile proofs and sign PROOF_ATTESTATION.json.');
    console.error('  If proofs fail, run `gsd-bend heal` to debug counterexamples.\n');
    return res;
  }

  console.log('================================================================');
  console.log('  🎉 GSD-BEND SHIP GATE CLEARED: 100% FORMALLY VERIFIED');
  console.log('================================================================');
  console.log(`Proof Status:       ${res.attestation.status}`);
  console.log(`Verified Laws:      ${res.attestation.verifiedLaws.join(', ')}`);
  console.log(`Proof Attestation:  ${res.attestation.attestationSignature.slice(0, 16)}...`);
  console.log(`Ship Summary Log:   ${res.shipSummaryPath}`);
  console.log('----------------------------------------------------------------');
  console.log('🚀 Phase lifecycle completed! Ready for release & deployment.\n');

  return res;
}
