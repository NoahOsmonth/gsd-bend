import { runInit } from './init.js';
import { runLaw } from './law.js';
import { runVerify } from './verify.js';
import { runAudit } from './audit.js';
import { runHeal } from './heal.js';
import { runInstallSkill } from './install-skill.js';
import { runPlan } from './plan.js';
import { runDiscuss } from './discuss.js';
import { runExecute } from './execute.js';
import { runShip } from './ship.js';
import { runMapCodebase } from './map-codebase.js';
import { runNewProject } from './new-project.js';
import { runStatus } from './status.js';
import { runNext } from './next.js';
import { runQuick } from './quick.js';
import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function main(args = process.argv.slice(2)) {
  let command = args[0] || 'help';

  // Normalize slash commands and namespaces:
  // e.g. /gsd-bend:plan -> plan, gsd-bend-plan -> plan, /plan -> plan, :plan -> plan
  if (command.startsWith('/')) command = command.slice(1);
  if (command.startsWith('gsd-bend:')) command = command.slice('gsd-bend:'.length);
  if (command.startsWith('gsd-bend-')) command = command.slice('gsd-bend-'.length);
  if (command.startsWith('gsd:')) command = command.slice('gsd:'.length);
  if (command.startsWith(':')) command = command.slice(1);

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

    case 'new-project':
    case 'new': {
      const projectName = args[1] || 'gsd-bend-app';
      const res = runNewProject(projectName);
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'map-codebase':
    case 'map': {
      const res = runMapCodebase();
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'discuss': {
      const topic = args.slice(1).join(' ') || 'System Invariants Discussion';
      const res = runDiscuss(topic);
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'plan': {
      const res = runPlan();
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'execute': {
      const res = runExecute();
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'verify': {
      const res = runVerify();
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'ship': {
      const res = runShip();
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'status': {
      const res = runStatus();
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'next': {
      const isAuto = args.includes('--auto') || args.includes('-a');
      const res = runNext({ auto: isAuto });
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'quick': {
      const lawName = args[1];
      const res = runQuick(lawName);
      if (!res.success) process.exitCode = 1;
      return res;
    }

    case 'law': {
      const sub = args[1] || 'list';
      const res = runLaw(sub);
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

Full GSD Lifecycle Commands:
  new-project [name]  Scaffold a new GSD project with a locked law spec
  map-codebase        Analyze codebase architecture and locate invariant targets
  discuss [topic]     Capture domain requirements and define safety invariants
  plan                Formulate phase plan, lock LAWS.bend with SHA-256 in laws.lock
  execute             Run AI implementation and inductive proof construction
  verify              Compile Bend 2 formal proofs and generate attestation
  ship                Enforce verification gate and seal release with proof certificate
  status              Display current GSD phase lifecycle and proof gate status
  next [--auto]       Detect current state and route or advance to the next GSD phase
  quick [law]         Quickly verify an invariant or run lightweight verification check

Proof & Security Commands:
  law lock            Lock LAWS.bend with SHA-256 canonical hash
  law check           Verify LAWS.bend integrity against laws.lock
  law list            List all declared laws and mathematical invariants
  audit               Scan for Goodhart cheating traps, mock injection, and vacuous proofs
  heal                Generate actionable reflection prompt for AI agents on proof failure
  gate                Direct hook checking if current phase can advance to Ship

Integration Commands:
  install-skill       Install skill into .agents/skills/ (-g for global agent skills)
  init                Quick initialize GSD-Bend in current project
  help                Show this help message
`);
      return { success: true };
  }
}
