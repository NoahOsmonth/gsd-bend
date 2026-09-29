#!/usr/bin/env node
/**
 * Model Context Protocol (MCP) Server for GSD-Bend
 * Exposes formal verification tools to any MCP-compliant agent:
 * - Claude Desktop / Claude Code
 * - Cursor
 * - Windsurf
 * - Goose
 * - Aider
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Verifier } from '../../src/core/verifier.js';
import { LawLock } from '../../src/core/law-lock.js';
import { AntiCheat } from '../../src/core/anti-cheat.js';
import { GSDPhaseBridge } from '../../src/gsd/phase-bridge.js';
import path from 'path';
import fs from 'fs';

const server = new Server(
  {
    name: 'gsd-bend-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'gsd_bend_new_project',
        description: 'Scaffolds a new formally verified GSD project with .planning/, LAWS.bend, PROOF.bend, and SHA-256 lock.',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: { type: 'string', description: 'Name of the project. Defaults to gsd-bend-app.' },
            projectDir: { type: 'string', description: 'Project root directory. Defaults to CWD.' },
          },
        },
      },
      {
        name: 'gsd_bend_map_codebase',
        description: 'Analyzes project architecture and identifies sensitive state variables as invariant targets in CODEBASE_MAP.md.',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: { type: 'string', description: 'Project root directory. Defaults to CWD.' },
          },
        },
      },
      {
        name: 'gsd_bend_discuss',
        description: 'Captures domain safety requirements and logs formal invariant directives into DISCUSS.md.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Discussion topic or domain invariant specification.' },
            notes: { type: 'string', description: 'Additional discussion notes or constraints.' },
            projectDir: { type: 'string', description: 'Project root directory. Defaults to CWD.' },
          },
        },
      },
      {
        name: 'gsd_bend_plan',
        description: 'Formulates phase plan, locks invariants in LAWS.bend with SHA-256 into laws.lock, and generates PLAN.md.',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: { type: 'string', description: 'Project root directory. Defaults to CWD.' },
          },
        },
      },
      {
        name: 'gsd_bend_execute',
        description: 'Validates immutable law locks, guides AI agent to write logic and exhaustive proofs in PROOF.bend.',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: { type: 'string', description: 'Project root directory. Defaults to CWD.' },
          },
        },
      },
      {
        name: 'gsd_bend_verify',
        description: 'Verify mathematical laws in LAWS.bend using PROOF.bend and project implementation code. Returns mathematical proof verification status or concrete counterexamples.',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: {
              type: 'string',
              description: 'Root directory of the project containing LAWS.bend and PROOF.bend. Defaults to CWD.',
            },
          },
        },
      },
      {
        name: 'gsd_bend_ship',
        description: 'Enforces formal proof ship gate, writes SHIP_SUMMARY.md, and seals release upon 100% mathematical verification.',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: { type: 'string', description: 'Project root directory. Defaults to CWD.' },
          },
        },
      },
      {
        name: 'gsd_bend_status',
        description: 'Retrieves current GSD lifecycle phase, law lock status, and proof attestation status.',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: { type: 'string', description: 'Project root directory. Defaults to CWD.' },
          },
        },
      },
      {
        name: 'gsd_bend_next',
        description: 'Detects current project state and determines or executes the next logical GSD Core phase.',
        inputSchema: {
          type: 'object',
          properties: {
            auto: { type: 'boolean', description: 'Automatically execute next phase if true. Defaults to false.' },
            projectDir: { type: 'string', description: 'Project root directory. Defaults to CWD.' },
          },
        },
      },
      {
        name: 'gsd_bend_lock_laws',
        description: 'Computes and locks the SHA-256 hash of LAWS.bend into .planning/laws.lock to prevent AI agents from tampering with invariants.',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: {
              type: 'string',
              description: 'Project root directory. Defaults to CWD.',
            },
          },
        },
      },
      {
        name: 'gsd_bend_audit_cheating',
        description: 'Audits project code and proofs for Goodhart cheating tactics (mocking, unproven axioms, skipped proof branches, hardcoded returns).',
        inputSchema: {
          type: 'object',
          properties: {
            projectDir: {
              type: 'string',
              description: 'Project root directory. Defaults to CWD.',
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const projectDir = request.params.arguments?.projectDir
    ? path.resolve(request.params.arguments.projectDir)
    : process.cwd();

  switch (request.params.name) {
    case 'gsd_bend_new_project': {
      try {
        const projectName = request.params.arguments?.projectName || 'gsd-bend-app';
        const res = GSDPhaseBridge.newProject(projectDir, projectName);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `new-project failed: ${err.message}` }] };
      }
    }

    case 'gsd_bend_map_codebase': {
      try {
        const res = GSDPhaseBridge.mapCodebase(projectDir);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `map-codebase failed: ${err.message}` }] };
      }
    }

    case 'gsd_bend_discuss': {
      try {
        const topic = request.params.arguments?.topic || 'System Invariants Discussion';
        const notes = request.params.arguments?.notes;
        const res = GSDPhaseBridge.discuss(projectDir, topic, { notes });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `discuss failed: ${err.message}` }] };
      }
    }

    case 'gsd_bend_plan': {
      try {
        const res = GSDPhaseBridge.plan(projectDir);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `plan failed: ${err.message}` }] };
      }
    }

    case 'gsd_bend_execute': {
      try {
        const res = GSDPhaseBridge.execute(projectDir);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `execute failed: ${err.message}` }] };
      }
    }

    case 'gsd_bend_verify': {
      try {
        const result = Verifier.verifyPipeline(projectDir);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Verification failed: ${err.message}` }],
        };
      }
    }

    case 'gsd_bend_ship': {
      try {
        const res = GSDPhaseBridge.ship(projectDir);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `ship failed: ${err.message}` }] };
      }
    }

    case 'gsd_bend_status': {
      try {
        const res = GSDPhaseBridge.getStatus(projectDir);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `status failed: ${err.message}` }] };
      }
    }

    case 'gsd_bend_next': {
      try {
        const isAuto = request.params.arguments?.auto || false;
        const res = GSDPhaseBridge.next(projectDir, { auto: isAuto });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `next failed: ${err.message}` }] };
      }
    }

    case 'gsd_bend_lock_laws': {
      try {
        const lawsPath = path.join(projectDir, 'LAWS.bend');
        if (!fs.existsSync(lawsPath)) {
          return {
            isError: true,
            content: [{ type: 'text', text: `LAWS.bend not found at ${lawsPath}` }],
          };
        }
        const lock = LawLock.lockLaws(projectDir, lawsPath);
        return {
          content: [
            {
              type: 'text',
              text: `LAWS.bend successfully locked with SHA-256: ${lock.sha256}`,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Lock failed: ${err.message}` }],
        };
      }
    }

    case 'gsd_bend_audit_cheating': {
      try {
        const lawsPath = path.join(projectDir, 'LAWS.bend');
        const proofPath = path.join(projectDir, 'PROOF.bend');
        const lawsContent = fs.existsSync(lawsPath) ? fs.readFileSync(lawsPath, 'utf8') : '';
        const proofContent = fs.existsSync(proofPath) ? fs.readFileSync(proofPath, 'utf8') : '';
        const auditResult = AntiCheat.audit(lawsContent, proofContent);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(auditResult, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Audit failed: ${err.message}` }],
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GSD-Bend MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal MCP error:', err);
  process.exit(1);
});
