import fs from 'node:fs';
import path from 'node:path';
import { LawLock } from '../core/law-lock.js';

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
    console.log(` Created ${lawsPath}`);
  }

  // Create template PROOF.bend if not present
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
    console.log(` Created ${proofPath}`);
  }

  // Lock the laws
  const lock = LawLock.lock(lawsPath, lockPath, {
    author: options.author || 'gsd-architect',
    description: 'Initial GSD Invariant Specification'
  });
  console.log(` Locked invariants in ${lockPath} (SHA-256: ${lock.canonicalSha256.slice(0, 12)}...)`);
  console.log(`\n🎉 GSD-Bend initialized successfully! AI agents can now execute code against unbreakable formal proofs.`);
  return { success: true };
}
