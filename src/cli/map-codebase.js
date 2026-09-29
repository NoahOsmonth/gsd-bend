import { GSDPhaseBridge } from '../gsd/phase-bridge.js';

export function runMapCodebase(options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log('🗺️  Mapping Codebase Architecture for Invariant Targets...\n');

  try {
    const res = GSDPhaseBridge.mapCodebase(root, options);
    console.log(`Analyzed Files: ${res.totalFiles}`);
    console.log(`Critical Invariant Candidates Found: ${res.candidates.length}`);

    if (res.candidates.length > 0) {
      console.log('\nTarget Candidate Modules:');
      res.candidates.slice(0, 10).forEach((c, idx) => {
        console.log(`  [${idx + 1}] ${c.path} (keywords: ${c.keywords.join(', ')})`);
      });
      if (res.candidates.length > 10) {
        console.log(`  ... and ${res.candidates.length - 10} more in ${res.mapFile}`);
      }
    } else {
      console.log('No existing state keywords detected. Ready for greenfield invariant modeling.');
    }

    console.log(`\n📄 Architecture map generated in ${res.mapFile}`);
    console.log(`💡 Next step: Run \`gsd-bend discuss\` or \`gsd-bend plan\` to formalize invariants.\n`);
    return res;
  } catch (err) {
    console.error(`❌ Failed to map codebase: ${err.message}`);
    return { success: false, error: err.message };
  }
}
