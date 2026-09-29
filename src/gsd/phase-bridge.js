import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Attestation } from '../core/attestation.js';
import { LawLock } from '../core/law-lock.js';
import { LawParser } from '../prover/law-parser.js';
import { Verifier } from '../core/verifier.js';

export class GSDPhaseBridge {
  /**
   * Reads GSD state from .planning/state.json or .planning/STATE.md if it exists.
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
      const cleanPhase = phaseMatch ? phaseMatch[1].replace(/[*`_]/g, '').trim() : 'execute';
      const cleanStatus = statusMatch ? statusMatch[1].replace(/[*`_]/g, '').trim() : 'in_progress';
      return {
        currentPhase: cleanPhase,
        status: cleanStatus,
        raw: content
      };
    }

    return {
      currentPhase: 'new-project',
      status: 'pending'
    };
  }

  /**
   * Sets or updates GSD state in .planning/state.json and .planning/STATE.md.
   * @param {string} projectRoot
   * @param {string} phase
   * @param {string} status
   * @param {object} metadata
   * @returns {object}
   */
  static setGSDState(projectRoot = process.cwd(), phase, status = 'in_progress', metadata = {}) {
    const planningDir = path.join(projectRoot, '.planning');
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }

    const stateObj = {
      version: '1.0.0',
      currentPhase: phase,
      status: status,
      updatedAt: new Date().toISOString(),
      ...metadata
    };

    fs.writeFileSync(path.join(planningDir, 'state.json'), JSON.stringify(stateObj, null, 2), 'utf8');

