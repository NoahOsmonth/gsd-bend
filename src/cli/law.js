import fs from 'node:fs';
import path from 'node:path';
import { LawLock } from '../core/law-lock.js';
import { LawParser } from '../prover/law-parser.js';

export function runLaw(subcommand, options = {}) {
  const root = options.projectRoot || process.cwd();
  const lawsPath = options.lawsFile || path.join(root, 'LAWS.bend');
  const lockPath = options.lockFile || path.join(root, '.planning', 'laws.lock');

  if (!fs.existsSync(lawsPath)) {
    console.error(`❌ LAWS file not found: ${lawsPath}`);
    return { success: false, error: 'LAWS file not found' };
  }

  if (subcommand === 'lock') {
    try {
      const lockData = LawLock.lock(lawsPath, lockPath, {
        author: options.author || 'gsd-architect',
        description: options.description || 'Manual law lock'
      });
      console.log(`🔒 LAWS.bend successfully locked!`);
      console.log(`   Canonical SHA-256: ${lockData.canonicalSha256}`);
      console.log(`   Locked laws (${lockData.lawCount}): ${lockData.laws.join(', ')}`);
      return { success: true, lockData };
    } catch (err) {
      console.error(`❌ Failed to lock laws: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  if (subcommand === 'check' || subcommand === 'verify') {
    const res = LawLock.verify(lawsPath, lockPath);
    if (res.valid) {
      console.log(`✅ LAWS.bend integrity verified. Hash matches laws.lock.`);
      console.log(`   SHA-256: ${res.actualHash}`);
      console.log(`   Active laws: ${res.laws.join(', ')}`);
      return { success: true };
    } else {
      console.error(`🚨 INTEGRITY ERROR: ${res.error}`);
      return { success: false, error: res.error };
    }
  }

  if (subcommand === 'list') {
    const content = fs.readFileSync(lawsPath, 'utf8');
    const laws = LawParser.parse(content);
    console.log(`📋 Declared Laws in ${path.basename(lawsPath)} (${laws.length} total):`);
    laws.forEach((l, idx) => {
      console.log(`  ${idx + 1}. [${l.name}]`);
      console.log(`     Params: ${l.params.map(p => `${p.name}: ${p.type}`).join(', ') || 'none'}`);
      console.log(`     Invariant: { ${l.invariant ? l.invariant.expression : 'undefined'} : ${l.invariant ? l.invariant.type : 'Bool'} }`);
    });
    return { success: true, laws };
  }

  console.log(`Unknown law subcommand: ${subcommand}. Available: lock, check, list`);
  return { success: false };
}
