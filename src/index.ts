#!/usr/bin/env node
/**
 * Entry point: serves the GSAP MCP server over stdio.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { GSAP_VERSION, SKILLS, SKILLS_SOURCE } from './data/skills.js';
import { SKILL_RESOURCES } from './resources/skills.js';
import { buildServer, SERVER_NAME, SERVER_VERSION } from './server.js';

async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // stdout carries the protocol; diagnostics go to stderr.
  console.error(
    `${SERVER_NAME} ${SERVER_VERSION} ready on stdio — ` +
      `${SKILLS.length} official skills, ${SKILL_RESOURCES.length} resources ` +
      `(greensock/gsap-skills @ ${SKILLS_SOURCE.commit.slice(0, 7)}, GSAP ${GSAP_VERSION})`,
  );
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => process.exit(0));
}

main().catch((error: unknown) => {
  console.error('Fatal:', error);
  process.exit(1);
});
