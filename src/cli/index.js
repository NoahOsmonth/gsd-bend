import { runInit } from './init.js';
import { runLaw } from './law.js';
import { runVerify } from './verify.js';
import { runAudit } from './audit.js';
import { runHeal } from './heal.js';
import { runInstallSkill } from './install-skill.js';
import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function main(args = process.argv.slice(2)) {
  const command = args[0] || 'help';

  switch (command) {
    case 'install-skill':
    case 'add-skill': {
      const isGlobal = args.includes('-g') || args.includes('--global');
      const res = runInstallSkill({ global: isGlobal });
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'init':
      return runInit();

    case 'law': {
      const sub = args[1] || 'list';
      const res = runLaw(sub);
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'verify': {
      const res = runVerify();
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'audit': {
      const res = runAudit();
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'heal':
      return runHeal();

    case 'gate': {
      // Direct lifecycle hook for GSD Core
      const check = GSDPhaseBridge.canAdvanceToShip();
      if (check.canAdvance) {
        console.log('✅ GSD Gate Approved: Mathematical proofs valid.');
        return { success: true };
      } else {
        console.error(`❌ GSD Gate Blocked: ${check.reason}`);
        process.exitCode = 1;
        return { success: false, reason: check.reason };
      }
    }

    case 'help':
    case '--help':
    case '-h':
    default:
      console.log(`
gsd-bend: Formal Verification Skill & Engine for GSD Core

Usage:
  gsd-bend <command> [options]

Commands:
  install-skill   Install gsd-bend skill into .agents/skills/ in the current project (-g for global)
  init            Initialize GSD-Bend in the current project (.planning/, LAWS.bend, PROOF.bend)
  law lock        Lock LAWS.bend with SHA-256 canonical hash
  law check       Verify LAWS.bend integrity against laws.lock
  law list        List all declared laws and mathematical invariants
  verify          Execute the Bend 2 formal proof verification gate
  audit           Scan for Goodhart cheating traps, mock injection, and vacuous proofs
  heal            Generate actionable reflection prompt for AI agents on proof failure
  gate            Check if current phase has valid proof attestation to advance to Ship
  help            Show this help message
`);
      return { success: true };
  }
}
