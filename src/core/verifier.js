import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { LawLock } from './law-lock.js';
import { AntiCheat } from './anti-cheat.js';
import { Attestation } from './attestation.js';
import { BendRunner } from '../compiler/bend-runner.js';

export class Verifier {
  /**
   * Runs the full GSD-Bend formal verification pipeline.
   * @param {object} options
   * @param {string} [options.projectRoot] - Root path of project (defaults to cwd)
   * @param {string} [options.lawsFile] - Path to LAWS.bend
   * @param {string} [options.proofFile] - Path to PROOF.bend
   * @param {string} [options.lockFile] - Path to laws.lock
   * @param {string} [options.attestationFile] - Output path for PROOF_ATTESTATION.json
   * @param {string} [options.phase] - Current GSD phase name
   * @param {boolean} [options.strictLock] - Whether to require law lock
   * @param {'auto'|'bend'|'builtin'} [options.engine] - Force a verification engine
   * @param {object} [options.implementationEnv] - Optional function evaluation map
   * @returns {{ success: boolean, step: string, message: string, attestation?: object, diagnostics?: object[] }}
   */
  static verifyPipeline(options = {}) {
    if (typeof options === 'string') {
      options = { projectRoot: options };
    }
    const root = options.projectRoot || process.cwd();
    const lawsPath = options.lawsFile || path.join(root, 'LAWS.bend');
    const proofPath = options.proofFile || path.join(root, 'PROOF.bend');
    const lockPath = options.lockFile || path.join(root, '.planning', 'laws.lock');
    const attestationPath = options.attestationFile || path.join(root, '.planning', 'PROOF_ATTESTATION.json');
    const phase = options.phase || 'verify';
    const strictLock = options.strictLock !== false;

    // 1. Check file existence
    if (!fs.existsSync(lawsPath)) {
      return {
        success: false,
        step: 'SPECIFICATION_CHECK',
        message: `LAWS file not found: ${lawsPath}. Define your invariants in LAWS.bend first.`
      };
    }
    if (!fs.existsSync(proofPath)) {
      return {
        success: false,
        step: 'PROOF_CHECK',
        message: `PROOF file not found: ${proofPath}. An agent must generate mathematical proofs in PROOF.bend.`
      };
    }

    const lawsContent = fs.readFileSync(lawsPath, 'utf8');
    const proofContent = fs.readFileSync(proofPath, 'utf8');

    // 2. Law Lock Integrity Check
    if (strictLock) {
      if (!fs.existsSync(lockPath)) {
        return {
          success: false,
          step: 'LAW_LOCK_INTEGRITY',
          message: `laws.lock missing at ${lockPath}. Invariants must be locked during the Plan phase before verification.`
        };
      }
      const lockCheck = LawLock.verify(lawsPath, lockPath);
      if (!lockCheck.valid) {
        return {
          success: false,
          step: 'LAW_LOCK_INTEGRITY',
          message: lockCheck.error,
          diagnostics: [{ type: 'LAW_LOCK_VIOLATION', recordedHash: lockCheck.recordedHash, actualHash: lockCheck.actualHash }]
        };
      }
    }

    // 3. Gather code content & Anti-Cheat Goodhart Audit
    let codeContent = '';
    const srcDir = path.join(root, 'src');
    if (fs.existsSync(srcDir)) {
      const walkDir = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile()) {
            codeContent += '\n' + fs.readFileSync(fullPath, 'utf8');
          }
        }
      };
      walkDir(srcDir);
    }

    const auditResult = AntiCheat.audit(lawsContent, proofContent, codeContent);
    if (!auditResult.clean) {
      return {
        success: false,
        step: 'ANTI_GOODHART_AUDIT',
        message: `Anti-cheat audit failed: detected ${auditResult.infractions.length} cheating pattern(s).`,
        diagnostics: auditResult.infractions
      };
    }

    // 4. Resolve implementation environment (explicit or auto-discovered from src/)
    let implementationEnv = options.implementationEnv ? { ...options.implementationEnv } : {};
    if (Object.keys(implementationEnv).length === 0 && fs.existsSync(srcDir)) {
      try {
        const req = createRequire(path.join(root, 'package.json'));
        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs'))) {
            try {
              const mod = req(path.join(srcDir, entry.name));
              Object.assign(implementationEnv, mod);
            } catch {
              // Ignore polyglot load failure, evaluator will handle defaults
            }
          }
        }
      } catch {
        // createRequire fallback
      }
    }

    // 5. Run Proof Verification (Native compiler or built-in engine)
    const proofResult = BendRunner.runProof(proofPath, lawsPath, implementationEnv, {
      engine: options.engine
    });
    if (!proofResult.success) {
      return {
        success: false,
        step: 'COMPILER_PROOF_VERIFICATION',
        message: proofResult.output,
        runner: proofResult.runner,
        diagnostics: proofResult.diagnostics || []
      };
    }

    // 5. Generate Proof Attestation
    const lawHash = LawLock.hash(lawsContent);
    const verifiedLaws = proofResult.verifiedLaws || [];
    const attestation = Attestation.generate({
      lawsPath,
      proofPath,
      lawHash,
      verifiedLaws,
      phase,
      outputPath: attestationPath,
      // State what the runner actually did. Never a blanket "MATHEMATICALLY_PROVEN":
      // the sampled evaluator checks a handful of values per parameter.
      status: proofResult.status || 'UNVERIFIED',
      coverage: proofResult.coverage || 'UNKNOWN',
      engine: proofResult.engine || 'unknown',
      runner: proofResult.runner || 'unknown'
    });

    const provenance = attestation.signed
      ? `signed (${attestation.signatureKind})`
      : `UNSIGNED (${attestation.signatureKind} — set GSD_BEND_ATTESTATION_KEY to sign)`;

    return {
      success: true,
      step: 'VERIFICATION_COMPLETE',
      message:
        `${verifiedLaws.length} invariant law(s) passed ${proofResult.engine} verification ` +
        `[${proofResult.status} / ${proofResult.coverage}]. ` +
        `Attestation ${provenance}.`,
      runner: proofResult.runner,
      engine: proofResult.engine,
      status: proofResult.status,
      coverage: proofResult.coverage,
      attestation,
      attestationPath,
      verifiedLaws
    };
  }
}
