import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function runDiscuss(topic = 'System Invariants Discussion', options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log(`💬 GSD-Bend Discuss Phase: "${topic}"...`);

  try {
    const res = GSDPhaseBridge.discuss(root, topic, options);
    console.log(`📝 Logged discussion directives in ${res.discussFile}`);
    console.log(`💡 Next step: Define invariants in LAWS.bend and run \`gsd-bend plan\`.\n`);
    return { success: true, ...res };
  } catch (err) {
    console.error(`❌ Failed in discuss phase: ${err.message}`);
    return { success: false, error: err.message };
  }
}
