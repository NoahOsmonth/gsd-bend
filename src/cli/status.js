import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function runStatus(options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log('📊 GSD-Bend Project & Proof Lifecycle Status\n');

  try {
    const res = GSDPhaseBridge.getStatus(root);
    console.log('================================================================');
    console.log(`Current Phase:       ${res.state.currentPhase.toUpperCase()}`);
    console.log(`Phase Status:        ${res.state.status}`);
    console.log('----------------------------------------------------------------');
    console.log(`LAWS.bend:           ${res.files.laws ? 'Present' : 'Missing'}`);
    console.log(`laws.lock:           ${res.files.lock ? (res.lockIntegrity ? 'VERIFIED (Untampered)' : 'TAMPERED / MISMATCH') : 'Missing'}`);
    console.log(`Active Laws:         ${res.declaredLaws.length > 0 ? res.declaredLaws.join(', ') : 'None'}`);
    console.log(`PROOF.bend:          ${res.files.proof ? 'Present' : 'Missing'}`);
    console.log(`Proof Attestation:   ${res.files.attestation ? (res.attestationValid ? (res.attestationData.signed ? 'VALID (signed)' : 'VALID (unsigned checksum)') : 'INVALID / EXPIRED') : 'Not Issued Yet'}`);
    if (res.attestationData) {
      console.log(`Attestation Sig:     ${res.attestationData.attestationSignature.slice(0, 16)}... (${res.attestationData.signatureKind || 'unknown'})`);
      console.log(`Engine:              ${res.attestationData.engine || 'unknown'}`);
      console.log(`Coverage:            ${res.attestationData.coverage}`);
    }
    console.log('================================================================');
    console.log(`💡 Next Recommended Step: gsd-bend ${res.nextStep}\n`);
    return { success: true, ...res };
  } catch (err) {
    console.error(`❌ Failed to retrieve status: ${err.message}`);
    return { success: false, error: err.message };
  }
}
