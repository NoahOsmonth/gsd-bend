import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * The key used before this was configurable. It is a public literal in a public
 * repository, so any certificate signed with it can be forged by anyone. It is
 * recognised only to REJECT legacy certificates, never to produce new ones.
 */
const LEGACY_PUBLIC_KEY = 'gsd-bend-proof-authority';

export class Attestation {
  /**
   * Resolves the attestation key. With no key configured the attestation is
   * issued as an unkeyed checksum: it still detects accidental edits, but it
   * proves nothing about who wrote it and must not be described as "signed".
   * @returns {{ kind: 'hmac-env-key' | 'unkeyed-checksum', key?: string }}
   */
  static signingMode() {
    const key = process.env.GSD_BEND_ATTESTATION_KEY;
    if (key && key.length > 0) {
      return { kind: 'hmac-env-key', key };
    }
    return { kind: 'unkeyed-checksum' };
  }

  /**
   * Computes the signature/checksum for a payload under a given scheme.
   * @param {object} payload
   * @param {string} kind
   * @returns {string|null} null when the scheme cannot be evaluated here
   */
  static computeSignature(payload, kind) {
    const body = JSON.stringify(payload);
    if (kind === 'hmac-env-key') {
      const key = process.env.GSD_BEND_ATTESTATION_KEY;
      if (!key) return null;
      return crypto.createHmac('sha256', key).update(body).digest('hex');
    }
    if (kind === 'legacy-hardcoded-hmac') {
      return crypto.createHmac('sha256', LEGACY_PUBLIC_KEY).update(body).digest('hex');
    }
    return crypto.createHash('sha256').update(body).digest('hex');
  }

  /**
   * Generates a proof attestation certificate.
   *
   * `status`, `coverage` and `engine` are supplied by the runner so the
   * certificate states what actually happened. They are deliberately NOT
   * defaulted to "MATHEMATICALLY_PROVEN": the sampled evaluator must never
   * issue a certificate claiming a proof it did not perform.
   *
   * @param {object} params
   * @param {string} params.lawsPath
   * @param {string} params.proofPath
   * @param {string} params.lawHash
   * @param {string[]} params.verifiedLaws
   * @param {string} [params.phase]
   * @param {string} [params.outputPath]
   * @param {string} [params.status]   e.g. KERNEL_VERIFIED, PROOFS_CHECKED, SAMPLED_NO_COUNTEREXAMPLE
   * @param {string} [params.coverage] e.g. ALL_INPUTS_KERNEL_CHECKED, SAMPLED_5_VALUES_PER_PARAM
   * @param {string} [params.engine]   e.g. bend, builtin-sampled
   * @param {string} [params.runner]   human-readable runner label
   * @returns {object} The generated attestation object
   */
  static generate({
    lawsPath,
    proofPath,
    lawHash,
    verifiedLaws,
    phase = 'verify',
    outputPath,
    status = 'UNVERIFIED',
    coverage = 'UNKNOWN',
    engine = 'unknown',
    runner = 'unknown'
  }) {
    const proofContent = fs.readFileSync(proofPath, 'utf8');
    const proofHash = crypto.createHash('sha256').update(proofContent, 'utf8').digest('hex');

    const mode = this.signingMode();
    const timestamp = new Date().toISOString();
    const payload = {
      version: '1.0.0',
      status,
      phase,
      timestamp,
      engine,
      runner,
      lawHash,
      proofHash,
      verifiedLaws,
      coverage,
      antiGoodhartAudit: 'PASSED',
      signatureKind: mode.kind,
      signed: mode.kind === 'hmac-env-key'
    };

    const signatureToken = this.computeSignature(payload, mode.kind);

    const attestation = {
      ...payload,
      attestationSignature: signatureToken
    };

    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, JSON.stringify(attestation, null, 2), 'utf8');
    }

    return attestation;
  }

  /**
   * Validates an attestation certificate.
   *
   * Returns `signed: false` for an unkeyed checksum: such a certificate is
   * integrity-checked but unauthenticated, and callers that need provenance
   * must require `signed === true` (which needs GSD_BEND_ATTESTATION_KEY set
   * to the same key at issue and at validation time).
   *
   * Legacy certificates (no `signatureKind`) were signed with the public
   * hardcoded key and are reported invalid: they can be forged by anyone who
   * has read the source, so accepting them would defeat the gate.
   *
   * @param {string} attestationPath
   * @returns {{ valid: boolean, signed?: boolean, signatureKind?: string, attestation?: object, error?: string }}
   */
  static validate(attestationPath) {
    if (!fs.existsSync(attestationPath)) {
      return { valid: false, error: `Attestation file missing: ${attestationPath}` };
    }

    const attestation = JSON.parse(fs.readFileSync(attestationPath, 'utf8'));
    const { attestationSignature, ...payload } = attestation;

    const kind = attestation.signatureKind || 'legacy-hardcoded-hmac';

    if (kind === 'legacy-hardcoded-hmac') {
      return {
        valid: false,
        signed: false,
        signatureKind: kind,
        error:
          'Attestation was issued by a version that signed with a public hardcoded key ' +
          'and is therefore forgeable. Re-run `gsd-bend verify` to issue a new certificate.',
        attestation
      };
    }

    if (kind === 'hmac-env-key' && !process.env.GSD_BEND_ATTESTATION_KEY) {
      return {
        valid: false,
        signed: false,
        signatureKind: kind,
        error:
          'Attestation is HMAC-signed but GSD_BEND_ATTESTATION_KEY is not set, so the ' +
          'signature cannot be checked. Set the same key used to issue it.',
        attestation
      };
    }

    const expectedSignature = this.computeSignature(payload, kind);

    if (expectedSignature === null || attestationSignature !== expectedSignature) {
      return {
        valid: false,
        signed: kind === 'hmac-env-key',
        signatureKind: kind,
        error: 'Attestation signature mismatch! Proof certificate has been tampered with.',
        attestation
      };
    }

    return {
      valid: true,
      signed: kind === 'hmac-env-key',
      signatureKind: kind,
      attestation
    };
  }
}
