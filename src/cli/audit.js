import fs from 'node:fs';
import path from 'node:path';
import { AntiCheat } from '../core/anti-cheat.js';

export function runAudit(options = {}) {
  const root = options.projectRoot || process.cwd();
  const lawsPath = options.lawsFile || path.join(root, 'LAWS.bend');
  const proofPath = options.proofFile || path.join(root, 'PROOF.bend');

  console.log('🔍 Running Anti-Goodhart Cheating Audit...\n');

  if (!fs.existsSync(lawsPath) || !fs.existsSync(proofPath)) {
    console.error('❌ Both LAWS.bend and PROOF.bend must exist to run audit.');
    return { success: false };
  }

  const lawsContent = fs.readFileSync(lawsPath, 'utf8');
  const proofContent = fs.readFileSync(proofPath, 'utf8');

  let codeContent = '';
  const srcDir = path.join(root, 'src');
  if (fs.existsSync(srcDir)) {
    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          codeContent += '\n' + fs.readFileSync(fullPath, 'utf8');
        }
      }
    };
    walkDir(srcDir);
  }

  const audit = AntiCheat.audit(lawsContent, proofContent, codeContent);

  if (audit.clean) {
    console.log('✅ Audit Clean! No Goodhart cheat attempts or fake mocks detected.');
    return { success: true };
  } else {
    console.log(`🚨 CHEATING ATTEMPTS DETECTED (${audit.infractions.length}):`);
    audit.infractions.forEach((inf, idx) => {
      console.log(`  [${idx + 1}] Type: ${inf.type}`);
      console.log(`      Detail: ${inf.description}`);
      if (inf.line) console.log(`      Line: ${inf.line}`);
    });
    return { success: false, infractions: audit.infractions };
  }
}
