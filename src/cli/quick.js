import { runVerify } from './verify.js';

export function runQuick(lawName, options = {}) {
  const root = options.projectRoot || process.cwd();
  console.log('⚡ GSD-Bend Quick Verification...\n');

  if (lawName) {
    console.log(`Auditing target law: "${lawName}"`);
  }
  return runVerify({ ...options, projectRoot: root });
}