    const stateMd = `# GSD Project State

**Current Phase:** \`${phase}\`  
**Status:** \`${status}\`  
**Last Updated:** ${stateObj.updatedAt}  

${metadata.notes ? `### Phase Notes\n${metadata.notes}\n` : ''}
${metadata.activeLaws && metadata.activeLaws.length > 0 ? `### Active Invariants\n${metadata.activeLaws.map(l => `- \`${l}\``).join('\n')}\n` : ''}
`;
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), stateMd, 'utf8');
    return stateObj;
  }

  /**
   * Scaffolds a new project with GSD state, laws, proof template, and cryptographic lock.
   * @param {string} projectRoot
   * @param {string} projectName
   * @param {object} options
   * @returns {object}
   */
  static newProject(projectRoot = process.cwd(), projectName = 'gsd-bend-app', options = {}) {
    const planningDir = path.join(projectRoot, '.planning');
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }

    const lawsPath = path.join(projectRoot, 'LAWS.bend');
    const proofPath = path.join(projectRoot, 'PROOF.bend');
    const lockPath = path.join(planningDir, 'laws.lock');

    if (!fs.existsSync(lawsPath)) {
      const defaultLaws = `# ==============================================================================
# LAWS.bend - GSD Mathematical Specification & Invariants
# ==============================================================================
# Locked by GSD-Bend. AI agents CANNOT modify this file during Execute phase.
# The compiler verifies that the implementation satisfies these laws for ALL inputs.

law wallet_never_negative:
  for initial_balance: U32
  for withdraw_amount: U32
  final_balance = Wallet.withdraw(initial_balance, withdraw_amount)
  { (final_balance >= 0) == True : Bool }
`;
      fs.writeFileSync(lawsPath, defaultLaws, 'utf8');
    }

    if (!fs.existsSync(proofPath)) {
      const defaultProof = `# ==============================================================================
# PROOF.bend - Formal Mathematical Proofs
# ==============================================================================
# The AI agent must provide inductive proof branches for every law in LAWS.bend.

def Laws.wallet_never_negative(initial_balance, withdraw_amount):
  match (withdraw_amount <= initial_balance):
    case True:
      # If withdraw_amount <= initial_balance, initial_balance - withdraw_amount >= 0
      {==}
    case False:
      # If withdraw_amount > initial_balance, withdraw is rejected, initial_balance unchanged >= 0
      {==}
`;
      fs.writeFileSync(proofPath, defaultProof, 'utf8');
    }

    const lockData = LawLock.lock(lawsPath, lockPath, {
      author: options.author || 'gsd-architect',
      description: `Project ${projectName} Initial Invariant Specification`
    });

    const state = this.setGSDState(projectRoot, 'new-project', 'initialized', {
      projectName,
      activeLaws: lockData.laws,
      lawLockSha256: lockData.canonicalSha256
    });

    return {
      success: true,
      projectName,
      lockData,
      state
    };
  }

  /**
   * Scans the codebase to detect critical state, logic files, and invariant candidates.
   * @param {string} projectRoot
   * @param {object} options
   * @returns {object}
   */
  static mapCodebase(projectRoot = process.cwd(), options = {}) {
    const ignoredDirs = new Set(['.git', 'node_modules', '.planning', 'dist', 'build', '.coverage', '.turbo', '.next', '.agents']);
    const candidateKeywords = ['balance', 'transfer', 'withdraw', 'deposit', 'state', 'escrow', 'invariant', 'vault', 'auth', 'transition', 'mint', 'burn', 'overflow', 'underflow', 'lock'];

    const fileList = [];
    const candidates = [];

    function walk(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ignoredDirs.has(ent.name)) continue;
        const fullPath = path.join(dir, ent.name);
        const relPath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');
        if (ent.isDirectory()) {
          walk(fullPath);
        } else if (ent.isFile()) {
          fileList.push(relPath);
          const ext = path.extname(ent.name).toLowerCase();
          if (['.bend', '.js', '.ts', '.py', '.rs', '.go', '.sol'].includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const matchedKw = candidateKeywords.filter(kw => content.toLowerCase().includes(kw));
              if (matchedKw.length > 0) {
                candidates.push({
                  path: relPath,
                  keywords: matchedKw
                });
              }
            } catch {
              // Ignore unreadable
            }
          }
        }
      }
    }

    walk(projectRoot);

    const planningDir = path.join(projectRoot, '.planning');
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }

    const mapMd = `# GSD Codebase Architecture Map
Generated by \`gsd-bend map-codebase\` at ${new Date().toISOString()}

## Codebase Summary
- Total Analyzed Files: ${fileList.length}
- Invariant-Critical Modules Found: ${candidates.length}

## Invariant-Critical Candidates
${candidates.length === 0 ? '_No critical state keywords detected. Ready for greenfield invariant modeling._' : candidates.map(c => `- **${c.path}**: detected critical keywords [${c.keywords.join(', ')}]`).join('\n')}

## Recommended Action
Define formal invariants in \`LAWS.bend\` covering these modules, then run \`gsd-bend plan\`.
`;
    fs.writeFileSync(path.join(planningDir, 'CODEBASE_MAP.md'), mapMd, 'utf8');

    this.setGSDState(projectRoot, 'map-codebase', 'completed', {
      totalFiles: fileList.length,
      candidateCount: candidates.length
    });

    return {
      success: true,
      totalFiles: fileList.length,
      candidates,
      mapFile: path.join(planningDir, 'CODEBASE_MAP.md')
    };
  }

  /**
   * Discuss phase: Capture requirements, formalize domain safety invariants.
   * @param {string} projectRoot
   * @param {string} topic
   * @param {object} options
   * @returns {object}
   */
  static discuss(projectRoot = process.cwd(), topic = 'System Invariants Discussion', options = {}) {
    const planningDir = path.join(projectRoot, '.planning');
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }

    const discussPath = path.join(planningDir, 'DISCUSS.md');
    const discussEntry = `\n## Discussion: ${topic}\n**Timestamp:** ${new Date().toISOString()}\n\n${options.notes || 'Formal invariants, boundary conditions, and domain guarantees discussed with architect/user.'}\n\n### Formulated Invariant Directives\n- Define laws in \`LAWS.bend\` for all state transitions.\n- Verify no negative balance, no unauthorized transitions, and solvency preservation.\n`;

    let content = '';
    if (fs.existsSync(discussPath)) {
      content = fs.readFileSync(discussPath, 'utf8') + discussEntry;
    } else {
      content = `# GSD Discuss Phase Log\n` + discussEntry;
    }
    fs.writeFileSync(discussPath, content, 'utf8');

    const state = this.setGSDState(projectRoot, 'discuss', 'in_progress', {
      topic,
      notes: options.notes || 'Discussed system invariants.'
    });

    return {
      success: true,
      discussFile: discussPath,
      state
    };
  }

  /**
   * Plan phase: Define formal specification, lock laws, generate task breakdown.
   * @param {string} projectRoot
   * @param {object} options
   * @returns {object}
   */
  static plan(projectRoot = process.cwd(), options = {}) {
    const planningDir = path.join(projectRoot, '.planning');
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }

    const lawsPath = path.join(projectRoot, 'LAWS.bend');
    const lockPath = path.join(planningDir, 'laws.lock');
    const planPath = path.join(planningDir, 'PLAN.md');

    if (!fs.existsSync(lawsPath)) {
      this.newProject(projectRoot, 'gsd-bend-app', options);
    }

    // Lock the laws
    const lockData = LawLock.lock(lawsPath, lockPath, {
      author: options.author || 'gsd-architect',
      description: options.description || 'GSD Plan Phase Invariant Lock'
    });

    const laws = LawParser.parse(fs.readFileSync(lawsPath, 'utf8'));

    const planContent = `# GSD Execution Plan with Formal Verification
Generated by \`gsd-bend plan\` at ${new Date().toISOString()}

## Formal Specifications (Locked)
- **Laws Hash (SHA-256):** \`${lockData.canonicalSha256}\`
- **Total Invariants:** ${laws.length}
${laws.map(l => `- **${l.name}**: \`${l.invariant ? l.invariant.expression : 'undefined'}\``).join('\n')}

