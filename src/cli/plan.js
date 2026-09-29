import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function runPlan(options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log('📋 Initiating GSD-Bend Plan Phase...');

  try {
    const res = GSDPhaseBridge.plan(root, options);
    console.log(`🔒 Mathematical invariants locked in .planning/laws.lock`);
    console.log(`   Canonical SHA-256: ${res.lockData.canonicalSha256}`);
    console.log(`   Active laws (${res.laws.length}): ${res.lockData.laws.join(', ')}`);
    console.log(`📝 Generated execution plan in ${res.planFile}`);
    console.log(`🚀 Plan phase complete! Ready for \`gsd-bend execute\` or \`/gsd-bend:execute\`.\n`);
    return { success: true, ...res };
  } catch (err) {
    console.error(`❌ Failed to complete plan phase: ${err.message}`);
    return { success: false, error: err.message };
  }
}
