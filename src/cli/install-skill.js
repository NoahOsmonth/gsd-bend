import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runInstallSkill(options = {}) {
  const targetDir = options.targetDir || process.cwd();
  const globalMode = options.global || false;

  console.log('📦 Installing gsd-bend skill to agent directory...');

  // Locate the skill source inside this package
  const skillSourceDir = path.resolve(__dirname, '../../skills/gsd-bend');
  if (!fs.existsSync(skillSourceDir)) {
    console.error(`❌ Error: Source skill directory not found at ${skillSourceDir}`);
    return { success: false, error: 'SOURCE_NOT_FOUND' };
  }

  let destDir;
  if (globalMode) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    destDir = path.join(homeDir, '.gemini', 'antigravity', 'skills', 'gsd-bend');
  } else {
    // Project-level .agents/skills/gsd-bend
    destDir = path.join(targetDir, '.agents', 'skills', 'gsd-bend');
  }

  try {
    fs.mkdirSync(destDir, { recursive: true });
    
    // Copy all files recursively
    function copyRecursive(src, dest) {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    copyRecursive(skillSourceDir, destDir);

    // If installing into a project directory, also set up Claude Code slash commands
    if (!globalMode) {
      const claudeCmdDir = path.join(targetDir, '.claude', 'commands');
      const claudeSubDir = path.join(targetDir, '.claude', 'commands', 'gsd-bend');
      const commandsSrcDir = path.join(skillSourceDir, 'commands');

      if (fs.existsSync(commandsSrcDir)) {
        fs.mkdirSync(claudeSubDir, { recursive: true });
        const cmdEntries = fs.readdirSync(commandsSrcDir);
        for (const cmdFile of cmdEntries) {
          const srcFilePath = path.join(commandsSrcDir, cmdFile);
          if (fs.statSync(srcFilePath).isFile()) {
            fs.copyFileSync(srcFilePath, path.join(claudeCmdDir, cmdFile));
            if (!cmdFile.startsWith('gsd-bend-')) {
              fs.copyFileSync(srcFilePath, path.join(claudeSubDir, cmdFile));
            }
          }
        }
      }
    }

    console.log(`✅ Skill installed successfully!`);
    console.log(`   Destination: ${destDir}`);
    console.log(`   Activated for: Any agent scanning .agents/skills/ or .claude/commands/ (Claude Code, Cursor, Windsurf, Antigravity, GSD Core)`);
    return { success: true, destination: destDir };
  } catch (err) {
    console.error(`❌ Failed to install skill: ${err.message}`);
    return { success: false, error: err.message };
  }
}
