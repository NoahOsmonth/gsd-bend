import fs from 'node:fs';
import path from 'node:path';
import { Attestation } from '../core/attestation.js';

export class GSDPhaseBridge {
  /**
   * Reads GSD state from .planning/STATE.md or .planning/state.json if it exists.
   * @param {string} projectRoot
   * @returns {object}
   */
  static getGSDState(projectRoot = process.cwd()) {
    const planningDir = path.join(projectRoot, '.planning');
    const stateMdPath = path.join(planningDir, 'STATE.md');
    const stateJsonPath = path.join(planningDir, 'state.json');

    if (fs.existsSync(stateJsonPath)) {
      try {
        return JSON.parse(fs.readFileSync(stateJsonPath, 'utf8'));
      } catch {
        // fallback
      }
    }

    if (fs.existsSync(stateMdPath)) {
      const content = fs.readFileSync(stateMdPath, 'utf8');
      const phaseMatch = content.match(/phase:\s*([^\n\r]+)/i);
      const statusMatch = content.match(/status:\s*([^\n\r]+)/i);
      return {
        currentPhase: phaseMatch ? phaseMatch[1].trim() : 'execute',
        status: statusMatch ? statusMatch[1].trim() : 'in_progress',
        raw: content
      };
    }

    return {
      currentPhase: 'phase-01',
      status: 'in_progress'
    };
  }

  /**
   * Checks whether the current GSD phase has satisfied the Bend Proof Gate.
   * @param {string} projectRoot
   * @returns {{ canAdvance: boolean, reason?: string, attestation?: object }}
   */
  static canAdvanceToShip(projectRoot = process.cwd()) {
    const attestationPath = path.join(projectRoot, '.planning', 'PROOF_ATTESTATION.json');
    if (!fs.existsSync(attestationPath)) {
      return {
        canAdvance: false,
        reason: 'GATE BLOCKED: No valid PROOF_ATTESTATION.json found. You must run `gsd-bend verify` and pass all mathematical proofs before shipping.'
      };
    }

    const validation = Attestation.validate(attestationPath);
    if (!validation.valid) {
      return {
        canAdvance: false,
        reason: `GATE BLOCKED: Proof attestation is invalid or tampered with: ${validation.error}`
      };
    }

    return {
      canAdvance: true,
      attestation: validation.attestation
    };
  }
}
