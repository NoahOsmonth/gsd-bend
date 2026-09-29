import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function runExecute(options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log('⚡ GSD-Bend Execute Phase: AI Implementation & Proof Construction...\n');

  const res = GSDPhaseBridge.execute(root, options);
  if (!res.success) {
    console.error(`❌ ${res.message}`);
    return res;
  }

  console.log('🛡️  Law Lock Integrity Check: PASSED');
  console.log(`   SHA-256: ${res.lawHash}`);
  console.log(`   Active Invariants: ${res.activeLaws.join(', ')}`);
  console.log('\n🤖 Agent Directives:');
  console.log('   1. Implement logic in source code files.');
  console.log('   2. Supply exhaustive inductive proof branches in PROOF.bend.');
  console.log('   3. DO NOT modify LAWS.bend (locked read-only).');
  console.log('   4. DO NOT use mock injections or fake axiom bypasses.');
  console.log('\n🚀 Next step: Run `gsd-bend audit` and `gsd-bend verify` to validate proofs.\n');

  return res;
}
