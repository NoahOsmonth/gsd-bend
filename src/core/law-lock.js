import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class LawLock {
  /**
   * Normalizes law content to produce a canonical representation.
   * Strips comment-only lines, blank lines, and normalizes indentation.
   * @param {string} content
   * @returns {string}
   */
  static canonicalize(content) {
    return content
      .split(/\r?\n/)
      .map(line => line.replace(/\s*(?:#|\/\/).*$/, '').trimEnd())
      .filter(line => line.trim().length > 0)
      .join('\n');
  }

  /**
   * Computes the SHA-256 hash of canonical law content.
   * @param {string} content
   * @returns {string}
   */
  static hash(content) {
    const canonical = this.canonicalize(content);
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Creates or updates the laws.lock file.
   * @param {string} lawsPath - Path to LAWS.bend
   * @param {string} lockPath - Path to laws.lock (typically in .planning/laws.lock)
   * @param {object} metadata - Optional author/version metadata
   * @returns {object} The created lock object
   */
  static lock(lawsPath, lockPath, metadata = {}) {
    if (!fs.existsSync(lawsPath)) {
      throw new Error(`LAWS file not found: ${lawsPath}`);
    }

    const content = fs.readFileSync(lawsPath, 'utf8');
    const hash = this.hash(content);
    
    // Parse law names defined in the file
    const lawNames = [];
    const lawRegex = /^law\s+([a-zA-Z0-9_]+)\s*:/gm;
    let match;
    while ((match = lawRegex.exec(content)) !== null) {
      lawNames.push(match[1]);
    }

    const lockData = {
      version: '1.0.0',
      lockedAt: new Date().toISOString(),
      lawsFile: path.basename(lawsPath),
      canonicalSha256: hash,
      sha256: hash,
      lawCount: lawNames.length,
      laws: lawNames,
      lockedBy: metadata.author || 'gsd-architect',
      description: metadata.description || 'GSD Invariant Specification Lock'
    };

    const dir = path.dirname(lockPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2), 'utf8');
    return lockData;
  }

  /**
   * Convenience helper to lock LAWS.bend for a project directory.
   * @param {string} projectDir
   * @param {string} [lawsPath]
   * @param {object} [metadata]
   * @returns {object}
   */
  static lockLaws(projectDir = process.cwd(), lawsPath, metadata = {}) {
    const defaultLaws = lawsPath || path.join(projectDir, 'LAWS.bend');
    const lockPath = path.join(projectDir, '.planning', 'laws.lock');
    return this.lock(defaultLaws, lockPath, metadata);
  }

  /**
   * Verifies that LAWS.bend matches the recorded lock.
   * @param {string} lawsPath
   * @param {string} lockPath
   * @returns {{ valid: boolean, error?: string, recordedHash?: string, actualHash?: string }}
   */
  static verify(lawsPath, lockPath) {
    if (!fs.existsSync(lockPath)) {
      return {
        valid: false,
        error: `Law lock file missing: ${lockPath}. Run 'gsd-bend law lock' first.`
      };
    }
    if (!fs.existsSync(lawsPath)) {
      return {
        valid: false,
        error: `LAWS file missing: ${lawsPath}`
      };
    }

    const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const content = fs.readFileSync(lawsPath, 'utf8');
    const actualHash = this.hash(content);

    if (actualHash !== lockData.canonicalSha256) {
      return {
        valid: false,
        error: `LAW_LOCK_VIOLATION: LAWS.bend has been modified without authorization! Recorded hash: ${lockData.canonicalSha256}, Actual: ${actualHash}`,
        recordedHash: lockData.canonicalSha256,
        actualHash
      };
    }

    return {
      valid: true,
      recordedHash: lockData.canonicalSha256,
      actualHash,
      laws: lockData.laws
    };
  }
}
