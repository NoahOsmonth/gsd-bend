/**
 * LawParser parses LAWS.bend into structured AST representations.
 */
export class LawParser {
  /**
   * Parses the text content of LAWS.bend.
   * @param {string} content
   * @returns {Array<object>} Array of parsed law definitions
   */
  static parse(content) {
    const lines = content.split(/\r?\n/);
    const laws = [];
    let currentLaw = null;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      // Strip comments (hash or slash) and whitespace
      const cleanLine = rawLine.replace(/\s*(?:#|\/\/).*$/, '').trim();

      // Skip empty lines
      if (!cleanLine) {
        continue;
      }

      // Check for start of a law
      const lawMatch = cleanLine.match(/^law\s+([a-zA-Z0-9_]+)\s*:/);
      if (lawMatch) {
        if (currentLaw) {
          laws.push(currentLaw);
        }
        currentLaw = {
          name: lawMatch[1],
          params: [],
          statements: [],
          invariant: null,
          rawLines: [rawLine]
        };
        continue;
      }

      if (currentLaw) {
        currentLaw.rawLines.push(rawLine);

        // Check for parameter: for name: Type
        const paramMatch = cleanLine.match(/^for\s+([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_<>, ]+)/);
        if (paramMatch) {
          currentLaw.params.push({
            name: paramMatch[1],
            type: paramMatch[2].trim()
          });
          continue;
        }

        // Check for invariant constraint: { expression : Type } or { expression }
        const invariantMatch = cleanLine.match(/^\{(.+?)(?:\s*:\s*([a-zA-Z0-9_]+))?\s*\}$/);
        if (invariantMatch) {
          currentLaw.invariant = {
            expression: invariantMatch[1].trim(),
            type: invariantMatch[2] ? invariantMatch[2].trim() : 'Bool'
          };
          continue;
        }

        // Otherwise intermediate statement or assignment
        currentLaw.statements.push(cleanLine);
      }
    }

    if (currentLaw) {
      laws.push(currentLaw);
    }

    return laws;
  }

  /**
   * Extracts custom type definitions (sum types / enums) from code or laws.
   * e.g., type EscrowState = Created | Locked | Released
   * @param {string} content
   * @returns {Map<string, string[]>}
   */
  static parseTypes(content) {
    const types = new Map();
    const typeRegex = /type\s+([a-zA-Z0-9_]+)\s*=\s*([^\n\r]+)/g;
    let match;
    while ((match = typeRegex.exec(content)) !== null) {
      const typeName = match[1];
      const variants = match[2]
        .replace(/\s*(?:#|\/\/).*$/, '')
        .split('|')
        .map(v => v.trim().replace(/^case\s+/, ''))
        .filter(Boolean);
      types.set(typeName, variants);
    }
    return types;
  }
}
