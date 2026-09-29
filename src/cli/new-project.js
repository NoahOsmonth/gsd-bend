import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function runNewProject(projectName = 'gsd-bend-app', options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log(`🚀 Scaffolding new GSD-Bend project: "${projectName}"...\n`);

  try {
    const res = GSDPhaseBridge.newProject(root, projectName, options);
    console.log(`✅ Project "${projectName}" initialized!`);
    console.log(`   Scaffolded: .planning/, LAWS.bend, PROOF.bend`);
    console.log(`   Initial Invariants Locked: ${res.lockData.laws.join(', ')}`);
    console.log(`   Lock SHA-256: ${res.lockData.canonicalSha256}`);
    console.log(`\n💡 Next step: Run \`gsd-bend plan\` to customize invariants or \`gsd-bend execute\` to start building.\n`);
    return res;
  } catch (err) {
    console.error(`❌ Failed to scaffold new project: ${err.message}`);
    return { success: false, error: err.message };
  }
}
