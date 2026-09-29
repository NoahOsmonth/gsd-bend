import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { ProofChecker } from '../prover/proof-checker.js';
import { LawParser } from '../prover/law-parser.js';
import { Evaluator } from '../prover/evaluator.js';

let cachedDetection = null;

export class BendRunner {
  /**
   * Checks if native bend is available in PATH or WSL.
   *
   * Bend's version flag is `bend version`; `bend --version` is NOT valid and
   * exits 1 on every release. Probing only `--version` therefore made the
   * native path unreachable even on machines with Bend installed, silently
   * downgrading every run to the sampled JS engine. Both spellings are tried so
   * an older or vendored build still resolves.
   *
   * @returns {{ available: boolean, mode?: 'native' | 'wsl' | 'none', version?: string }}
   */
  static detect() {
    if (cachedDetection !== null) {
      return cachedDetection;
    }

    const probe = (cmd, args) => {
      const res = spawnSync(cmd, args, { encoding: 'utf8', timeout: 2000 });
      // `bend version` prints "bend 2.0.34" to stdout; tolerate either stream.
      const out = `${res.stdout || ''}${res.stderr || ''}`.trim();
      if (res.status === 0 && out) {
        return out.split(/\r?\n/)[0].trim();
      }
      return null;
    };

    // 1. Try native command. `bend version` first, then the legacy spelling.
    try {
      const isWindows = process.platform === 'win32';
      const cmd = isWindows ? 'cmd.exe' : 'bend';
      for (const args of isWindows
        ? [['/c', 'bend', 'version'], ['/c', 'bend', '--version']]
        : [['version'], ['--version']]) {
        const version = probe(cmd, args);
        if (version) {
          cachedDetection = { available: true, mode: 'native', version };
          return cachedDetection;
        }
      }
    } catch {
      // ignore
    }

    // 2. Try WSL
    try {
      for (const args of [['bend', 'version'], ['bend', '--version']]) {
        const version = probe('wsl', args);
        if (version) {
          cachedDetection = { available: true, mode: 'wsl', version };
          return cachedDetection;
        }
      }
    } catch {
      // ignore
    }

    cachedDetection = { available: false, mode: 'none' };
    return cachedDetection;
  }

  /**
   * Clears the cached detection result. Tests use this when they stub PATH.
   */
  static resetDetection() {
    cachedDetection = null;
  }