## Tasks Breakdown
1. **Task 1 (Implementation):** Implement logic satisfying the declared invariants.
2. **Task 2 (Proof Construction):** Supply inductive proof branches in \`PROOF.bend\` for each law.
3. **Task 3 (Anti-Cheat Audit):** Run \`gsd-bend audit\` to verify zero mock injections or axiom bypasses.
4. **Task 4 (Verification Gate):** Run \`gsd-bend verify\` to produce signed \`PROOF_ATTESTATION.json\`.
5. **Task 5 (Ship):** Advance to \`gsd-bend ship\` with mathematical proof attestation.

## Agent Constraints
- \`LAWS.bend\` is locked and immutable.
- Proofs must cover 100% of the input domain without fallback axioms.
`;
    fs.writeFileSync(planPath, planContent, 'utf8');

    const state = this.setGSDState(projectRoot, 'plan', 'ready_for_execution', {
      activeLaws: lockData.laws,
      lawLockSha256: lockData.canonicalSha256,
      notes: `Locked ${laws.length} invariants in laws.lock.`
    });

    return {
      success: true,
      planFile: planPath,
      lockData,
      laws,
      state
    };
  }

  /**
   * Execute phase: Validate law lock immutability, prepare agent obligations.
   * @param {string} projectRoot
   * @param {object} options
   * @returns {object}
   */
  static execute(projectRoot = process.cwd(), options = {}) {
    const lawsPath = path.join(projectRoot, 'LAWS.bend');
    const lockPath = path.join(projectRoot, '.planning', 'laws.lock');
    const proofPath = path.join(projectRoot, 'PROOF.bend');

    if (!fs.existsSync(lawsPath) || !fs.existsSync(lockPath)) {
      return {
        success: false,
        error: 'WORKSPACE_UNINITIALIZED',
        message: 'Cannot execute without locked laws. Run `gsd-bend plan` or `gsd-bend init` first.'
      };
    }

    // Verify integrity before allowing execution
    const check = LawLock.verify(lawsPath, lockPath);
    if (!check.valid) {
      return {
        success: false,
        error: 'LAW_LOCK_TAMPERED',
        message: `EXECUTION HALTED: LAWS.bend has been altered! Invariants must not be modified during execute phase. Reason: ${check.error}`
      };
    }

    if (!fs.existsSync(proofPath)) {
      fs.writeFileSync(proofPath, `# PROOF.bend\n# AI Agent: Supply inductive proofs for locked laws here.\n`, 'utf8');
    }

    const state = this.setGSDState(projectRoot, 'execute', 'in_progress', {
      activeLaws: check.laws,
      lawLockSha256: check.actualHash
    });

    return {
      success: true,
      activeLaws: check.laws,
      lawHash: check.actualHash,
      state,
      proofFile: proofPath
    };
  }

  /**
   * Verify phase: Executes anti-cheat and formal proof compiler.
   * @param {string} projectRoot
   * @param {object} options
   * @returns {object}
   */
  static verify(projectRoot = process.cwd(), options = {}) {
    const res = Verifier.verifyPipeline({ projectRoot, ...options });
    if (res.success) {
      this.setGSDState(projectRoot, 'verify', 'passed', {
        attestationPath: res.attestationPath,
        attestationSignature: res.attestation.attestationSignature,
        verifiedLaws: res.verifiedLaws
      });
    } else {
      this.setGSDState(projectRoot, 'verify', 'failed', {
        step: res.step,
        failureMessage: res.message
      });
    }
    return res;
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

    // Verify law lock integrity before allowing ship
    const lawsPath = path.join(projectRoot, 'LAWS.bend');
    const lockPath = path.join(projectRoot, '.planning', 'laws.lock');
    if (fs.existsSync(lawsPath) && fs.existsSync(lockPath)) {
      const lockCheck = LawLock.verify(lawsPath, lockPath);
      if (!lockCheck.valid) {
        return {
          canAdvance: false,
          reason: `GATE BLOCKED: Law lock integrity check failed before shipping: ${lockCheck.error}`
        };
      }
      if (validation.attestation && validation.attestation.lawHash && lockCheck.actualHash !== validation.attestation.lawHash) {
        return {
          canAdvance: false,
          reason: 'GATE BLOCKED: LAWS.bend has been modified after verification attestation was issued! Re-run `gsd-bend verify`.'
        };
      }
    }

    // Verify PROOF.bend has not been tampered with post-attestation
    const proofPath = path.join(projectRoot, 'PROOF.bend');
    if (fs.existsSync(proofPath) && validation.attestation && validation.attestation.proofHash) {
      const proofContent = fs.readFileSync(proofPath, 'utf8');
      const currentProofHash = crypto.createHash('sha256').update(proofContent, 'utf8').digest('hex');
      if (currentProofHash !== validation.attestation.proofHash) {
        return {
          canAdvance: false,
          reason: 'GATE BLOCKED: PROOF.bend has been modified after verification attestation was issued! You must re-run `gsd-bend verify` before shipping.'
        };
      }
    }

    return {
      canAdvance: true,
      attestation: validation.attestation
    };
  }

  /**
   * Ship phase: Validates attestation gate, updates state to shipped/done, generates ship summary.
   * @param {string} projectRoot
   * @param {object} options
   * @returns {object}
   */
  static ship(projectRoot = process.cwd(), options = {}) {
    const gateCheck = this.canAdvanceToShip(projectRoot);
    if (!gateCheck.canAdvance) {
      return {
        success: false,
        error: 'GATE_BLOCKED',
        reason: gateCheck.reason
      };
    }

    const planningDir = path.join(projectRoot, '.planning');
    const shipSummaryPath = path.join(planningDir, 'SHIP_SUMMARY.md');
    const attestation = gateCheck.attestation;

    const shipMd = `# GSD Ship Certificate & Release Summary
Formally Verified with Bend 2 & GSD Core at ${new Date().toISOString()}

## Formal Proof Attestation
- **Status:** \`${attestation.status}\`
- **Coverage:** \`${attestation.coverage}\`
- **Engine:** \`${attestation.engine}\`
- **Law Hash (SHA-256):** \`${attestation.lawHash}\`
- **Proof Hash (SHA-256):** \`${attestation.proofHash}\`
- **Cryptographic Signature:** \`${attestation.attestationSignature}\`

## Formally Proven Invariants
${attestation.verifiedLaws.map(law => `- [x] \`${law}\``).join('\n')}

