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
    case 'gsd_bend_verify': {
      try {
        const result = await Verifier.verifyPipeline(projectDir);
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