  /**
   * Runs proof verification on PROOF.bend against LAWS.bend.
   *
   * Prefers the real Bend compiler when one is on PATH (`bend PROOF.bend`),
   * which is the only path that checks proofs rather than sampling them.
   * Otherwise falls back to the built-in evaluator, which reports itself as a
   * sampled tripwire — it must never claim a proof it did not perform.
   *
   * @param {string} proofPath
   * @param {string} lawsPath
   * @param {object} [implementationEnv]
   * @param {object} [options]
   * @param {'auto'|'bend'|'builtin'} [options.engine] - Force an engine instead of
   *   auto-detecting. `builtin` is the only way to reach the sampled evaluator on
   *   a machine that has Bend, and `bend` turns a missing compiler into an error
   *   rather than a silent downgrade. Also settable via GSD_BEND_ENGINE.
   * @returns {{ success: boolean, output: string, runner: string, engine: string, status: string, coverage: string, diagnostics?: object[], verifiedLaws?: string[] }}
   */
  static runProof(proofPath, lawsPath, implementationEnv = {}, options = {}) {
    const detection = this.detect();
    const engine = options.engine || process.env.GSD_BEND_ENGINE || 'auto';
    const lawsContent = fs.readFileSync(lawsPath, 'utf8');
    const parsedLaws = LawParser.parse(lawsContent);
    const lawNames = parsedLaws.map(l => l.name);

    if (engine === 'bend' && !detection.available) {
      return {
        success: false,
        output:
          'Engine "bend" was requested but no Bend compiler was found on PATH. ' +
          'Install Bend (https://bend-lang.com/) or run with engine "builtin" to use ' +
          'the sampled evaluator, which does not prove anything.',
        runner: 'bend (not found)',
        engine: 'bend',
        status: 'ENGINE_UNAVAILABLE',
        coverage: 'NOT_PROVEN',
        verifiedLaws: []
      };
    }

    // The real compiler is authoritative: prefer it whenever it is present.
    if (detection.available && (detection.mode === 'native' || detection.mode === 'wsl') && engine !== 'builtin') {
      const isWindows = process.platform === 'win32';
      const useWsl = detection.mode === 'wsl';
      const cmd = useWsl ? 'wsl' : (isWindows ? 'cmd.exe' : 'bend');
      const baseArgs = useWsl ? ['bend'] : (isWindows ? ['/c', 'bend'] : []);
      const runnerLabel = `${useWsl ? 'WSL' : 'Native'} Bend Compiler (${detection.version})`;

      // `--verdict` re-checks with the Lean-verified kernel. It needs a Lean
      // toolchain, so it is opt-in via GSD_BEND_VERDICT=1.
      const extra = process.env.GSD_BEND_VERDICT === '1' ? ['--verdict'] : [];

      try {
        const res = spawnSync(cmd, [...baseArgs, proofPath, ...extra], { encoding: 'utf8' });
        // bend prints its verdict to stderr and exits 1 on SOME PROOFS FAIL.
        const output = `${res.stderr || ''}${res.stdout || ''}`.trim();
        const passed = res.status === 0;

        if (passed) {
          return {
            success: true,
            output: output || `ALL PROOFS CHECK (${runnerLabel})`,
            runner: runnerLabel,
            engine: 'bend',
            status: extra.length ? 'KERNEL_VERIFIED' : 'PROOFS_CHECKED',
            coverage: extra.length ? 'ALL_INPUTS_KERNEL_CHECKED' : 'ALL_INPUTS_CHECKED_BY_BEND',
            verifiedLaws: lawNames
          };
        }
        return {
          success: false,
          output: output || 'Native Bend proof verification failed.',
          runner: runnerLabel,
          engine: 'bend',
          status: 'PROOFS_FAILED',
          coverage: 'NOT_PROVEN',
          verifiedLaws: []
        };
      } catch (err) {
        return {
          success: false,
          output: err.message,
          runner: runnerLabel,
          engine: 'bend',
          status: 'PROOFS_FAILED',
          coverage: 'NOT_PROVEN',
          verifiedLaws: []
        };
      }
    }

    // Fallback: the built-in evaluator. This samples a small domain and does
    // NOT prove anything, so its reported status and coverage say so.
    const proofContent = fs.readFileSync(proofPath, 'utf8');
    const result = ProofChecker.verify(lawsContent, proofContent, implementationEnv);
    const sampleSize = Evaluator.sampleSize();
    const runner = 'gsd-bend built-in evaluator (sampled domain, NOT a proof checker)';

    if (result.success) {
      return {
        success: true,
        output: `[gsd-bend sampled evaluator] No counterexample found for ${result.verifiedLaws.length} law(s) across the sampled domain.\nSampled: ${sampleSize} values per parameter. This is not a proof.\nVerified laws: ${result.verifiedLaws.join(', ')}`,
        runner,
        engine: 'builtin-sampled',
        status: 'SAMPLED_NO_COUNTEREXAMPLE',
        coverage: `SAMPLED_${sampleSize}_VALUES_PER_PARAM`,
        diagnostics: result.diagnostics,
        verifiedLaws: result.verifiedLaws
      };
    } else {
      return {
        success: false,
        output: `[gsd-bend sampled evaluator] Verification failed:\n${result.errors.join('\n')}`,
        runner,
        engine: 'builtin-sampled',
        status: 'FAILED',
        coverage: 'NOT_PROVEN',
        diagnostics: result.diagnostics,
        errors: result.errors
      };
    }
  }
}
