import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function runVerify(options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log('🛡️  Running GSD-Bend Mathematical Verification Gate...\n');

  const result = GSDPhaseBridge.verify(root, options);

  if (result.success) {
    console.log('================================================================');
    console.log('  ✅ GSD-BEND VERIFICATION GATE: PASSED');
    console.log('================================================================');
    console.log(`Runner:           ${result.runner}`);
    console.log(`Verified Laws:    ${result.verifiedLaws.join(', ')}`);
    console.log(`Attestation File: ${result.attestationPath}`);
    console.log(`Status:           ${result.attestation.status}`);
    console.log(`Coverage:         ${result.attestation.coverage}`);
    console.log(`Signature:        ${result.attestation.attestationSignature.slice(0, 16)}...`);
    console.log('----------------------------------------------------------------');
    console.log('🚀 Phase verification complete! Ready to advance to GSD Ship.\n');
    return { success: true, result };
  } else {
    console.log('================================================================');
    console.log('  ❌ GSD-BEND VERIFICATION GATE: FAILED');
    console.log('================================================================');
    console.log(`Failed Step:  ${result.step}`);
    console.log(`Error:        ${result.message}`);
    if (result.diagnostics && result.diagnostics.length > 0) {
      console.log('Diagnostics:');
      result.diagnostics.forEach((d, idx) => {
        console.log(`  [${idx + 1}] ${JSON.stringify(d)}`);
      });
    }
    console.log('----------------------------------------------------------------');
    console.log('🛑 ADVANCEMENT BLOCKED: You cannot ship code with failing proofs.');
    console.log('💡 Run `gsd-bend heal` to see reflection steps for the AI agent.\n');
    return { success: false, result };
  }
}
