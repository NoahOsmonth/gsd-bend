import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { ProofChecker } from '../prover/proof-checker.js';
import { LawParser } from '../prover/law-parser.js';

let cachedDetection = null;

export class BendRunner {
  /**
   * Checks if native bend is available in PATH or WSL.
   * @returns {{ available: boolean, mode?: 'native' | 'wsl' | 'none', version?: string }}
   */
  static detect() {
    if (cachedDetection !== null) {
      return cachedDetection;
    }

    // 1. Try native command
    try {
      const isWindows = process.platform === 'win32';
      const cmd = isWindows ? 'cmd.exe' : 'bend';
      const args = isWindows ? ['/c', 'bend', '--version'] : ['--version'];
      const res = spawnSync(cmd, args, { encoding: 'utf8', timeout: 500 });
      if (res.status === 0 && res.stdout) {
        cachedDetection = { available: true, mode: 'native', version: res.stdout.trim() };
        return cachedDetection;
      }
    } catch {
      // ignore
    }

    // 2. Try WSL
    try {
      const res = spawnSync('wsl', ['bend', '--version'], { encoding: 'utf8', timeout: 500 });
      if (res.status === 0 && res.stdout) {
        cachedDetection = { available: true, mode: 'wsl', version: res.stdout.trim() };
        return cachedDetection;
      }
    } catch {
      // ignore
    }

    cachedDetection = { available: false, mode: 'none' };
    return cachedDetection;
  }

  /**
   * Runs the proof verification on PROOF.bend and LAWS.bend.
   * If native compiler is found, executes `bend PROOF.bend`.
   * Otherwise, executes the built-in Bend 2 formal proof evaluator.
   * @param {string} proofPath
   * @param {string} lawsPath
   * @param {object} [implementationEnv]
   * @returns {{ success: boolean, output: string, runner: string, diagnostics?: object[], verifiedLaws?: string[] }}
   */
  static runProof(proofPath, lawsPath, implementationEnv = {}) {
    const detection = this.detect();
    const lawsContent = fs.readFileSync(lawsPath, 'utf8');
    const parsedLaws = LawParser.parse(lawsContent);
    const lawNames = parsedLaws.map(l => l.name);

    if (detection.available && detection.mode === 'native') {
      try {
        const isWindows = process.platform === 'win32';
        const cmd = isWindows ? 'cmd.exe' : 'bend';
        const args = isWindows ? ['/c', 'bend', proofPath] : [proofPath];
        const res = spawnSync(cmd, args, { encoding: 'utf8' });
        if (res.status === 0) {
          return {
            success: true,
            output: res.stdout || 'Native Bend proof verified.',
            runner: `Native Bend Compiler (${detection.version})`,
            verifiedLaws: lawNames
          };
        } else {
          return {
            success: false,
            output: res.stderr || res.stdout || 'Native Bend proof verification failed.',
            runner: `Native Bend Compiler (${detection.version})`,
            verifiedLaws: []
          };
        }
      } catch (err) {
        return {
          success: false,
          output: err.message,
          runner: `Native Bend Compiler (${detection.version})`,
          verifiedLaws: []
        };
      }
    }

    if (detection.available && detection.mode === 'wsl') {
      try {
        const res = spawnSync('wsl', ['bend', proofPath], { encoding: 'utf8' });
        if (res.status === 0) {
          return {
            success: true,
            output: res.stdout || 'WSL Bend proof verified.',
            runner: `WSL Bend Compiler (${detection.version})`,
            verifiedLaws: lawNames
          };
        } else {
          return {
            success: false,
            output: res.stderr || res.stdout || 'WSL Bend proof verification failed.',
            runner: `WSL Bend Compiler (${detection.version})`,
            verifiedLaws: []
          };
        }
      } catch (err) {
        return {
          success: false,
          output: err.message,
          runner: `WSL Bend Compiler (${detection.version})`,
          verifiedLaws: []
        };
      }
    }

    // Fallback: Built-in GSD-Bend Formal Proof Engine
    const proofContent = fs.readFileSync(proofPath, 'utf8');
    const result = ProofChecker.verify(lawsContent, proofContent, implementationEnv);

    if (result.success) {
      return {
        success: true,
        output: `[Bend 2 Proof Engine] All mathematical laws verified successfully!\nVerified laws: ${result.verifiedLaws.join(', ')}`,
        runner: 'GSD-Bend Built-in Formal Proof Engine (Bend 2 Proof Specification Compliant)',
        diagnostics: result.diagnostics,
        verifiedLaws: result.verifiedLaws
      };
    } else {
      return {
        success: false,
        output: `[Bend 2 Proof Engine] Proof verification failed:\n${result.errors.join('\n')}`,
        runner: 'GSD-Bend Built-in Formal Proof Engine (Bend 2 Proof Specification Compliant)',
        diagnostics: result.diagnostics,
        errors: result.errors
      };
    }
  }
}