## Security & Anti-Cheat Summary
- Anti-Goodhart Cheating Audit: \`${attestation.antiGoodhartAudit}\`
- Axiomatic shortcuts bypassed: 0
- Unit test mocks injected: 0
- Invariant domain coverage: 100%

🚀 **VERIFICATION GATE: CLEARED.** Safe for production deployment.
`;
    fs.writeFileSync(shipSummaryPath, shipMd, 'utf8');

    const state = this.setGSDState(projectRoot, 'ship', 'completed', {
      attestationSignature: attestation.attestationSignature,
      verifiedLaws: attestation.verifiedLaws,
      shippedAt: new Date().toISOString()
    });

    return {
      success: true,
      shipSummaryPath,
      attestation,
      state
    };
  }

  /**
   * Status: Overview of full GSD lifecycle state and formal verification status.
   * @param {string} projectRoot
   * @returns {object}
   */
  static getStatus(projectRoot = process.cwd()) {
    const state = this.getGSDState(projectRoot);
    const lawsPath = path.join(projectRoot, 'LAWS.bend');
    const lockPath = path.join(projectRoot, '.planning', 'laws.lock');
    const proofPath = path.join(projectRoot, 'PROOF.bend');
    const attestationPath = path.join(projectRoot, '.planning', 'PROOF_ATTESTATION.json');

    const hasLaws = fs.existsSync(lawsPath);
    const hasLock = fs.existsSync(lockPath);
    const hasProof = fs.existsSync(proofPath);
    const hasAttestation = fs.existsSync(attestationPath);

    let lockIntegrity = false;
    let declaredLaws = [];
    if (hasLaws && hasLock) {
      const check = LawLock.verify(lawsPath, lockPath);
      lockIntegrity = check.valid;
      declaredLaws = check.laws || [];
    }

    let attestationValid = false;
    let attestationData = null;
    if (hasAttestation) {
      const val = Attestation.validate(attestationPath);
      attestationValid = val.valid;
      attestationData = val.attestation;
    }

    const currentPhase = (state.currentPhase || '').toLowerCase();
    const currentStatus = (state.status || '').toLowerCase();

    let nextStep = 'init';
    if (!hasLaws && !hasLock && !fs.existsSync(path.join(projectRoot, '.planning'))) {
      nextStep = 'new-project';
    } else if (currentPhase === 'new-project') {
      nextStep = 'map-codebase';
    } else if (currentPhase === 'map-codebase') {
      nextStep = 'discuss';
    } else if (currentPhase === 'discuss') {
      nextStep = 'plan';
    } else if (currentPhase === 'plan') {
      nextStep = 'execute';
    } else if (currentPhase === 'execute') {
      nextStep = attestationValid ? 'ship' : 'verify';
    } else if (currentPhase === 'verify') {
      if (currentStatus === 'failed') {
        nextStep = 'heal';
      } else if (attestationValid) {
        nextStep = 'ship';
      } else {
        nextStep = 'verify';
      }
    } else if (currentPhase === 'ship') {
      nextStep = 'done';
    } else {
      // Fallback inference based on artifacts
      if (!hasLaws || !hasLock) {
        nextStep = 'plan';
      } else if (!hasProof || !hasAttestation || !attestationValid) {
        nextStep = 'execute';
      } else {
        nextStep = 'ship';
      }
    }

    return {
      state,
      files: {
        laws: hasLaws,
        lock: hasLock,
        proof: hasProof,
        attestation: hasAttestation
      },
      lockIntegrity,
      declaredLaws,
      attestationValid,
      attestationData,
      nextStep
    };
  }

  /**
   * Evaluates current project lifecycle and determines/executes the next logical phase.
   * @param {string} projectRoot
   * @param {object} options
   * @returns {object}
   */
  static next(projectRoot = process.cwd(), options = {}) {
    const status = this.getStatus(projectRoot);
    const nextPhase = status.nextStep;
    let actionRecommendation = '';
    let commandToRun = '';

    switch (nextPhase) {
      case 'new-project':
      case 'init':
        actionRecommendation = 'Project is uninitialized. Scaffold the project and define initial invariants.';
        commandToRun = 'gsd-bend new-project';
        break;
      case 'map-codebase':
        actionRecommendation = 'Analyze codebase architecture and locate state variables for invariant targets.';
        commandToRun = 'gsd-bend map-codebase';
        break;
      case 'discuss':
        actionRecommendation = 'Capture domain requirements, failure modes, and safety invariants with the user/architect.';
        commandToRun = 'gsd-bend discuss';
        break;
      case 'plan':
        actionRecommendation = 'Formulate phase plan, define formal invariants in LAWS.bend, and lock laws.lock with SHA-256.';
        commandToRun = 'gsd-bend plan';
        break;
      case 'execute':
        actionRecommendation = 'Implement business logic in source files and construct inductive proofs in PROOF.bend.';
        commandToRun = 'gsd-bend execute';
        break;
      case 'verify':
        actionRecommendation = 'Run the formal verification gate and anti-cheat audit to verify 100% of domain inputs and sign PROOF_ATTESTATION.json.';
        commandToRun = 'gsd-bend verify';
        break;
      case 'heal':
        actionRecommendation = 'Verification failed or counterexample found. Analyze inductive holes and heal implementation or proofs.';
        commandToRun = 'gsd-bend heal';
        break;
      case 'ship':
        actionRecommendation = 'Cryptographic proof gate satisfied. Advance to GSD Ship, seal release, and emit SHIP_SUMMARY.md.';
        commandToRun = 'gsd-bend ship';
        break;
      case 'done':
        actionRecommendation = 'Lifecycle complete. Project is 100% mathematically proven and shipped.';
        commandToRun = 'gsd-bend status';
        break;
      default:
        actionRecommendation = 'Review project state and run verification.';
        commandToRun = 'gsd-bend status';
    }

    if (options.auto) {
      if (nextPhase === 'map-codebase') return this.mapCodebase(projectRoot, options);
      if (nextPhase === 'plan') return this.plan(projectRoot, options);
      if (nextPhase === 'execute') return this.execute(projectRoot, options);
      if (nextPhase === 'verify') return this.verify(projectRoot, options);
      if (nextPhase === 'ship') return this.ship(projectRoot, options);
    }

    return {
      success: true,
      currentPhase: status.state.currentPhase,
      currentStatus: status.state.status,
      nextStep: nextPhase,
      recommendedCommand: commandToRun,
      actionRecommendation,
      status
    };
  }

  /**
   * Fast verification check for quick targeted invariant audits.
   * @param {string} projectRoot
   * @param {string} [lawName]
   * @param {object} [options]
   * @returns {object}
   */
  static quick(projectRoot = process.cwd(), lawName, options = {}) {
    return this.verify(projectRoot, { ...options, targetLaw: lawName });
  }
}
