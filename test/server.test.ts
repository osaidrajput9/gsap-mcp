import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SKILLS } from '../src/data/skills.js';
import { buildServer, SERVER_NAME, SERVER_VERSION } from '../src/server.js';

/** Every tool name that must keep working for existing callers. */
const ORIGINAL_TOOLS = [
  'understand_and_create_animation',
  'get_gsap_api_expert',
  'generate_complete_setup',
  'debug_animation_issue',
  'optimize_for_performance',
  'create_production_pattern',
];

const NEW_TOOLS = ['get_gsap_guidance', 'validate_gsap_code'];

async function connectInMemory(): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([
    buildServer().connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

describe('MCP server', () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectInMemory();
  });

  afterAll(async () => {
    await client.close();
  });

  it('reports its name and version', () => {
    expect(client.getServerVersion()).toMatchObject({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });
  });

  it('reports the version this package actually is', () => {
    // The check above compares the server against itself, so it holds however
    // wrong SERVER_VERSION is. This one anchors it to package.json.
    //
    // It was hardcoded until 2.0.1, which shipped a server introducing itself
    // to every client as 2.0.0: `npm version` rewrites package.json and the
    // lockfile, and has no reason to know about a string in a .ts file.
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
    );
    expect(client.getServerVersion()?.version).toBe(pkg.version);
  });

  it('lists every tool, old and new', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    for (const name of [...ORIGINAL_TOOLS, ...NEW_TOOLS]) {
      expect(names).toContain(name);
    }
    expect(names).toHaveLength(ORIGINAL_TOOLS.length + NEW_TOOLS.length);
  });

  it('marks every tool read-only', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool.annotations?.openWorldHint).toBe(false);
      expect(tool.description?.length ?? 0).toBeGreaterThan(20);
      expect(tool.inputSchema).toBeTruthy();
    }
  });

  it('exposes one resource per skill, plus the index and the license', async () => {
    const { resources } = await client.listResources();
    expect(resources).toHaveLength(SKILLS.length + 3); // index, license, errata

    const uris = resources.map((resource) => resource.uri);
    expect(uris).toContain('gsap://skills/index');
    expect(uris).toContain('gsap://skills/license');
    for (const skill of SKILLS) {
      expect(uris).toContain(`gsap://skills/${skill.name}`);
    }
  });

  it('serves each skill verbatim', async () => {
    for (const skill of SKILLS) {
      const result = await client.readResource({
        uri: `gsap://skills/${skill.name}`,
      });
      expect(result.contents[0].text).toBe(skill.content);
      expect(result.contents[0].mimeType).toBe('text/markdown');
    }
  });

  it('serves GreenSock\'s license for the vendored files', async () => {
    const result = await client.readResource({ uri: 'gsap://skills/license' });
    expect(result.contents[0].text).toContain('MIT License');
    expect(result.contents[0].text).toContain('GreenSock');
  });

  it('answers every original tool name with its original arguments', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [
      ['understand_and_create_animation', { request: 'fade in', context: 'react', complexity: 'expert' }],
      ['get_gsap_api_expert', { api_element: 'gsap.to', level: 'advanced' }],
      ['generate_complete_setup', { framework: 'react', plugins: ['ScrollTrigger'], performance_level: 'optimized' }],
      ['debug_animation_issue', { issue: 'animation does not start', expected_behavior: 'it should play' }],
      ['optimize_for_performance', { animation_code: 'gsap.to(".a", { x: 1 });', target: 'mobile-smooth' }],
      ['create_production_pattern', { pattern_type: 'hero-section', industry: 'portfolio' }],
    ];

    for (const [name, args] of calls) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, `${name} errored`).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].type).toBe('text');
      expect(content[0].text.length).toBeGreaterThan(50);
    }
  });

  it('returns structured findings from validate_gsap_code', async () => {
    const result = await client.callTool({
      name: 'validate_gsap_code',
      arguments: {
        code: 'gsap.to(".a", { top: 100, duration: 1 });',
        filename: 'a.js',
      },
    });

    const structured = result.structuredContent as {
      findings: Array<{ id: string; line: number; skill: string }>;
      counts: { error: number; warning: number; info: number };
    };
    expect(structured.findings[0]).toMatchObject({
      id: 'layout-property',
      line: 1,
      skill: 'gsap-performance',
    });
    expect(structured.counts.warning).toBe(1);
  });

  it('rejects arguments that do not match the schema', async () => {
    const result = await client.callTool({
      name: 'get_gsap_api_expert',
      arguments: { api_element: 'gsap.to', level: 'not-a-level' },
    });
    expect(result.isError).toBe(true);
  });

  it('rejects an unknown resource', async () => {
    await expect(
      client.readResource({ uri: 'gsap://skills/does-not-exist' }),
    ).rejects.toThrow();
  });
});

describe('over a real stdio transport', () => {
  const entry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

  it.skipIf(!existsSync(entry))(
    'starts as a subprocess and lists its tools and resources',
    async () => {
      const client = new Client({ name: 'stdio-test', version: '1.0.0' });
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [entry],
          stderr: 'pipe',
        }),
      );

      try {
        const { tools } = await client.listTools();
        expect(tools.map((tool) => tool.name).sort()).toEqual(
          [...ORIGINAL_TOOLS, ...NEW_TOOLS].sort(),
        );

        const { resources } = await client.listResources();
        expect(resources).toHaveLength(SKILLS.length + 3); // index, license, errata

        // The skills must have been copied into dist/, not just compiled.
        const core = await client.readResource({
          uri: 'gsap://skills/gsap-core',
        });
        expect(core.contents[0].text).toContain('# GSAP Core');

        const call = await client.callTool({
          name: 'get_gsap_guidance',
          arguments: { topic: 'stagger', index_only: true },
        });
        expect(call.isError).toBeFalsy();
      } finally {
        await client.close();
      }
    },
  );
});
