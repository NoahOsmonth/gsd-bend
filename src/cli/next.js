import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function runNext(options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log('🧭 Evaluating GSD-Bend Lifecycle State & Next Step...\n');

  try {
    const res = GSDPhaseBridge.next(root, options);
    console.log('================================================================');
    console.log(`Current Phase:        ${res.currentPhase.toUpperCase()}`);
    console.log(`Phase Status:         ${res.currentStatus}`);
    console.log(`Recommended Next:     ${res.recommendedCommand}`);
    console.log('----------------------------------------------------------------');
    console.log(`Action: ${res.actionRecommendation}`);
    console.log('================================================================\n');
    return res;
  } catch (err) {
    console.error(`❌ Failed to determine next step: ${err.message}`);
    return { success: false, error: err.message };
  }
}
