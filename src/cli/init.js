import fs from 'node:fs';
import path from 'node:path';
import { LawLock } from '../core/law-lock.js';
import { LAWS_TEMPLATE, PROOF_TEMPLATE } from '../core/templates.js';

export function runInit(options = {}) {
  const root = options.projectRoot || process.cwd();
  const lawsPath = path.join(root, 'LAWS.bend');
  const proofPath = path.join(root, 'PROOF.bend');
  const planningDir = path.join(root, '.planning');
  const lockPath = path.join(planningDir, 'laws.lock');

  console.log('⚡ Initializing GSD-Bend Proof-Verified Workspace...');

  if (!fs.existsSync(planningDir)) {
    fs.mkdirSync(planningDir, { recursive: true });
  }

  // Create template LAWS.bend if not present
  if (!fs.existsSync(lawsPath)) {
    fs.writeFileSync(lawsPath, LAWS_TEMPLATE, 'utf8');
    console.log(` Created ${lawsPath}`);
  }

  // Create template PROOF.bend if not present
  if (!fs.existsSync(proofPath)) {
    fs.writeFileSync(proofPath, PROOF_TEMPLATE, 'utf8');
    console.log(` Created ${proofPath}`);
  }

  // Lock the laws
  const lock = LawLock.lock(lawsPath, lockPath, {
    author: options.author || 'gsd-architect',
    description: 'Initial GSD Invariant Specification'
  });
  console.log(` Locked invariants in ${lockPath} (SHA-256: ${lock.canonicalSha256.slice(0, 12)}...)`);
  console.log(`\n🎉 GSD-Bend initialized. Edit LAWS.bend to state your invariants, then have the agent prove them in PROOF.bend.`);
  console.log(`   Gate: bend PROOF.bend   (prints ALL PROOFS CHECK when every law holds)`);
  return { success: true };
}
