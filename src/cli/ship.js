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
  console.log('  🎉 GSD-BEND SHIP GATE CLEARED');
  console.log('================================================================');
  console.log(`Proof Status:       ${res.attestation.status}`);
  console.log(`Coverage:           ${res.attestation.coverage}`);
  console.log(`Engine:             ${res.attestation.engine}`);
  console.log(`Verified Laws:      ${res.attestation.verifiedLaws.join(', ')}`);
  console.log(
    `Proof Attestation:  ${res.attestation.signed
      ? `HMAC-SHA256 signed (${res.attestation.attestationSignature.slice(0, 16)}...)`
      : `UNSIGNED checksum ${res.attestation.attestationSignature.slice(0, 16)}... - integrity only`}`
  );
  console.log(`Ship Summary Log:   ${res.shipSummaryPath}`);
  if (res.attestation.engine !== 'bend') {
    console.log('----------------------------------------------------------------');
    console.log('NOTE: this gate was cleared by the sampled evaluator, which checks a handful of');
    console.log('      values per parameter and does NOT prove the laws. Install Bend for proofs.');
  }
  console.log('----------------------------------------------------------------');
  console.log('🚀 Phase lifecycle completed! Ready for release & deployment.\n');

  return res;
}
